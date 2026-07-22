import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calcularUrgencia, severityStyle } from "@/lib/alerts";
import type { Equipamento } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LinhaAlerta = {
  equipamento: Equipamento;
  clienteNome: string;
  tipoData: string;
  data: string;
  diasRestantes: number;
  label: string;
  severity: "vencido" | "hoje" | "critico" | "atencao" | "ok";
};

async function getAlertas(): Promise<LinhaAlerta[]> {
  noStore();
  const supabase = createClient();
  const { data: equipamentos } = await supabase
    .from("equipamentos")
    .select("*, clientes(razao_social)");

  const linhas: LinhaAlerta[] = [];

  for (const eq of (equipamentos as any[]) ?? []) {
    const clienteNome = eq.clientes?.razao_social ?? "—";
    const campos: { chave: string; label: string; data: string | null }[] = [
      { chave: "proxima_inspecao", label: "Inspeção", data: eq.proxima_inspecao },
      { chave: "proxima_recarga", label: "Recarga", data: eq.proxima_recarga },
      { chave: "proximo_teste_hidrostatico", label: "Teste hidrostático", data: eq.proximo_teste_hidrostatico },
    ];

    for (const campo of campos) {
      const urgencia = calcularUrgencia(campo.data);
      if (!urgencia || !campo.data) continue;
      linhas.push({
        equipamento: eq,
        clienteNome,
        tipoData: campo.label,
        data: campo.data,
        diasRestantes: urgencia.diasRestantes,
        label: urgencia.label,
        severity: urgencia.severity,
      });
    }
  }

  linhas.sort((a, b) => a.diasRestantes - b.diasRestantes);
  return linhas;
}

export default async function AlertasPage() {
  const alertas = await getAlertas();
  const vencidos = alertas.filter((a) => a.severity === "vencido" || a.severity === "hoje");
  const proximos = alertas.filter((a) => a.severity !== "vencido" && a.severity !== "hoje");

  // Os cards de resumo contam EQUIPAMENTOS únicos, não linhas — um mesmo
  // equipamento pode gerar várias linhas (ex: inspeção E recarga vencidas
  // ao mesmo tempo), e contar linhas ali infla o número em relação ao
  // Dashboard/Pendências/IFC, que sempre contam por equipamento.
  const equipamentosVencidosUnicos = new Set(vencidos.map((a) => a.equipamento.id)).size;
  const equipamentosProximosUnicos = new Set(proximos.map((a) => a.equipamento.id)).size;

  return (
    <div>
      <h1 className="font-display text-3xl mb-2">Alertas</h1>
      <p className="text-sm text-brand-slate/70 mb-6">
        Calculado automaticamente a partir das datas de inspeção, recarga e teste hidrostático de
        cada equipamento. Atualiza sozinho — nada aqui precisa ser cadastrado manualmente.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="rounded-lg border border-red-200 bg-white p-5">
          <p className="text-sm text-brand-slate">Equipamentos vencidos ou vencendo hoje</p>
          <p className="font-display text-4xl mt-1 text-brand-red">{equipamentosVencidosUnicos}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-white p-5">
          <p className="text-sm text-brand-slate">Equipamentos vencendo nos próximos 90 dias</p>
          <p className="font-display text-4xl mt-1 text-amber-500">{equipamentosProximosUnicos}</p>
        </div>
      </div>

      <div className="bg-white border border-black/5 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-brand-fog text-left text-brand-slate">
            <tr>
              <th className="px-4 py-3">Equipamento</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Pendência</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody>
            {alertas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-brand-slate/60">
                  Nenhum vencimento nos próximos 90 dias. Tudo em dia.
                </td>
              </tr>
            )}
            {alertas.map((a, i) => (
              <tr key={`${a.equipamento.id}-${a.tipoData}-${i}`} className="border-t border-black/5">
                <td className="px-4 py-3 font-medium">{a.equipamento.codigo_interno}</td>
                <td className="px-4 py-3">{a.clienteNome}</td>
                <td className="px-4 py-3">{a.tipoData}</td>
                <td className="px-4 py-3">{new Date(a.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs border ${severityStyle[a.severity]}`}>
                    {a.label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
