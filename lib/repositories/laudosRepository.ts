import type { SupabaseClient } from "@supabase/supabase-js";

export type LaudoResumo = { token_validacao: string; status: "valido" | "revogado"; data_emissao: string };
export type LaudoDeInspecao = LaudoResumo & { inspecao_id: string };
export type LaudoDeOrdemServico = LaudoResumo & { ordem_servico_id: string };
export type LaudoDeDiagnostico = { id: string; data_emissao: string };

/**
 * Repository: única camada que sabe o nome da tabela e monta queries pros
 * selos de autenticidade emitidos (laudos_autenticacao). Segue o mesmo
 * padrão de clientesRepository.ts — consultas cruas, sem regra de negócio.
 */
export const laudosRepository = {
  async listPorInspecoes(supabase: SupabaseClient, inspecaoIds: string[]): Promise<LaudoDeInspecao[]> {
    if (inspecaoIds.length === 0) return [];
    const { data, error } = await supabase
      .from("laudos_autenticacao")
      .select("token_validacao, status, data_emissao, inspecao_id")
      .eq("tipo_documento", "inspecao")
      .in("inspecao_id", inspecaoIds);
    if (error) throw error;
    return (data as LaudoDeInspecao[]) ?? [];
  },

  async listPorOrdensServico(supabase: SupabaseClient, ordemServicoIds: string[]): Promise<LaudoDeOrdemServico[]> {
    if (ordemServicoIds.length === 0) return [];
    const { data, error } = await supabase
      .from("laudos_autenticacao")
      .select("token_validacao, status, data_emissao, ordem_servico_id")
      .eq("tipo_documento", "ordem_servico")
      .in("ordem_servico_id", ordemServicoIds);
    if (error) throw error;
    return (data as LaudoDeOrdemServico[]) ?? [];
  },

  async listDiagnosticosPorCliente(supabase: SupabaseClient, clienteId: string): Promise<LaudoDeDiagnostico[]> {
    const { data, error } = await supabase
      .from("laudos_autenticacao")
      .select("id, data_emissao")
      .eq("cliente_id", clienteId)
      .eq("tipo_documento", "diagnostico")
      .order("data_emissao", { ascending: false });
    if (error) throw error;
    return (data as LaudoDeDiagnostico[]) ?? [];
  },

  /** Laudos emitidos a partir de um instante (ex: desde o início do dia) — usado no dashboard de Operação. */
  async listDesde(
    supabase: SupabaseClient,
    apartirDeISO: string
  ): Promise<{ id: string; tipo_documento: string; cliente_id: string; data_emissao: string }[]> {
    const { data, error } = await supabase
      .from("laudos_autenticacao")
      .select("id, tipo_documento, cliente_id, data_emissao")
      .gte("data_emissao", apartirDeISO);
    if (error) throw error;
    return data ?? [];
  },
};
