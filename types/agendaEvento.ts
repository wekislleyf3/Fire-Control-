export type TipoEventoAgenda = "visita" | "inspecao" | "manutencao" | "retorno" | "vistoria" | "reuniao" | "outro";
export type PrioridadeEvento = "baixa" | "normal" | "alta";
export type StatusEvento = "agendado" | "concluido" | "cancelado";

export type EventoAgenda = {
  id: string;
  cliente_id: string | null;
  equipamento_id: string | null;
  tipo: TipoEventoAgenda;
  titulo: string;
  data: string; // YYYY-MM-DD
  horario: string | null; // HH:MM
  responsavel: string | null;
  prioridade: PrioridadeEvento;
  status: StatusEvento;
  observacoes: string | null;
  created_at: string;
};

export type EventoAgendaInput = Omit<EventoAgenda, "id" | "created_at">;

export const TIPOS_EVENTO: { value: TipoEventoAgenda; label: string }[] = [
  { value: "visita", label: "Visita" },
  { value: "inspecao", label: "Inspeção" },
  { value: "manutencao", label: "Manutenção" },
  { value: "retorno", label: "Retorno" },
  { value: "vistoria", label: "Vistoria" },
  { value: "reuniao", label: "Reunião" },
  { value: "outro", label: "Outro" },
];
