import type { EquipamentoStatus } from "@/types/equipamento";

export type Urgencia = {
  label: string;
  diasRestantes: number;
  severity: "vencido" | "hoje" | "critico" | "atencao" | "ok";
};

const DIA_MS = 1000 * 60 * 60 * 24;

/**
 * Data de hoje (YYYY-MM-DD) no horário de Brasília, independente do fuso
 * em que o código está rodando. Isso importa porque a Vercel roda funções
 * server-side em UTC por padrão: sem isso, entre 21h e meia-noite (horário
 * de Brasília) o servidor já acha que é o dia seguinte (Brasília é UTC-3),
 * fazendo equipamentos/documentos aparecerem como vencidos até 3 horas
 * mais cedo do que deveriam, e contadores de "hoje" zerarem cedo demais.
 */
export function hojeBrasiliaStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Meia-noite de "hoje" no horário de Brasília, como objeto Date. */
export function hojeBrasilia(): Date {
  return new Date(`${hojeBrasiliaStr()}T00:00:00-03:00`);
}

/**
 * Calcula a urgência de uma data (ex: próxima inspeção, próxima recarga).
 * Retorna null se a data não existir ou estiver a mais de 90 dias (não é alerta ainda).
 */
export function calcularUrgencia(data: string | null): Urgencia | null {
  if (!data) return null;

  const hoje = hojeBrasilia();
  const alvo = new Date(data + "T00:00:00-03:00");
  const diasRestantes = Math.round((alvo.getTime() - hoje.getTime()) / DIA_MS);

  if (diasRestantes > 90) return null;

  if (diasRestantes < 0) return { label: `Vencido há ${Math.abs(diasRestantes)} dia(s)`, diasRestantes, severity: "vencido" };
  if (diasRestantes === 0) return { label: "Vence hoje", diasRestantes, severity: "hoje" };
  if (diasRestantes <= 15) return { label: `Vence em ${diasRestantes} dia(s)`, diasRestantes, severity: "critico" };
  if (diasRestantes <= 30) return { label: `Vence em ${diasRestantes} dia(s)`, diasRestantes, severity: "atencao" };
  return { label: `Vence em ${diasRestantes} dia(s)`, diasRestantes, severity: "ok" };
}

/**
 * Fonte única de verdade para o status (ok/atencao/vencido) de um equipamento.
 * Deriva sempre das datas de vencimento (inspeção, recarga, teste hidrostático)
 * via calcularUrgencia — nunca de um campo gravado no banco — para que
 * Dashboard, Alertas, IFC, Diagnóstico, Pendências e a listagem de
 * equipamentos concordem entre si o tempo todo, inclusive quando nenhuma
 * inspeção nova foi feita e uma data simplesmente venceu com o tempo.
 */
export function calcularStatusEquipamento(equipamento: {
  proxima_inspecao: string | null;
  proxima_recarga: string | null;
  proximo_teste_hidrostatico: string | null;
}): EquipamentoStatus {
  const datas = [
    equipamento.proxima_inspecao,
    equipamento.proxima_recarga,
    equipamento.proximo_teste_hidrostatico,
  ];

  let pior: EquipamentoStatus = "ok";
  for (const data of datas) {
    const u = calcularUrgencia(data);
    if (!u) continue;
    if (u.severity === "vencido" || u.severity === "hoje") return "vencido";
    if (u.severity === "critico" || u.severity === "atencao") pior = "atencao";
  }
  return pior;
}

export const severityStyle: Record<Urgencia["severity"], string> = {
  vencido: "bg-red-100 text-red-700 border-red-200",
  hoje: "bg-red-100 text-red-700 border-red-200",
  critico: "bg-amber-100 text-amber-700 border-amber-200",
  atencao: "bg-yellow-50 text-yellow-700 border-yellow-200",
  ok: "bg-green-50 text-green-700 border-green-200",
};
