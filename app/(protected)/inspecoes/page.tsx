"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
import type { Cliente, Equipamento, Inspecao } from "@/lib/types";

const CHECKLIST_ITEMS: { key: keyof typeof defaultChecklist; label: string }[] = [
  { key: "funcionando", label: "Equipamento funcionando?" },
  { key: "lacre_integro", label: "Lacre íntegro?" },
  { key: "manometro_correto", label: "Manômetro na faixa correta?" },
  { key: "acesso_livre", label: "Acesso livre e desobstruído?" },
  { key: "sinalizacao_correta", label: "Sinalização correta?" },
];

const defaultChecklist = {
  funcionando: true,
  lacre_integro: true,
  manometro_correto: true,
  acesso_livre: true,
  sinalizacao_correta: true,
  corrosao: false,
  necessita_manutencao: false,
};

// intervalo padrão até a próxima inspeção, em dias (ajustável por tipo no futuro)
const DIAS_PROXIMA_INSPECAO = 90;

export default function InspecoesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [inspecoes, setInspecoes] = useState<Inspecao[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [equipamentoId, setEquipamentoId] = useState("");
  const [checklist, setChecklist] = useState({ ...defaultChecklist });
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadBase() {
    const [cl, eq, insp] = await Promise.all([
      supabase.from("clientes").select("*").order("razao_social"),
      supabase.from("equipamentos").select("*"),
      supabase
        .from("inspecoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);
    setClientes((cl.data as Cliente[]) ?? []);
    setEquipamentos((eq.data as Equipamento[]) ?? []);
    setInspecoes((insp.data as Inspecao[]) ?? []);
  }

  useEffect(() => {
    loadBase();
  }, []);

  const equipamentosDoCliente = equipamentos.filter((e) => e.cliente_id === clienteId);

  function toggle(key: keyof typeof defaultChecklist) {
    setChecklist((c) => ({ ...c, [key]: !c[key] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId || !equipamentoId) return;
    setSaving(true);
    setFeedback(null);

    // 1. registra a inspeção
    await supabase.from("inspecoes").insert([
      {
        cliente_id: clienteId,
        equipamento_id: equipamentoId,
        ...checklist,
        observacoes: observacoes || null,
      },
    ]);

    // 2. registra no histórico permanente do equipamento
    await supabase.from("equipamento_historico").insert([
      {
        equipamento_id: equipamentoId,
        evento: "Inspeção realizada",
        observacoes: observacoes || null,
      },
    ]);

    // 3. atualiza datas e status do equipamento
    const hoje = new Date();
    const proxima = new Date(hoje);
    proxima.setDate(proxima.getDate() + DIAS_PROXIMA_INSPECAO);

    const novoStatus =
      checklist.necessita_manutencao || checklist.corrosao || !checklist.funcionando
        ? "atencao"
        : "ok";

    await supabase
      .from("equipamentos")
      .update({
        ultima_inspecao: hoje.toISOString().slice(0, 10),
        proxima_inspecao: proxima.toISOString().slice(0, 10),
        status: novoStatus,
      })
      .eq("id", equipamentoId);

    setSaving(false);
    setFeedback("Inspeção registrada e status do equipamento atualizado.");
    setChecklist({ ...defaultChecklist });
    setObservacoes("");
    setEquipamentoId("");
    loadBase();
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-6">Inspeções</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-black/5 rounded-lg p-5 mb-8">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <select
            required
            className="border rounded-md px-3 py-2 text-sm"
            value={clienteId}
            onChange={(e) => {
              setClienteId(e.target.value);
              setEquipamentoId("");
            }}
          >
            <option value="">Cliente *</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razao_social}
              </option>
            ))}
          </select>
          <select
            required
            disabled={!clienteId}
            className="border rounded-md px-3 py-2 text-sm disabled:bg-brand-fog"
            value={equipamentoId}
            onChange={(e) => setEquipamentoId(e.target.value)}
          >
            <option value="">Equipamento *</option>
            {equipamentosDoCliente.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.codigo_interno} — {eq.tipo}
              </option>
            ))}
          </select>
        </div>

        <p className="text-sm font-medium text-brand-slate mb-2">Checklist</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {CHECKLIST_ITEMS.map((item) => (
            <label key={item.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={checklist[item.key]}
                onChange={() => toggle(item.key)}
              />
              {item.label}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm text-brand-red">
            <input
              type="checkbox"
              checked={checklist.corrosao}
              onChange={() => toggle("corrosao")}
            />
            Apresenta corrosão?
          </label>
          <label className="flex items-center gap-2 text-sm text-brand-red">
            <input
              type="checkbox"
              checked={checklist.necessita_manutencao}
              onChange={() => toggle("necessita_manutencao")}
            />
            Necessita manutenção?
          </label>
        </div>

        <textarea
          placeholder="Observações"
          className="border rounded-md px-3 py-2 text-sm w-full mb-4"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />

        <button
          disabled={saving}
          className="bg-brand-red text-white text-sm px-5 py-2 rounded-md hover:bg-brand-redDark transition disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Finalizar inspeção"}
        </button>
        {feedback && <p className="text-sm text-green-700 mt-3">{feedback}</p>}
      </form>

      <h2 className="font-display text-xl mb-3">Últimas inspeções</h2>
      <div className="bg-white border border-black/5 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-fog text-left text-brand-slate">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Equipamento</th>
              <th className="px-4 py-3">Resultado</th>
              <th className="px-4 py-3">Observações</th>
            </tr>
          </thead>
          <tbody>
            {inspecoes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-brand-slate/60">
                  Nenhuma inspeção registrada ainda.
                </td>
              </tr>
            )}
            {inspecoes.map((i) => {
              const equip = equipamentos.find((e) => e.id === i.equipamento_id);
              const ok = !i.necessita_manutencao && !i.corrosao && i.funcionando;
              return (
                <tr key={i.id} className="border-t border-black/5">
                  <td className="px-4 py-3">{new Date(i.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3">{equip?.codigo_interno ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {ok ? "OK" : "Necessita atenção"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{i.observacoes ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
