import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cliente, ClienteInput } from "@/types/cliente";

/**
 * Repository: única camada que sabe o nome da tabela e monta queries.
 * Não contém regra de negócio — só CRUD cru. Se um dia trocar de
 * Supabase para outro backend, só este arquivo muda.
 */
export const clientesRepository = {
  async list(supabase: SupabaseClient): Promise<Cliente[]> {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as Cliente[]) ?? [];
  },

  async getById(supabase: SupabaseClient, id: string): Promise<Cliente | null> {
    const { data, error } = await supabase.from("clientes").select("*").eq("id", id).single();
    // PGRST116 = .single() não achou nenhuma linha — não é uma falha de
    // rede/permissão, é "não existe": devolve null em vez de lançar, pra
    // bater com o tipo Promise<Cliente | null> e permitir notFound().
    if (error && error.code !== "PGRST116") throw error;
    return (data as Cliente | null) ?? null;
  },

  async create(supabase: SupabaseClient, input: ClienteInput): Promise<Cliente> {
    const { data, error } = await supabase.from("clientes").insert([input]).select().single();
    if (error) throw error;
    return data as Cliente;
  },

  async update(supabase: SupabaseClient, id: string, input: Partial<ClienteInput>): Promise<Cliente> {
    const { data, error } = await supabase
      .from("clientes")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Cliente;
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) throw error;
  },

  /** Conta sem baixar as linhas (head: true) — usado pelos cards do dashboard. */
  async count(supabase: SupabaseClient, opts?: { apenasAtivos: boolean }): Promise<number> {
    let query = supabase.from("clientes").select("id", { count: "exact", head: true });
    if (opts?.apenasAtivos) query = query.eq("status", "ativo");
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Só id + razao_social — usado onde a tela só precisa montar um lookup de
   * nome (ex: dashboard). Evita baixar as ~25 outras colunas (endereço,
   * documentos, observações...) de todo cliente só pra exibir um nome.
   */
  async listNomes(supabase: SupabaseClient): Promise<Pick<Cliente, "id" | "razao_social">[]> {
    const { data, error } = await supabase.from("clientes").select("id, razao_social");
    if (error) throw error;
    return (data as Pick<Cliente, "id" | "razao_social">[]) ?? [];
  },
};
