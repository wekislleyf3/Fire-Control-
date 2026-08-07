import type { SupabaseClient } from "@supabase/supabase-js";
import { agendaRepository } from "@/lib/repositories/agendaRepository";
import type { EventoAgenda, EventoAgendaInput, StatusEvento } from "@/types/agendaEvento";

export class ValidationError extends Error {}

/**
 * Service: regra de negócio + orquestração. Páginas chamam o service,
 * nunca o repository ou o Supabase diretamente.
 */
export const agendaService = {
  listPorPeriodo(supabase: SupabaseClient, inicioISO: string, fimISO: string): Promise<EventoAgenda[]> {
    return agendaRepository.listPorPeriodo(supabase, inicioISO, fimISO);
  },

  create(supabase: SupabaseClient, input: EventoAgendaInput): Promise<EventoAgenda> {
    if (!input.titulo || !input.titulo.trim()) {
      throw new ValidationError("Título do evento é obrigatório.");
    }
    if (!input.data) {
      throw new ValidationError("Data do evento é obrigatória.");
    }
    return agendaRepository.create(supabase, {
      ...input,
      cliente_id: input.cliente_id || null,
      equipamento_id: input.equipamento_id || null,
      horario: input.horario || null,
      responsavel: input.responsavel || null,
      observacoes: input.observacoes || null,
    });
  },

  atualizarStatus(supabase: SupabaseClient, id: string, status: StatusEvento): Promise<void> {
    return agendaRepository.updateStatus(supabase, id, status);
  },
};
