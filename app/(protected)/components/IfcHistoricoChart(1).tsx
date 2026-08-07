"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function IfcHistoricoChart({ data }: { data: { mes: string; score: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-brand-slate/60">
        Ainda não há histórico. Registre o IFC deste mês pra começar a acompanhar a evolução.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -20, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#3A3D42" }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#3A3D42" }} />
        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13, border: "1px solid #eee" }} />
        <Line type="monotone" dataKey="score" stroke="#C81E1E" strokeWidth={2.5} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
