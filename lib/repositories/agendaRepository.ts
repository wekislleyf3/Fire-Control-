import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventoAgenda, EventoAgendaInput, StatusEvento } from "@/types/agendaEvento";

/**
 * Repository: única camada que sabe o nome da tabela e monta queries pra
 * Agenda. Segue o mesmo padrão de clientesRepository.ts — CRUD cru, sem
 * regra de negócio.
 */
export const agendaRepository = {
  async listPorPeriodo(supabase: SupabaseClient, inicioISO: string, fimISO: string): Promise<EventoAgenda[]> {
    const { data, error } = await supabase
      .from("agenda_eventos")
      .select("*")
      .gte("data", inicioISO)
      .lte("data", fimISO)
      .order("data", { ascending: true })
      .order("horario", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data as EventoAgenda[]) ?? [];
  },

  /** Todos os eventos com status "agendado" — usado no formulário de Ordens de Serviço pra vincular a uma visita já marcada. */
  async listAgendados(supabase: SupabaseClient): Promise<EventoAgenda[]> {
    const { data, error } = await supabase.from("agenda_eventos").select("*").eq("status", "agendado").order("data");
    if (error) throw error;
    return (data as EventoAgenda[]) ?? [];
  },

  /** Eventos do dia (exceto cancelados) — usado no dashboard de Operação. */
  async listHoje(supabase: SupabaseClient, dataStr: string): Promise<EventoAgenda[]> {
    const { data, error } = await supabase
      .from("agenda_eventos")
      .select("*")
      .eq("data", dataStr)
      .neq("status", "cancelado")
      .order("horario", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data as EventoAgenda[]) ?? [];
  },

  /** Próximos eventos agendados a partir de uma data — usado no dashboard de Operação. */
  async listProximosAgendados(supabase: SupabaseClient, apartirDe: string, limite = 5): Promise<EventoAgenda[]> {
    const { data, error } = await supabase
      .from("agenda_eventos")
      .select("*")
      .gt("data", apartirDe)
      .eq("status", "agendado")
      .order("data", { ascending: true })
      .order("horario", { ascending: true, nullsFirst: false })
      .limit(limite);
    if (error) throw error;
    return (data as EventoAgenda[]) ?? [];
  },

  async create(supabase: SupabaseClient, input: Partial<EventoAgendaInput>): Promise<EventoAgenda> {
    const { data, error } = await supabase.from("agenda_eventos").insert([input]).select().single();
    if (error) throw error;
    return data as EventoAgenda;
  },

  async updateStatus(supabase: SupabaseClient, id: string, status: StatusEvento): Promise<void> {
    const { error } = await supabase.from("agenda_eventos").update({ status }).eq("id", id);
    if (error) throw error;
  },

  async listConcluidosPorCliente(
    supabase: SupabaseClient,
    clienteId: string,
    limite = 20
  ): Promise<{ id: string; titulo: string; tipo: string; data: string }[]> {
    const { data, error } = await supabase
      .from("agenda_eventos")
      .select("id, titulo, tipo, data")
      .eq("cliente_id", clienteId)
      .eq("status", "concluido")
      .order("data", { ascending: false })
      .limit(limite);
    if (error) throw error;
    return data ?? [];
  },

  async getProximaPorCliente(
    supabase: SupabaseClient,
    clienteId: string,
    apartirDeISO: string
  ): Promise<{ id: string; titulo: string; data: string; horario: string | null } | null> {
    const { data, error } = await supabase
      .from("agenda_eventos")
      .select("id, titulo, data, horario")
      .eq("cliente_id", clienteId)
      .eq("status", "agendado")
      .gte("data", apartirDeISO)
      .order("data", { ascending: true })
      .order("horario", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};
