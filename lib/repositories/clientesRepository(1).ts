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
    if (error) throw error;
    return data as Cliente | null;
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
};
