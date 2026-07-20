import { supabase } from "@/lib/supabaseClient";

async function getStats() {
  const [clientesAtivos, totalEquipamentos, vencidos, proximosVencer] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("equipamentos").select("id", { count: "exact", head: true }),
    supabase.from("equipamentos").select("id", { count: "exact", head: true }).eq("status", "vencido"),
    supabase.from("equipamentos").select("id", { count: "exact", head: true }).eq("status", "atencao"),
  ]);

  return {
    clientesAtivos: clientesAtivos.count ?? 0,
    totalEquipamentos: totalEquipamentos.count ?? 0,
    vencidos: vencidos.count ?? 0,
    proximosVencer: proximosVencer.count ?? 0,
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
      <p className="text-sm text-brand-slate/70 mt-8">
        Próximos passos: cadastre clientes e equipamentos para ver os dados aqui.
      </p>
    </div>
  );
}
