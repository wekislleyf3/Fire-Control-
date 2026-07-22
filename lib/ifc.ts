export type IfcInput = {
  totalEquipamentos: number;
  equipamentosVencidos: number; // pelo menos uma data (inspeção/recarga/teste) vencida
  equipamentosEmAtencao: number; // status "atencao" (sinalizado em inspeção)
  totalDocumentosComValidade: number;
  documentosVencidos: number;
};

export type IfcResultado = {
  score: number; // 0-100
  pctEquipamentosOk: number;
  pctDocumentosOk: number;
  pctSemNaoConformidade: number;
};

/**
 * Índice FireControl (IFC): indicador único de 0 a 100 que resume a
 * conformidade geral. Pensado para ser mostrado ao cliente como "nota"
 * de segurança, e acompanhado mês a mês.
 *
 * Composição:
 * - 50% equipamentos sem vencimento (inspeção/recarga/teste em dia)
 * - 25% documentos sem vencimento (AVCB, CLCB, etc.)
 * - 25% equipamentos sem não conformidade sinalizada em inspeção
 */
export function calcularIFC(input: IfcInput): IfcResultado {
  const pctEquipamentosOk =
    input.totalEquipamentos === 0
      ? 100
      : ((input.totalEquipamentos - input.equipamentosVencidos) / input.totalEquipamentos) * 100;

  const pctDocumentosOk =
    input.totalDocumentosComValidade === 0
      ? 100
      : ((input.totalDocumentosComValidade - input.documentosVencidos) / input.totalDocumentosComValidade) * 100;

  const pctSemNaoConformidade =
    input.totalEquipamentos === 0
      ? 100
      : ((input.totalEquipamentos - input.equipamentosEmAtencao) / input.totalEquipamentos) * 100;

  const score = Math.round(pctEquipamentosOk * 0.5 + pctDocumentosOk * 0.25 + pctSemNaoConformidade * 0.25);

  return {
    score,
    pctEquipamentosOk: Math.round(pctEquipamentosOk),
    pctDocumentosOk: Math.round(pctDocumentosOk),
    pctSemNaoConformidade: Math.round(pctSemNaoConformidade),
  };
}

export function corDoIfc(score: number): { text: string; bg: string; border: string } {
  if (score >= 90) return { text: "text-green-700", bg: "bg-green-50", border: "border-green-200" };
  if (score >= 75) return { text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" };
  return { text: "text-brand-red", bg: "bg-red-50", border: "border-red-200" };
}

export type FaixaIfc = {
  label: "Excelente" | "Bom" | "Atenção" | "Crítico";
  text: string;
  bg: string;
  border: string;
};

/**
 * Classifica o IFC em faixas — a "nota" que a FireControl mostra ao
 * cliente, igual a uma nota de segurança:
 * 95–100 Excelente · 85–94 Bom · 70–84 Atenção · <70 Crítico
 */
export function faixaDoIfc(score: number): FaixaIfc {
  if (score >= 95) return { label: "Excelente", text: "text-green-700", bg: "bg-green-50", border: "border-green-200" };
  if (score >= 85) return { label: "Bom", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" };
  if (score >= 70) return { label: "Atenção", text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" };
  return { label: "Crítico", text: "text-brand-red", bg: "bg-red-50", border: "border-red-200" };
}
