import type { SupabaseClient } from "@supabase/supabase-js";

export type EquipamentoParaIfc = {
  id: string;
  status: string;
  proxima_inspecao: string | null;
  proxima_recarga: string | null;
  proximo_teste_hidrostatico: string | null;
};

export type DocumentoParaIfc = { id: string; validade: string };

export type IfcHistoricoRegistro = {
  mes_referencia: string;
  score: number;
  pct_equipamentos_ok: number;
  pct_documentos_ok: number;
  pct_sem_nao_conformidade: number;
};

/**
 * Repository: única camada que sabe o nome das tabelas e monta queries
 * pro Índice FireControl. Segue o mesmo padrão de clientesRepository.ts —
 * consultas cruas, sem regra de negócio (o cálculo do índice em si está
 * em lib/ifc.ts).
 */
export const ifcRepository = {
  async listEquipamentosParaCalculo(supabase: SupabaseClient): Promise<EquipamentoParaIfc[]> {
    const { data, error } = await supabase
      .from("equipamentos")
      .select("id, status, proxima_inspecao, proxima_recarga, proximo_teste_hidrostatico");
    if (error) throw error;
    return data ?? [];
  },

  async listDocumentosComValidade(supabase: SupabaseClient): Promise<DocumentoParaIfc[]> {
    const { data, error } = await supabase.from("documentos").select("id, validade").not("validade", "is", null);
    if (error) throw error;
    return data ?? [];
  },

  async listHistorico(supabase: SupabaseClient): Promise<IfcHistoricoRegistro[]> {
    const { data, error } = await supabase.from("ifc_historico").select("*").order("mes_referencia", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  /** Um registro por mês: registrar de novo no mesmo mês atualiza o valor (upsert por mes_referencia). */
  async upsertHistoricoDoMes(supabase: SupabaseClient, registro: IfcHistoricoRegistro): Promise<void> {
    const { error } = await supabase.from("ifc_historico").upsert([registro], { onConflict: "mes_referencia" });
    if (error) throw error;
  },
};
