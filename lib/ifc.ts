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
