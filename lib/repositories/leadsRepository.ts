import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadSite, StatusLeadSite } from "@/types/leadSite";

/**
 * Repository: única camada que sabe o nome da tabela e monta queries pra
 * Leads do site. Segue o mesmo padrão de clientesRepository.ts — CRUD
 * cru, sem regra de negócio.
 */
export const leadsRepository = {
  async list(supabase: SupabaseClient, opts: { apenasNovos: boolean }): Promise<LeadSite[]> {
    let query = supabase.from("leads_site").select("*").order("created_at", { ascending: false });
    if (opts.apenasNovos) query = query.eq("status", "novo");

    const { data, error } = await query;
    if (error) throw error;
    return (data as LeadSite[]) ?? [];
  },

  async updateStatus(
    supabase: SupabaseClient,
    id: string,
    status: StatusLeadSite,
    clienteId?: string
  ): Promise<void> {
    const payload: { status: StatusLeadSite; cliente_id?: string } = { status };
    if (clienteId) payload.cliente_id = clienteId;
    const { error } = await supabase.from("leads_site").update(payload).eq("id", id);
    if (error) throw error;
  },
};
