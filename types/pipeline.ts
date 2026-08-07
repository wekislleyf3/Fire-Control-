export type EtapaPipeline =
  | "prospeccao"
  | "cliente_ativo"
  | "cadastro"
  | "levantamento"
  | "inspecao"
  | "diagnostico"
  | "orcamento"
  | "execucao"
  | "regularizacao"
  | "monitoramento";

export const ETAPAS_PIPELINE: { value: EtapaPipeline; label: string }[] = [
  { value: "prospeccao", label: "Prospecção" },
  { value: "cliente_ativo", label: "Cliente ativo" },
  { value: "cadastro", label: "Cadastro" },
  { value: "levantamento", label: "Levantamento" },
  { value: "inspecao", label: "Inspeção" },
  { value: "diagnostico", label: "Diagnóstico" },
  { value: "orcamento", label: "Orçamento" },
  { value: "execucao", label: "Execução" },
  { value: "regularizacao", label: "Regularização" },
  { value: "monitoramento", label: "Monitoramento contínuo" },
];

export function labelEtapa(etapa: EtapaPipeline): string {
  return ETAPAS_PIPELINE.find((e) => e.value === etapa)?.label ?? etapa;
}

export function proximaEtapa(etapa: EtapaPipeline): EtapaPipeline | null {
  const i = ETAPAS_PIPELINE.findIndex((e) => e.value === etapa);
  if (i === -1 || i === ETAPAS_PIPELINE.length - 1) return null;
  return ETAPAS_PIPELINE[i + 1].value;
}

export function etapaAnterior(etapa: EtapaPipeline): EtapaPipeline | null {
  const i = ETAPAS_PIPELINE.findIndex((e) => e.value === etapa);
  if (i <= 0) return null;
  return ETAPAS_PIPELINE[i - 1].value;
}

export type HistoricoPipeline = {
  id: string;
  cliente_id: string;
  etapa_anterior: EtapaPipeline | null;
  etapa_nova: EtapaPipeline;
  observacao: string | null;
  created_at: string;
};
