"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const CORES = ["#C81E1E", "#3A3D42", "#8F1414", "#6B6E73", "#E5A823", "#1C1C1E"];

export default function EquipamentosPorTipoChart({ data }: { data: { tipo: string; total: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-brand-slate/60">
        Cadastre equipamentos para ver o gráfico.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
        <XAxis
          dataKey="tipo"
          tick={{ fontSize: 11, fill: "#3A3D42" }}
          interval={0}
          angle={-25}
          textAnchor="end"
          height={60}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#3A3D42" }} />
        <Tooltip
          contentStyle={{ borderRadius: 8, fontSize: 13, border: "1px solid #eee" }}
          cursor={{ fill: "#F2F3F5" }}
        />
        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={CORES[i % CORES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
