import type { SupabaseClient } from "@supabase/supabase-js";
import type { EtapaPipeline } from "@/types/pipeline";

/**
 * Muda a etapa do pipeline de um cliente e registra a transição no
 * histórico (cliente_pipeline_historico) — é isso que alimenta a Timeline
 * do cliente. Usado tanto pela tela /pipeline (kanban) quanto pela página
 * de detalhes do cliente, pra nunca ficar duas implementações divergentes
 * do mesmo mecanismo.
 */
export async function mudarEtapaPipeline(
  supabase: SupabaseClient,
  clienteId: string,
  etapaAtual: EtapaPipeline,
  etapaNova: EtapaPipeline,
  observacao?: string
): Promise<{ error: string | null }> {
  const { error: updateError } = await supabase
    .from("clientes")
    .update({ etapa_pipeline: etapaNova })
    .eq("id", clienteId);

  if (updateError) return { error: updateError.message };

  const { error: histError } = await supabase.from("cliente_pipeline_historico").insert({
    cliente_id: clienteId,
    etapa_anterior: etapaAtual,
    etapa_nova: etapaNova,
    observacao: observacao || null,
  });

  if (histError) return { error: histError.message };
  return { error: null };
}
