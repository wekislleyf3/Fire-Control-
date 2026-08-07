import { calcularUrgencia } from "@/lib/alerts";
import { calcularIFC, type IfcResultado } from "@/lib/ifc";

export type ProblemaDiagnostico = {
  descricao: string;
  severidade: "vencido" | "atencao";
};

export type DiagnosticoCliente = {
  totalEquipamentos: number;
  equipamentosConformes: number;
  equipamentosPendentes: number;
  totalDocumentos: number;
  documentosVencidos: number;
  ifc: IfcResultado;
  problemas: ProblemaDiagnostico[];
};

type EquipamentoResumo = {
  codigo_interno: string;
  tipo: string;
  status: string;
  proxima_inspecao: string | null;
  proxima_recarga: string | null;
  proximo_teste_hidrostatico: string | null;
};

type DocumentoResumo = {
  tipo: string;
  validade: string | null;
};

/**
 * Monta o diagnóstico de um cliente a partir dos seus equipamentos e
 * documentos: conta pendências, aponta os principais problemas e calcula
 * o IFC (Índice FireControl) específico daquele cliente.
 *
 * Usado tanto na Página Institucional do Cliente quanto no PDF de
 * diagnóstico — é a "primeira visita vira relatório" descrita no plano.
 */
export function montarDiagnostico(
  equipamentos: EquipamentoResumo[],
  documentos: DocumentoResumo[]
): DiagnosticoCliente {
  const problemas: ProblemaDiagnostico[] = [];
  let equipamentosVencidos = 0;
  let equipamentosEmAtencao = 0;

  for (const eq of equipamentos) {
    const campos = [
      { label: "inspeção", data: eq.proxima_inspecao },
      { label: "recarga", data: eq.proxima_recarga },
      { label: "teste hidrostático", data: eq.proximo_teste_hidrostatico },
    ];
    let temVencido = false;
    for (const campo of campos) {
      const u = calcularUrgencia(campo.data);
      if (!u) continue;
      if (u.severity === "vencido" || u.severity === "hoje") {
        temVencido = true;
        problemas.push({
          descricao: `${eq.codigo_interno} (${eq.tipo}) — ${campo.label} vencida`,
          severidade: "vencido",
        });
      } else if (u.severity === "critico") {
        problemas.push({
          descricao: `${eq.codigo_interno} (${eq.tipo}) — ${campo.label} vence em breve (${u.label})`,
          severidade: "atencao",
        });
      }
    }
    if (temVencido) equipamentosVencidos++;
    if (eq.status === "atencao") equipamentosEmAtencao++;
  }

  const documentosComValidade = documentos.filter((d) => d.validade);
  let documentosVencidos = 0;
  for (const doc of documentosComValidade) {
    const u = calcularUrgencia(doc.validade);
    if (u && (u.severity === "vencido" || u.severity === "hoje")) {
      documentosVencidos++;
      problemas.push({ descricao: `Documento ${doc.tipo} vencido`, severidade: "vencido" });
    } else if (u && u.severity === "critico") {
      problemas.push({
        descricao: `Documento ${doc.tipo} vence em breve (${u.label})`,
        severidade: "atencao",
      });
    }
  }

  const ifc = calcularIFC({
    totalEquipamentos: equipamentos.length,
    equipamentosVencidos,
    equipamentosEmAtencao,
    totalDocumentosComValidade: documentosComValidade.length,
    documentosVencidos,
  });

  const equipamentosPendentes = equipamentos.filter((e) => e.status !== "ok").length;

  // problemas vencidos primeiro, depois os que estão próximos de vencer
  problemas.sort((a, b) => {
    if (a.severidade === b.severidade) return 0;
    return a.severidade === "vencido" ? -1 : 1;
  });

  return {
    totalEquipamentos: equipamentos.length,
    equipamentosConformes: equipamentos.length - equipamentosPendentes,
    equipamentosPendentes,
    totalDocumentos: documentos.length,
    documentosVencidos,
    ifc,
    problemas,
  };
}
