import type { SupabaseClient } from "@supabase/supabase-js";
import type { Inspecao, InspecaoInput } from "@/types/inspecao";

/**
 * Repository: única camada que sabe o nome da tabela e monta queries pra
 * Inspeções. Segue o mesmo padrão de clientesRepository.ts — CRUD cru,
 * sem regra de negócio.
 */
export const inspecoesRepository = {
  async listRecentes(supabase: SupabaseClient, limite = 15): Promise<Inspecao[]> {
    const { data, error } = await supabase
      .from("inspecoes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) throw error;
    return (data as Inspecao[]) ?? [];
  },

  async listPorEquipamento(supabase: SupabaseClient, equipamentoId: string, limite = 20): Promise<Inspecao[]> {
    const { data, error } = await supabase
      .from("inspecoes")
      .select("*")
      .eq("equipamento_id", equipamentoId)
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) throw error;
    return (data as Inspecao[]) ?? [];
  },

  async listPorCliente(supabase: SupabaseClient, clienteId: string, limite = 8): Promise<Inspecao[]> {
    const { data, error } = await supabase
      .from("inspecoes")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) throw error;
    return (data as Inspecao[]) ?? [];
  },

  /** Inspeções registradas a partir de um instante (ex: desde o início do dia) — usado no dashboard de Operação. */
  async listDesde(supabase: SupabaseClient, apartirDeISO: string): Promise<Pick<Inspecao, "id" | "resultado" | "created_at">[]> {
    const { data, error } = await supabase
      .from("inspecoes")
      .select("id, resultado, created_at")
      .gte("created_at", apartirDeISO);
    if (error) throw error;
    return data ?? [];
  },

  async getById(supabase: SupabaseClient, id: string): Promise<Inspecao | null> {
    const { data, error } = await supabase.from("inspecoes").select("*").eq("id", id).single();
    if (error && error.code !== "PGRST116") throw error;
    return (data as Inspecao | null) ?? null;
  },

  async create(supabase: SupabaseClient, input: InspecaoInput): Promise<Inspecao> {
    const { data, error } = await supabase.from("inspecoes").insert([input]).select().single();
    if (error) throw error;
    return data as Inspecao;
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("inspecoes").delete().eq("id", id);
    if (error) throw error;
  },
};

/**
 * Histórico permanente do equipamento (usado também por Ordens de Serviço
 * e pela página de detalhe do equipamento) — fica aqui por enquanto por
 * ser gravado sempre junto com uma inspeção.
 */
export const equipamentoHistoricoRepository = {
  async registrar(
    supabase: SupabaseClient,
    params: { equipamento_id: string; evento: string; observacoes: string | null; data?: string }
  ): Promise<void> {
    const { error } = await supabase.from("equipamento_historico").insert([params]);
    if (error) throw error;
  },

  async registrarVarios(
    supabase: SupabaseClient,
    items: { equipamento_id: string; evento: string; observacoes: string | null; data?: string }[]
  ): Promise<void> {
    if (items.length === 0) return;
    const { error } = await supabase.from("equipamento_historico").insert(items);
    if (error) throw error;
  },

  async listPorEquipamento(supabase: SupabaseClient, equipamentoId: string, limite = 30) {
    const { data, error } = await supabase
      .from("equipamento_historico")
      .select("*")
      .eq("equipamento_id", equipamentoId)
      .order("data", { ascending: false })
      .limit(limite);
    if (error) throw error;
    return data ?? [];
  },
};
