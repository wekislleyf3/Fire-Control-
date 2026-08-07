import type { SupabaseClient } from "@supabase/supabase-js";
import type { Equipamento, EquipamentoInput } from "@/types/equipamento";

/**
 * Repository: única camada que sabe o nome da tabela/bucket e monta
 * queries pra Equipamentos. Segue o mesmo padrão de clientesRepository.ts —
 * CRUD cru, sem regra de negócio.
 */
export const equipamentosRepository = {
  async list(supabase: SupabaseClient): Promise<Equipamento[]> {
    const { data, error } = await supabase
      .from("equipamentos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as Equipamento[]) ?? [];
  },

  /**
   * Só as colunas que o dashboard realmente usa (contagem por tipo + cálculo
   * de vencimentos). Evita baixar `especificacoes` (JSONB, pode ser grande),
   * `foto_url`, `observacoes` etc. de todo equipamento cadastrado.
   */
  async listResumoDashboard(
    supabase: SupabaseClient
  ): Promise<
    Pick<
      Equipamento,
      "id" | "codigo_interno" | "tipo" | "cliente_id" | "proxima_inspecao" | "proxima_recarga" | "proximo_teste_hidrostatico"
    >[]
  > {
    const { data, error } = await supabase
      .from("equipamentos")
      .select("id, codigo_interno, tipo, cliente_id, proxima_inspecao, proxima_recarga, proximo_teste_hidrostatico");
    if (error) throw error;
    return data ?? [];
  },

  async listPorCliente(supabase: SupabaseClient, clienteId: string): Promise<Equipamento[]> {
    const { data, error } = await supabase.from("equipamentos").select("*").eq("cliente_id", clienteId);
    if (error) throw error;
    return (data as Equipamento[]) ?? [];
  },

  async getById(supabase: SupabaseClient, id: string): Promise<Equipamento | null> {
    const { data, error } = await supabase.from("equipamentos").select("*").eq("id", id).single();
    // PGRST116 = .single() não achou nenhuma linha (ex: QR Code apontando pra
    // um equipamento excluído) — não é falha de rede/permissão, devolve null.
    if (error && error.code !== "PGRST116") throw error;
    return (data as Equipamento | null) ?? null;
  },

  async create(supabase: SupabaseClient, input: EquipamentoInput): Promise<Equipamento> {
    const { data, error } = await supabase.from("equipamentos").insert([input]).select().single();
    if (error) throw error;
    return data as Equipamento;
  },

  async update(
    supabase: SupabaseClient,
    id: string,
    input: Partial<Omit<Equipamento, "id" | "created_at">>
  ): Promise<Equipamento> {
    const { data, error } = await supabase
      .from("equipamentos")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Equipamento;
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("equipamentos").delete().eq("id", id);
    if (error) throw error;
  },

  /** Envia a foto pro bucket público e devolve a URL final (ainda não salva no registro). */
  async uploadFoto(supabase: SupabaseClient, equipamentoId: string, file: File): Promise<string> {
    const extensao = file.name.split(".").pop();
    const caminho = `equipamentos/${equipamentoId}/foto-${Date.now()}.${extensao}`;

    const { error: uploadError } = await supabase.storage
      .from("firecontrol-files")
      .upload(caminho, file, { upsert: true });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("firecontrol-files").getPublicUrl(caminho);
    return data.publicUrl;
  },
};
