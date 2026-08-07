import type { SupabaseClient } from "@supabase/supabase-js";
import type { Procedimento, ProcedimentoInput, ProcedimentoItem } from "@/lib/metodoFire";

type ItemInput = Omit<ProcedimentoItem, "id" | "procedimento_id">;

/**
 * Repository: única camada que sabe o nome das tabelas e monta queries
 * pra Procedimentos (Método Fire). Segue o mesmo padrão de
 * clientesRepository.ts — CRUD cru, sem regra de negócio.
 */
export const procedimentosRepository = {
  async list(supabase: SupabaseClient): Promise<Procedimento[]> {
    const { data, error } = await supabase.from("procedimentos").select("*");
    if (error) throw error;
    return (data as Procedimento[]) ?? [];
  },

  async listItens(supabase: SupabaseClient, procedimentoId: string): Promise<ProcedimentoItem[]> {
    const { data, error } = await supabase
      .from("procedimento_itens")
      .select("*")
      .eq("procedimento_id", procedimentoId)
      .order("ordem", { ascending: true });
    if (error) throw error;
    return (data as ProcedimentoItem[]) ?? [];
  },

  async create(supabase: SupabaseClient, input: ProcedimentoInput): Promise<Procedimento> {
    const { data, error } = await supabase.from("procedimentos").insert(input).select().single();
    if (error) throw error;
    return data as Procedimento;
  },

  async update(supabase: SupabaseClient, id: string, input: Partial<ProcedimentoInput>): Promise<void> {
    const { error } = await supabase
      .from("procedimentos")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("procedimentos").delete().eq("id", id);
    if (error) throw error;
  },

  async removerTodosItens(supabase: SupabaseClient, procedimentoId: string): Promise<void> {
    const { error } = await supabase.from("procedimento_itens").delete().eq("procedimento_id", procedimentoId);
    if (error) throw error;
  },

  async inserirItens(supabase: SupabaseClient, procedimentoId: string, itens: ItemInput[]): Promise<void> {
    if (itens.length === 0) return;
    const { error } = await supabase
      .from("procedimento_itens")
      .insert(itens.map((it) => ({ ...it, procedimento_id: procedimentoId })));
    if (error) throw error;
  },
};
