/** Respostas do checklist: chave do item -> true (conforme) / false (não conforme). */
export type ChecklistRespostas = Record<string, boolean>;

export type ResultadoInspecao = "conforme" | "nao_conforme";

export type Inspecao = {
  id: string;
  cliente_id: string;
  equipamento_id: string;
  /** Tipo do equipamento no momento da inspeção (o equipamento pode mudar de tipo depois). */
  tipo_equipamento_snapshot: string | null;
  /** Checklist aplicado, já adaptado ao tipo do equipamento. */
  itens_checklist: ChecklistRespostas;
  resultado: ResultadoInspecao;
  observacoes: string | null;
  created_at: string;
};

export type InspecaoInput = {
  cliente_id: string;
  equipamento_id: string;
  tipo_equipamento_snapshot: string;
  itens_checklist: ChecklistRespostas;
  resultado: ResultadoInspecao;
  observacoes: string | null;
};
