"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Cliente, Equipamento, Inspecao } from "@/lib/types";
import {
  CHECKLIST_PADRAO,
  calcularResultado,
  getChecklistParaTipo,
  respostasPadrao,
} from "@/lib/checklists";
import { gerarInspecaoPdf } from "@/lib/pdf/inspecaoPdf";

const supabase = createClient();

// intervalo padrão até a próxima inspeção, em dias (ajustável por tipo no futuro)
const DIAS_PROXIMA_INSPECAO = 90;

export default function InspecoesPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [inspecoes, setInspecoes] = useState<Inspecao[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [equipamentoId, setEquipamentoId] = useState("");
  const [respostas, setRespostas] = useState<Record<string, boolean>>(respostasPadrao(CHECKLIST_PADRAO));
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gerandoPdfId, setGerandoPdfId] = useState<string | null>(null);

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
  const equipamentoSelecionado = equipamentos.find((e) => e.id === equipamentoId);

  // Checklist muda automaticamente de acordo com o tipo do equipamento selecionado
  const checklistAtual = useMemo(
    () => getChecklistParaTipo(equipamentoSelecionado?.tipo),
    [equipamentoSelecionado?.tipo]
  );

  function selecionarEquipamento(id: string) {
    setEquipamentoId(id);
    const eq = equipamentos.find((e) => e.id === id);
    setRespostas(respostasPadrao(getChecklistParaTipo(eq?.tipo)));
  }

  function toggle(key: string) {
    setRespostas((r) => ({ ...r, [key]: !r[key] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId || !equipamentoId || !equipamentoSelecionado) return;
    setSaving(true);
    setFeedback(null);

    const resultado = calcularResultado(checklistAtual, respostas);

    // 1. registra a inspeção
    await supabase.from("inspecoes").insert([
      {
        cliente_id: clienteId,
        equipamento_id: equipamentoId,
        tipo_equipamento_snapshot: equipamentoSelecionado.tipo,
        itens_checklist: respostas,
        resultado,
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

    await supabase
      .from("equipamentos")
      .update({
        ultima_inspecao: hoje.toISOString().slice(0, 10),
        proxima_inspecao: proxima.toISOString().slice(0, 10),
        status: resultado === "nao_conforme" ? "atencao" : "ok",
      })
      .eq("id", equipamentoId);

    setSaving(false);
    setFeedback("Inspeção registrada e status do equipamento atualizado.");
    setObservacoes("");
    setEquipamentoId("");
    setRespostas(respostasPadrao(CHECKLIST_PADRAO));
    loadBase();
    router.refresh();
  }

  async function handleDelete(id: string) {
    setError(null);
    const { error } = await supabase.from("inspecoes").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      setError(`Erro ao excluir inspeção: ${error.message}`);
      return;
    }
    loadBase();
    router.refresh();
  }

  function handleGerarPdf(inspecao: Inspecao) {
    setGerandoPdfId(inspecao.id);
    try {
      const cliente = clientes.find((c) => c.id === inspecao.cliente_id);
      const equipamento = equipamentos.find((e) => e.id === inspecao.equipamento_id);
      gerarInspecaoPdf(inspecao, cliente, equipamento);
    } finally {
      setGerandoPdfId(null);
    }
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
              selecionarEquipamento("");
            }}
          >
            <option value="">Cliente *</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.matricula ? `${c.matricula} — ` : ""}
                {c.razao_social}
              </option>
            ))}
          </select>
          <select
            required
            disabled={!clienteId}
            className="border rounded-md px-3 py-2 text-sm disabled:bg-brand-fog"
            value={equipamentoId}
            onChange={(e) => selecionarEquipamento(e.target.value)}
          >
            <option value="">Equipamento *</option>
            {equipamentosDoCliente.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.codigo_interno} — {eq.tipo}
              </option>
            ))}
          </select>
        </div>

        {equipamentoSelecionado && (
          <p className="text-xs text-brand-slate/60 mb-2">
            Checklist de <span className="font-medium">{equipamentoSelecionado.tipo}</span> — os itens abaixo
            mudam automaticamente conforme o tipo de equipamento selecionado.
          </p>
        )}
        <p className="text-sm font-medium text-brand-slate mb-2">Checklist</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {checklistAtual.map((item) => {
            const alerta = item.key.startsWith("necessita_manutencao");
            return (
              <label
                key={item.key}
                className={`flex items-center gap-2 text-sm ${alerta ? "text-brand-red" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={!!respostas[item.key]}
                  onChange={() => toggle(item.key)}
                />
                {item.label}
                {item.critico && !alerta && (
                  <span className="text-[10px] text-brand-slate/40">(crítico)</span>
                )}
              </label>
            );
          })}
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="bg-white border border-black/5 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-brand-fog text-left text-brand-slate">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Equipamento</th>
              <th className="px-4 py-3">Resultado</th>
              <th className="px-4 py-3">Observações</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {inspecoes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-brand-slate/60">
                  Nenhuma inspeção registrada ainda.
                </td>
              </tr>
            )}
            {inspecoes.map((i) => {
              const equip = equipamentos.find((e) => e.id === i.equipamento_id);
              const ok = i.resultado ? i.resultado === "conforme" : true;
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
                      {ok ? "Conforme" : "Não conforme"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{i.observacoes ?? "—"}</td>
                  <td className="px-4 py-3">
                    {deletingId === i.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDelete(i.id)}
                          className="text-xs text-white bg-brand-red px-2 py-1 rounded"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="text-xs px-2 py-1 rounded border"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleGerarPdf(i)}
                          disabled={gerandoPdfId === i.id}
                          className="text-xs text-brand-ink underline disabled:opacity-50"
                        >
                          {gerandoPdfId === i.id ? "Gerando..." : "Emitir PDF"}
                        </button>
                        <button
                          onClick={() => setDeletingId(i.id)}
                          className="text-xs text-brand-red underline"
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
