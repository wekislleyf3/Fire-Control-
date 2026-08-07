export type StatusOS = "aberta" | "concluida" | "cancelada";
export type TipoOS = "vistoria" | "levantamento";

export type OrdemServicoItem = {
  id: string;
  ordem_servico_id: string;
  equipamento_id: string | null;
  codigo_interno_snapshot: string | null;
  tipo_equipamento_snapshot: string | null;
  localizacao_snapshot: string | null;
  verificado: boolean;
  observacao: string | null;
  created_at: string;
};

export type OrdemServicoItemInput = Omit<OrdemServicoItem, "id" | "ordem_servico_id" | "created_at">;

export type OrdemServico = {
  id: string;
  numero: number;
  tipo: TipoOS;
  cliente_id: string;
  evento_agenda_id: string | null;
  data: string; // YYYY-MM-DD
  responsavel_tecnico: string | null;
  status: StatusOS;
  observacoes: string | null;
  assinatura_cliente_url: string | null;
  assinatura_nome: string | null;
  assinatura_data: string | null;
  created_at: string;
  /** Preenchido quando a OS é carregada junto dos itens (ver repository). */
  itens?: OrdemServicoItem[];
};

export type OrdemServicoInput = Omit<
  OrdemServico,
  "id" | "numero" | "created_at" | "status" | "itens" | "assinatura_cliente_url" | "assinatura_nome" | "assinatura_data"
>;

export const STATUS_OS_LABEL: Record<StatusOS, string> = {
  aberta: "Aberta",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const TIPO_OS_LABEL: Record<TipoOS, string> = {
  vistoria: "Vistoria de equipamentos",
  levantamento: "Levantamento / cadastro de equipamentos",
};
