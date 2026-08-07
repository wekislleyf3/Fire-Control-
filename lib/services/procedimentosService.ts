import type { SupabaseClient } from "@supabase/supabase-js";
import { procedimentosRepository } from "@/lib/repositories/procedimentosRepository";
import type { Procedimento, ProcedimentoInput, ProcedimentoItem } from "@/lib/metodoFire";

export class ValidationError extends Error {}

export type ItemForm = { id?: string; chave: string; pergunta: string; norma_referencia: string; critico: boolean };

/**
 * Service: regra de negócio + orquestração. Páginas chamam o service,
 * nunca o repository ou o Supabase diretamente.
 */
export const procedimentosService = {
  async listMapaPorTipo(supabase: SupabaseClient): Promise<Record<string, Procedimento>> {
    const lista = await procedimentosRepository.list(supabase);
    const mapa: Record<string, Procedimento> = {};
    for (const p of lista) mapa[p.tipo_equipamento] = p;
    return mapa;
  },

  listItens(supabase: SupabaseClient, procedimentoId: string): Promise<ProcedimentoItem[]> {
    return procedimentosRepository.listItens(supabase, procedimentoId);
  },

  /**
   * Cria ou atualiza o procedimento de um tipo de equipamento e substitui
   * todos os itens do checklist pelos atuais (mais simples e seguro que
   * tentar diffar item a item).
   */
  async salvar(
    supabase: SupabaseClient,
    params: {
      tipoEquipamento: string;
      existente: Procedimento | undefined;
      form: Omit<ProcedimentoInput, "tipo_equipamento">;
      itens: ItemForm[];
    }
  ): Promise<void> {
    if (!params.form.nome.trim()) {
      throw new ValidationError("Nome do procedimento é obrigatório.");
    }

    let procedimentoId: string;
    if (params.existente) {
      await procedimentosRepository.update(supabase, params.existente.id, params.form);
      procedimentoId = params.existente.id;
    } else {
      const criado = await procedimentosRepository.create(supabase, {
        ...params.form,
        tipo_equipamento: params.tipoEquipamento,
      });
      procedimentoId = criado.id;
    }

    await procedimentosRepository.removerTodosItens(supabase, procedimentoId);
    await procedimentosRepository.inserirItens(
      supabase,
      procedimentoId,
      params.itens.map((it, ordem) => ({
        chave: it.chave,
        pergunta: it.pergunta,
        norma_referencia: it.norma_referencia || null,
        critico: it.critico,
        ordem,
      }))
    );
  },

  restaurarPadrao(supabase: SupabaseClient, procedimentoId: string): Promise<void> {
    return procedimentosRepository.remove(supabase, procedimentoId);
  },
};
