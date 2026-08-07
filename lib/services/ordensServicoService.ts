import type { SupabaseClient } from "@supabase/supabase-js";
import { ordensServicoRepository } from "@/lib/repositories/ordensServicoRepository";
import { equipamentoHistoricoRepository } from "@/lib/repositories/inspecoesRepository";
import type { OrdemServico } from "@/types/ordemServico";

export class ValidationError extends Error {}

/**
 * Service: regra de negócio + orquestração. Páginas chamam o service,
 * nunca o repository ou o Supabase diretamente.
 */
export const ordensServicoService = {
  /**
   * Conclui a OS: envia a assinatura coletada em tela, marca a OS como
   * concluída e registra "Vistoria (OS-00001)" na linha do tempo de cada
   * equipamento que o técnico de fato marcou como verificado (item
   * incluído na OS mas não conferido não vira evento). Se o registro do
   * histórico falhar, a OS já está concluída — o erro só é logado, não
   * interrompe o fluxo (mesmo comportamento de antes).
   */
  async concluir(
    supabase: SupabaseClient,
    os: OrdemServico,
    params: { assinaturaBlob: Blob; nomeAssinante: string }
  ): Promise<OrdemServico> {
    if (!params.nomeAssinante.trim()) throw new ValidationError("Informe o nome de quem está assinando.");

    const assinaturaUrl = await ordensServicoRepository.uploadAssinatura(supabase, os.cliente_id, os.id, params.assinaturaBlob);

    const osAtualizada = await ordensServicoRepository.concluir(supabase, os.id, {
      assinatura_cliente_url: assinaturaUrl,
      assinatura_nome: params.nomeAssinante.trim(),
    });

    const numeroOs = `OS-${String(os.numero).padStart(5, "0")}`;
    const itensVerificados = (os.itens ?? []).filter((item) => item.verificado && item.equipamento_id);

    if (itensVerificados.length > 0) {
      try {
        await equipamentoHistoricoRepository.registrarVarios(
          supabase,
          itensVerificados.map((item) => ({
            equipamento_id: item.equipamento_id as string,
            data: os.data,
            evento: `Vistoria (${numeroOs})`,
            observacoes: item.observacao,
          }))
        );
      } catch (err) {
        console.error("[ordens-servico] falha ao registrar histórico do equipamento:", err);
      }
    }

    return osAtualizada;
  },
};
