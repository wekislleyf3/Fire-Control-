"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
import type { Cliente, Equipamento } from "@/lib/types";

const TIPOS = [
  "Extintor",
  "Mangueira",
  "Hidrante",
  "Mangotinho",
  "Porta corta-fogo",
  "Iluminação de emergência",
  "Placa",
  "Alarme",
  "Detector",
  "Sprinkler",
  "Bomba",
  "Central de incêndio",
];

const statusColor: Record<string, string> = {
  ok: "bg-green-100 text-green-700",
  atencao: "bg-amber-100 text-amber-700",
  vencido: "bg-red-100 text-red-700",
};

export default function EquipamentosPage() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [form, setForm] = useState({
    codigo_interno: "",
    cliente_id: "",
    tipo: TIPOS[0],
    fabricante: "",
    numero_serie: "",
    localizacao: "",
  });

  async function loadData() {
    setLoading(true);
    const [eq, cl] = await Promise.all([
      supabase.from("equipamentos").select("*").order("created_at", { ascending: false }),
      supabase.from("clientes").select("*").order("razao_social"),
    ]);
    setEquipamentos((eq.data as Equipamento[]) ?? []);
    setClientes((cl.data as Cliente[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.codigo_interno || !form.cliente_id) return;
    await supabase.from("equipamentos").insert([form]);
    setForm({
      codigo_interno: "",
      cliente_id: "",
      tipo: TIPOS[0],
      fabricante: "",
      numero_serie: "",
      localizacao: "",
    });
    setShowForm(false);
    loadData();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl">Equipamentos</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-brand-red text-white text-sm px-4 py-2 rounded-md hover:bg-brand-redDark transition"
        >
          {showForm ? "Cancelar" : "+ Novo equipamento"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-black/5 rounded-lg p-5 mb-6 grid grid-cols-2 gap-4"
        >
          <input
            required
            placeholder="Código interno (ex: FC-EXT-000001) *"
            className="border rounded-md px-3 py-2 text-sm col-span-2"
            value={form.codigo_interno}
            onChange={(e) => setForm({ ...form, codigo_interno: e.target.value })}
          />
          <select
            required
            className="border rounded-md px-3 py-2 text-sm"
            value={form.cliente_id}
            onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
          >
            <option value="">Cliente *</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razao_social}
              </option>
            ))}
          </select>
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          >
            {TIPOS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            placeholder="Fabricante"
            className="border rounded-md px-3 py-2 text-sm"
            value={form.fabricante}
            onChange={(e) => setForm({ ...form, fabricante: e.target.value })}
          />
          <input
            placeholder="Número de série"
            className="border rounded-md px-3 py-2 text-sm"
            value={form.numero_serie}
            onChange={(e) => setForm({ ...form, numero_serie: e.target.value })}
          />
          <input
            placeholder="Localização (setor/pavimento)"
            className="border rounded-md px-3 py-2 text-sm col-span-2"
            value={form.localizacao}
            onChange={(e) => setForm({ ...form, localizacao: e.target.value })}
          />
          <button className="col-span-2 bg-brand-ink text-white text-sm py-2 rounded-md">
            Salvar equipamento
          </button>
        </form>
      )}

      <div className="bg-white border border-black/5 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-fog text-left text-brand-slate">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Localização</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">QR</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-brand-slate/60">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && equipamentos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-brand-slate/60">
                  Nenhum equipamento cadastrado ainda.
                </td>
              </tr>
            )}
            {equipamentos.map((eq) => (
              <tr key={eq.id} className="border-t border-black/5">
                <td className="px-4 py-3 font-medium">{eq.codigo_interno}</td>
                <td className="px-4 py-3">{eq.tipo}</td>
                <td className="px-4 py-3">{eq.localizacao}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor[eq.status]}`}>
                    {eq.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setQrFor(qrFor === eq.id ? null : eq.id)}
                    className="text-brand-red text-xs underline"
                  >
                    {qrFor === eq.id ? "ocultar" : "ver QR"}
                  </button>
                  {qrFor === eq.id && (
                    <div className="mt-2">
                      <QRCodeSVG value={`${eq.codigo_interno}`} size={80} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
