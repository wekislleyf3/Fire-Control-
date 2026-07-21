import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calcularUrgencia } from "@/lib/alerts";
import EquipamentosPorTipoChart from "../components/EquipamentosPorTipoChart";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getDashboardData() {
  noStore();
  const supabase = createClient();

  const [clientesAtivosRes, totalClientesRes, equipamentosRes, inspecoesRes] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("clientes").select("id", { count: "exact", head: true }),
    supabase
      .from("equipamentos")
      .select("id, codigo_interno, tipo, proxima_inspecao, proxima_recarga, proximo_teste_hidrostatico, clientes(razao_social)"),
    supabase
      .from("inspecoes")
      .select("id, created_at, necessita_manutencao, corrosao, funcionando, equipamentos(codigo_interno), clientes(razao_social)")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const equipamentos = (equipamentosRes.data as any[]) ?? [];

  // Contagem por tipo, para o gráfico
  const porTipoMap = new Map<string, number>();
  for (const eq of equipamentos) {
    porTipoMap.set(eq.tipo, (porTipoMap.get(eq.tipo) ?? 0) + 1);
  }
  const porTipo = Array.from(porTipoMap.entries())
    .map(([tipo, total]) => ({ tipo, total }))
    .sort((a, b) => b.total - a.total);

  // Alertas: vencidos / próximos, e lista dos 5 mais urgentes
  type Alerta = { codigo: string; cliente: string; tipoData: string; diasRestantes: number; label: string; severity: string };
  const alertas: Alerta[] = [];
  let equipamentosVencidos = 0;
  let equipamentosProximosVencer = 0;

  for (const eq of equipamentos) {
    const campos = [
      { label: "Inspeção", data: eq.proxima_inspecao },
      { label: "Recarga", data: eq.proxima_recarga },
      { label: "Teste hidrostático", data: eq.proximo_teste_hidrostatico },
    ];
    let piorSeveridade: string | null = null;
    for (const campo of campos) {
      const u = calcularUrgencia(campo.data);
      if (!u) continue;
      alertas.push({
        codigo: eq.codigo_interno,
        cliente: eq.clientes?.razao_social ?? "—",
        tipoData: campo.label,
        diasRestantes: u.diasRestantes,
        label: u.label,
        severity: u.severity,
      });
      if (u.severity === "vencido" || u.severity === "hoje") piorSeveridade = "vencido";
      else if (!piorSeveridade) piorSeveridade = "proximo";
    }
    if (piorSeveridade === "vencido") equipamentosVencidos++;
    else if (piorSeveridade === "proximo") equipamentosProximosVencer++;
  }

  alertas.sort((a, b) => a.diasRestantes - b.diasRestantes);

  return {
    clientesAtivos: clientesAtivosRes.count ?? 0,
    totalClientes: totalClientesRes.count ?? 0,
    totalEquipamentos: equipamentos.length,
    equipamentosVencidos,
    equipamentosProximosVencer,
    porTipo,
    proximosAlertas: alertas.slice(0, 5),
    ultimasInspecoes: (inspecoesRes.data as any[]) ?? [],
  };
}

export default async function DashboardPage() {
  const d = await getDashboardData();

  const cards = [
    { label: "Clientes ativos", value: d.clientesAtivos, sub: `${d.totalClientes} no total` },
    { label: "Equipamentos", value: d.totalEquipamentos, sub: "cadastrados" },
    { label: "Vencendo em breve", value: d.equipamentosProximosVencer, warn: true, sub: "próx. 90 dias" },
    { label: "Vencidos", value: d.equipamentosVencidos, danger: true, sub: "ação imediata" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-3xl">Dashboard</h1>
          <p className="text-sm text-brand-slate/70">Visão geral da operação, atualizada em tempo real.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/ifc"
            className="bg-white border border-brand-red text-brand-red text-sm px-4 py-2 rounded-md hover:bg-red-50 transition"
          >
            Índice FireControl
          </Link>
          <Link
            href="/pendencias"
            className="bg-brand-red text-white text-sm px-4 py-2 rounded-md hover:bg-brand-redDark transition"
          >
            Central de Pendências
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-lg border bg-white p-4 md:p-5 ${
              c.danger ? "border-brand-red" : c.warn ? "border-amber-400" : "border-black/5"
            }`}
          >
            <p className="text-xs md:text-sm text-brand-slate">{c.label}</p>
            <p
              className={`font-display text-3xl md:text-4xl mt-1 ${
                c.danger ? "text-brand-red" : c.warn ? "text-amber-500" : "text-brand-ink"
              }`}
            >
              {c.value}
            </p>
            <p className="text-[11px] text-brand-slate/50 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Gráfico */}
        <div className="lg:col-span-3 bg-white border border-black/5 rounded-lg p-4 md:p-5">
          <p className="font-display text-lg mb-2">Equipamentos por tipo</p>
          <EquipamentosPorTipoChart data={d.porTipo} />
        </div>

        {/* Próximos vencimentos */}
        <div className="lg:col-span-2 bg-white border border-black/5 rounded-lg p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-display text-lg">Próximos vencimentos</p>
            <Link href="/alertas" className="text-xs text-brand-red underline">
              ver todos
            </Link>
          </div>
          {d.proximosAlertas.length === 0 && (
            <p className="text-sm text-brand-slate/60">Nada vencendo nos próximos 90 dias.</p>
          )}
          <ul className="space-y-2.5">
            {d.proximosAlertas.map((a, i) => (
              <li key={i} className="flex items-center justify-between text-sm border-b border-black/5 pb-2 last:border-0">
                <div>
                  <p className="font-medium">{a.codigo}</p>
                  <p className="text-xs text-brand-slate/60">
                    {a.cliente} — {a.tipoData}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    a.severity === "vencido" || a.severity === "hoje"
                      ? "bg-red-100 text-red-700"
                      : a.severity === "critico"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-yellow-50 text-yellow-700"
                  }`}
                >
                  {a.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Atividade recente */}
      <div className="bg-white border border-black/5 rounded-lg p-4 md:p-5">
        <p className="font-display text-lg mb-3">Últimas inspeções</p>
        {d.ultimasInspecoes.length === 0 && (
          <p className="text-sm text-brand-slate/60">Nenhuma inspeção registrada ainda.</p>
        )}
        <ul className="space-y-2.5">
          {d.ultimasInspecoes.map((i) => {
            const ok = i.funcionando && !i.necessita_manutencao && !i.corrosao;
            return (
              <li key={i.id} className="flex items-center justify-between text-sm border-b border-black/5 pb-2 last:border-0">
                <div>
                  <p className="font-medium">{i.equipamentos?.codigo_interno ?? "—"}</p>
                  <p className="text-xs text-brand-slate/60">{i.clientes?.razao_social ?? "—"}</p>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {ok ? "OK" : "Atenção"}
                  </span>
                  <p className="text-[11px] text-brand-slate/50 mt-0.5">
                    {new Date(i.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
