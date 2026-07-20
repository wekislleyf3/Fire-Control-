import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calcularUrgencia } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getStats() {
  const supabase = createClient();
  const [clientesAtivos, equipamentosRes] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("status", "ativo"),
    supabase
      .from("equipamentos")
      .select("id, proxima_inspecao, proxima_recarga, proximo_teste_hidrostatico"),
  ]);

  const equipamentos = equipamentosRes.data ?? [];
  let vencidos = 0;
  let proximosVencer = 0;

  for (const eq of equipamentos) {
    const urgencias = [
      calcularUrgencia(eq.proxima_inspecao),
      calcularUrgencia(eq.proxima_recarga),
      calcularUrgencia(eq.proximo_teste_hidrostatico),
    ].filter(Boolean) as { severity: string }[];

    if (urgencias.some((u) => u.severity === "vencido" || u.severity === "hoje")) vencidos++;
    else if (urgencias.length > 0) proximosVencer++;
  }

  return {
    clientesAtivos: clientesAtivos.count ?? 0,
    totalEquipamentos: equipamentos.length,
    vencidos,
    proximosVencer,
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

  const cards = [
    { label: "Clientes ativos", value: stats.clientesAtivos },
    { label: "Equipamentos cadastrados", value: stats.totalEquipamentos },
    { label: "Vencendo em breve", value: stats.proximosVencer, warn: true },
    { label: "Equipamentos vencidos", value: stats.vencidos, danger: true },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-lg border bg-white p-5 ${
              c.danger ? "border-brand-red" : c.warn ? "border-amber-400" : "border-black/5"
            }`}
          >
            <p className="text-sm text-brand-slate">{c.label}</p>
            <p
              className={`font-display text-4xl mt-1 ${
                c.danger ? "text-brand-red" : c.warn ? "text-amber-500" : "text-brand-ink"
              }`}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>
      {(stats.vencidos > 0 || stats.proximosVencer > 0) && (
        <Link
          href="/alertas"
          className="inline-block mt-6 text-sm text-brand-red underline"
        >
          Ver detalhes dos alertas →
        </Link>
      )}
      <p className="text-sm text-brand-slate/70 mt-4">
        Próximos passos: cadastre clientes e equipamentos para ver os dados aqui.
      </p>
    </div>
  );
}
