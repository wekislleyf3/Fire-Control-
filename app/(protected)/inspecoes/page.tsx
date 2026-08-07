"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Cliente, Equipamento, Inspecao } from "@/lib/types";
import { inspecoesService, ValidationError } from "@/lib/services/inspecoesService";
import { clientesService } from "@/lib/services/clientesService";
import { equipamentosService } from "@/lib/services/equipamentosService";
import {
  CHECKLIST_PADRAO,
  calcularResultado,
  respostasPadrao,
} from "@/lib/checklists";
import { getChecklistDoProcedimento } from "@/lib/metodoFire";
import { gerarInspecaoPdf, type AutenticacaoLaudo } from "@/lib/pdf/inspecaoPdf";

const supabase = createClient();

export default function InspecoesPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
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
      clientesService.list(supabase),
      equipamentosService.list(supabase),
      inspecoesService.listRecentes(supabase, 15),
    ]);
    setClientes([...cl].sort((a, b) => a.razao_social.localeCompare(b.razao_social)));
    setEquipamentos(eq);
    setInspecoes(insp);
  }

  useEffect(() => {
    async function init() {
      await loadBase();

      const params = new URLSearchParams(window.location.search);
      const clienteUrl = params.get("cliente");
      const equipamentoUrl = params.get("equipamento");

      if (clienteUrl) setClienteId(clienteUrl);
      if (equipamentoUrl) setEquipamentoId(equipamentoUrl);
    }
    init();
  }, []);

  const equipamentosDoCliente = equipamentos.filter((e) => e.cliente_id === clienteId);
  const equipamentoSelecionado = equipamentos.find((e) => e.id === equipamentoId);

  // Checklist muda automaticamente de acordo com o tipo do equipamento
  // selecionado — busca um procedimento customizado (Método Fire) se
  // existir, senão usa o checklist padrão do sistema.
  const [checklistAtual, setChecklistAtual] = useState(CHECKLIST_PADRAO);
  useEffect(() => {
    let cancelado = false;
    getChecklistDoProcedimento(supabase, equipamentoSelecionado?.tipo).then((itens) => {
      if (cancelado) return;
      setChecklistAtual(itens);
      setRespostas(respostasPadrao(itens));
    });
    return () => {
      cancelado = true;
    };
  }, [equipamentoSelecionado?.tipo]);

  // Item "necessita manutenção" tem semântica invertida (marcar = problema),
  // então é exibido separado dos itens normais de conformidade.
  const itensVerificacao = useMemo(
    () => checklistAtual.filter((item) => !item.key.startsWith("necessita_manutencao")),
    [checklistAtual]
  );
  const itensManutencao = useMemo(
    () => checklistAtual.filter((item) => item.key.startsWith("necessita_manutencao")),
    [checklistAtual]
  );

  const previaResultado = useMemo(
    () => (checklistAtual.length > 0 ? calcularResultado(checklistAtual, respostas) : null),
    [checklistAtual, respostas]
  );

  function selecionarEquipamento(id: string) {
    setEquipamentoId(id);
  }

  function toggle(key: string) {
    setRespostas((r) => ({ ...r, [key]: !r[key] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId || !equipamentoId || !equipamentoSelecionado) return;
    setSaving(true);
    setFeedback(null);
    setError(null);

    const responsavelTecnico = profile?.nome || user?.email || null;

    try {
      await inspecoesService.registrar(supabase, {
        clienteId,
        equipamento: equipamentoSelecionado,
        itensChecklist: respostas,
        observacoes: observacoes || null,
        responsavelTecnico,
      });

      setFeedback("Inspeção registrada e status do equipamento atualizado.");
      setObservacoes("");
      setEquipamentoId("");
      setRespostas(respostasPadrao(CHECKLIST_PADRAO));
      loadBase();
      router.refresh();
    } catch (err) {
      const mensagem =
        err instanceof ValidationError ? err.message : `Erro ao registrar inspeção: ${(err as Error).message}`;
      setError(mensagem);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await inspecoesService.remove(supabase, id);
      loadBase();
      router.refresh();
    } catch (err) {
      setError(`Erro ao excluir inspeção: ${(err as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleGerarPdf(inspecao: Inspecao) {
    setGerandoPdfId(inspecao.id);
    setError(null);
    try {
      const cliente = clientes.find((c) => c.id === inspecao.cliente_id);
      const equipamento = equipamentos.find((e) => e.id === inspecao.equipamento_id);

      let autenticacao: AutenticacaoLaudo | null = null;
      try {
        const resp = await fetch("/api/laudos/emitir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inspecaoId: inspecao.id }),
        });

        if (!resp.ok) {
          const corpoErro = await resp.text().catch(() => "");
          console.error(`[selo] /api/laudos/emitir respondeu ${resp.status}:`, corpoErro);
          setError(`Falha ao emitir o selo (HTTP ${resp.status}): ${corpoErro.slice(0, 200)}`);
        } else {
          const data = await resp.json();
          if (data?.token && data?.hash && data?.dataEmissao) {
            autenticacao = { token: data.token, hash: data.hash, dataEmissao: data.dataEmissao };
          } else {
            console.error("[selo] resposta de /api/laudos/emitir sem token/hash/dataEmissao:", data);
            setError(`Selo emitido incompleto: ${JSON.stringify(data).slice(0, 200)}`);
          }
        }
      } catch (err) {
        console.error("[selo] falha de rede ao chamar /api/laudos/emitir:", err);
        setError(`Falha de rede ao emitir o selo: ${(err as Error).message}`);
      }

      await gerarInspecaoPdf(inspecao, cliente, equipamento, autenticacao);
    } catch (err) {
      console.error("[pdf] falha ao gerar o PDF da inspeção:", err);
      setError(`Erro ao gerar o PDF: ${(err as Error).message}`);
    } finally {
      setGerandoPdfId(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-6">Inspeções</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-black/5 rounded-lg p-5 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
          <div className="bg-brand-fog border border-black/5 rounded-md px-3 py-2 mb-3">
            <p className="text-sm font-medium text-brand-slate">
              Checklist técnico — <span className="font-semibold">{equipamentoSelecionado.tipo}</span>
            </p>
            <p className="text-xs text-brand-slate/60 mt-0.5">
              {itensVerificacao.length} {itensVerificacao.length === 1 ? "item aplicável" : "itens aplicáveis"} a
              este tipo de equipamento — os itens mudam automaticamente conforme o tipo selecionado (ex:
              mangueiras e luminárias de emergência não têm item de manômetro, que só existe para extintores).
            </p>
          </div>
        )}

        <div className="space-y-2 mb-3">
          {itensVerificacao.map((item) => {
            const conforme = !!respostas[item.key];
            return (
              <div
                key={item.key}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-black/5 rounded-md px-3 py-2"
              >
                <p className="text-sm flex items-center gap-2">
                  {item.label}
                  {item.critico && (
                    <span className="text-[10px] font-semibold text-brand-red border border-brand-red/40 rounded px-1.5 py-0.5">
                      CRÍTICO
                    </span>
                  )}
                </p>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setRespostas((r) => ({ ...r, [item.key]: true }))}
                    className={`px-3 py-1 text-xs font-semibold rounded-md border transition ${
                      conforme
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white text-brand-slate/70 border-black/10 hover:bg-brand-fog"
                    }`}
                  >
                    Conforme
                  </button>
                  <button
                    type="button"
                    onClick={() => setRespostas((r) => ({ ...r, [item.key]: false }))}
                    className={`px-3 py-1 text-xs font-semibold rounded-md border transition ${
                      !conforme
                        ? "bg-brand-red text-white border-brand-red"
                        : "bg-white text-brand-slate/70 border-black/10 hover:bg-brand-fog"
                    }`}
                  >
                    Não conforme
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {itensManutencao.length > 0 && (
          <div className="space-y-2 mb-3">
            {itensManutencao.map((item) => {
              const precisaManutencao = !!respostas[item.key];
              return (
                <label
                  key={item.key}
                  className="flex items-center gap-2 text-sm border border-amber-300 bg-amber-50 rounded-md px-3 py-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={precisaManutencao}
                    onChange={() => toggle(item.key)}
                  />
                  <span className="text-amber-800">{item.label}</span>
                </label>
              );
            })}
          </div>
        )}

        {equipamentoSelecionado && (
          <div
            className={`text-xs font-medium rounded-md px-3 py-2 mb-4 ${
              previaResultado === "conforme"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-brand-red border border-red-200"
            }`}
          >
            Prévia do resultado: {previaResultado === "conforme" ? "Conforme" : "Não conforme"}
          </div>
        )}

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

      {/* Celular: lista de cards */}
      <div className="sm:hidden space-y-3">
        {inspecoes.length === 0 && <p className="text-center text-brand-slate/60 py-6">Nenhuma inspeção registrada ainda.</p>}
        {inspecoes.map((i) => {
          const equip = equipamentos.find((e) => e.id === i.equipamento_id);
          const ok = i.resultado ? i.resultado === "conforme" : true;
          return (
            <div key={i.id} className="bg-white border border-black/5 rounded-lg p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{equip?.codigo_interno ?? "—"}</p>
                  <p className="text-xs text-brand-slate/60">{new Date(i.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {ok ? "Conforme" : "Não conforme"}
                </span>
              </div>
              {i.observacoes && <p className="text-xs text-brand-slate/60 mt-2">{i.observacoes}</p>}

              <div className="flex flex-wrap gap-2 mt-3">
                {deletingId === i.id ? (
                  <>
                    <button onClick={() => handleDelete(i.id)} className="text-xs text-white bg-brand-red px-2 py-1 rounded">
                      Confirmar exclusão
                    </button>
                    <button onClick={() => setDeletingId(null)} className="text-xs px-2 py-1 rounded border">
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleGerarPdf(i)}
                      disabled={gerandoPdfId === i.id}
                      className="text-xs px-2 py-1 rounded border disabled:opacity-50"
                    >
                      {gerandoPdfId === i.id ? "Gerando..." : "Emitir PDF"}
                    </button>
                    <button onClick={() => setDeletingId(i.id)} className="text-xs px-2 py-1 rounded border text-brand-red">
                      Excluir
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tablet/desktop: tabela completa */}
      <div className="hidden sm:block bg-white border border-black/5 rounded-lg overflow-x-auto">
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
