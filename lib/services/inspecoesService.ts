import type { SupabaseClient } from "@supabase/supabase-js";
import { inspecoesRepository, equipamentoHistoricoRepository } from "@/lib/repositories/inspecoesRepository";
import { equipamentosRepository } from "@/lib/repositories/equipamentosRepository";
import type { Inspecao, InspecaoInput, ChecklistRespostas } from "@/types/inspecao";
import type { Equipamento } from "@/types/equipamento";
import { hojeBrasilia } from "@/lib/alerts";
import { getChecklistParaTipo, calcularResultado } from "@/lib/checklists";

export class ValidationError extends Error {}

// intervalo padrão até a próxima inspeção, em dias (ajustável por tipo no futuro)
const DIAS_PROXIMA_INSPECAO = 90;

type RegistrarInspecaoParams = {
  clienteId: string;
  equipamento: Equipamento;
  itensChecklist: ChecklistRespostas;
  observacoes: string | null;
  responsavelTecnico: string | null;
};

/**
 * Service: regra de negócio + orquestração. Páginas chamam o service,
 * nunca o repository ou o Supabase diretamente.
 */
export const inspecoesService = {
  listRecentes(supabase: SupabaseClient, limite?: number): Promise<Inspecao[]> {
    return inspecoesRepository.listRecentes(supabase, limite);
  },

  getById(supabase: SupabaseClient, id: string): Promise<Inspecao | null> {
    return inspecoesRepository.getById(supabase, id);
  },

  remove(supabase: SupabaseClient, id: string): Promise<void> {
    return inspecoesRepository.remove(supabase, id);
  },

  /**
   * Registra uma inspeção completa: cria o registro, emite o selo de
   * autenticidade, grava o evento no histórico do equipamento e atualiza
   * as datas/status do equipamento. Mantém no service porque é uma única
   * operação de negócio, ainda que toque três tabelas diferentes.
   */
  async registrar(supabase: SupabaseClient, params: RegistrarInspecaoParams): Promise<Inspecao> {
    if (!params.clienteId || !params.equipamento) {
      throw new ValidationError("Cliente e equipamento são obrigatórios.");
    }

    // O resultado NUNCA vem de fora: é sempre recalculado aqui a partir das
    // respostas do checklist, usando o checklist correto para o tipo do
    // equipamento. Isso evita gravar (e depois assinar no selo de
    // autenticidade) um resultado que não bate com o que foi respondido —
    // seja por um bug de estado no formulário, seja por alguém montando a
    // chamada manualmente. A prévia mostrada ao técnico no formulário pode
    // continuar sendo calculada no cliente só para feedback visual; a fonte
    // de verdade do que é gravado é sempre esta.
    const checklist = getChecklistParaTipo(params.equipamento.tipo);
    const resultado = calcularResultado(checklist, params.itensChecklist);

    const input: InspecaoInput = {
      cliente_id: params.clienteId,
      equipamento_id: params.equipamento.id,
      tipo_equipamento_snapshot: params.equipamento.tipo,
      itens_checklist: params.itensChecklist,
      resultado,
      observacoes: params.observacoes,
      responsavel_tecnico: params.responsavelTecnico,
    };

    const inspecao = await inspecoesRepository.create(supabase, input);

    // Emite o selo (token + hash) imediatamente ao finalizar a inspeção: o
    // laudo já nasce autenticável, sem depender do clique em "Emitir PDF"
    // mais tarde. Se essa chamada falhar (ex: rede instável), a geração do
    // PDF tenta emitir de novo antes de desenhar o documento — por isso o
    // erro aqui é apenas ignorado, não interrompe o fluxo.
    try {
      await fetch("/api/laudos/emitir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspecaoId: inspecao.id }),
      });
    } catch {
      // sem problema — ver comentário acima
    }

    await equipamentoHistoricoRepository.registrar(supabase, {
      equipamento_id: params.equipamento.id,
      evento: "Inspeção realizada",
      observacoes: params.observacoes,
    });

    const hoje = hojeBrasilia();
    const proxima = new Date(hoje);
    proxima.setDate(proxima.getDate() + DIAS_PROXIMA_INSPECAO);

    await equipamentosRepository.update(supabase, params.equipamento.id, {
      ultima_inspecao: hoje.toISOString().slice(0, 10),
      proxima_inspecao: proxima.toISOString().slice(0, 10),
      status: resultado === "nao_conforme" ? "atencao" : "ok",
    });

    return inspecao;
  },
};
