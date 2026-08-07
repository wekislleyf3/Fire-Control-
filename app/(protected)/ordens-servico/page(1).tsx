"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Cliente, Equipamento } from "@/lib/types";
import type { EventoAgenda } from "@/types/agendaEvento";
import type { OrdemServico, OrdemServicoInput, OrdemServicoItemInput, StatusOS, TipoOS } from "@/types/ordemServico";
import { STATUS_OS_LABEL, TIPO_OS_LABEL } from "@/types/ordemServico";
import { ordensServicoRepository } from "@/lib/repositories/ordensServicoRepository";
import { gerarOrdemServicoPdf, type AutenticacaoLaudo } from "@/lib/pdf/ordemServicoPdf";
import AssinaturaCanvas from "@/app/(protected)/components/AssinaturaCanvas";

const supabase = createClient();

const statusCor: Record<StatusOS, string> = {
  aberta: "bg-amber-100 text-amber-700",
  concluida: "bg-green-100 text-green-700",
  cancelada: "bg-gray-200 text-gray-500",
};

export default function OrdensServicoPage() {
  const { profile } = useAuth();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [eventos, setEventos] = useState<EventoAgenda[]>([]);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState<TipoOS>("vistoria");
  const [clienteId, setClienteId] = useState("");
  const [eventoId, setEventoId] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [responsavelTecnico, setResponsavelTecnico] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [equipamentosSelecionados, setEquipamentosSelecionados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  const [osConcluindo, setOsConcluindo] = useState<OrdemServico | null>(null);
  const [nomeAssinante, setNomeAssinante] = useState("");
  const [assinaturaDataUrl, setAssinaturaDataUrl] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState(false);
  const [gerandoPdfId, setGerandoPdfId] = useState<string | null>(null);

  async function carregarTudo() {
    setLoading(true);
    const [cl, eq, ev, os] = await Promise.all([
      supabase.from("clientes").select("*").order("razao_social"),
      supabase.from("equipamentos").select("*"),
      supabase.from("agenda_eventos").select("*").eq("status", "agendado").order("data"),
      ordensServicoRepository.list(supabase),
    ]);
    setClientes((cl.data as Cliente[]) ?? []);
    setEquipamentos((eq.data as Equipamento[]) ?? []);
    setEventos((ev.data as EventoAgenda[]) ?? []);
    setOrdens(os);
    setLoading(false);
  }

  useEffect(() => {
    carregarTudo();
  }, []);

  // Prefill a partir da Agenda: /ordens-servico?evento=...&cliente=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clienteUrl = params.get("cliente");
    const eventoUrl = params.get("evento");
    if (clienteUrl || eventoUrl) {
      if (clienteUrl) setClienteId(clienteUrl);
      if (eventoUrl) setEventoId(eventoUrl);
      setShowForm(true);
    }
  }, []);

  const equipamentosDoCliente = useMemo(
    () => equipamentos.filter((e) => e.cliente_id === clienteId),
    [equipamentos, clienteId]
  );
  const eventosDoCliente = useMemo(
    () => eventos.filter((e) => e.cliente_id === clienteId),
    [eventos, clienteId]
  );

  function toggleEquipamento(id: string) {
    setEquipamentosSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function resetForm() {
    setTipo("vistoria");
    setClienteId("");
    setEventoId("");
    setData(new Date().toISOString().slice(0, 10));
    setResponsavelTecnico("");
    setObservacoes("");
    setEquipamentosSelecionados(new Set());
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) {
      setError("Selecione um cliente.");
      return;
    }
    if (tipo === "vistoria" && equipamentosSelecionados.size === 0) {
      setError("Selecione ao menos um equipamento para vistoriar, ou use o tipo Levantamento se o cliente ainda não tem equipamentos cadastrados.");
      return;
    }
    setSalvando(true);
    setError(null);

    const input: OrdemServicoInput = {
      tipo,
      cliente_id: clienteId,
      evento_agenda_id: eventoId || null,
      data,
      responsavel_tecnico: responsavelTecnico || profile?.nome || null,
      observacoes: observacoes || null,
    };

    const itens: OrdemServicoItemInput[] =
      tipo === "vistoria"
        ? Array.from(equipamentosSelecionados).map((equipId) => {
            const eq = equipamentos.find((e) => e.id === equipId);
            return {
              equipamento_id: equipId,
              codigo_interno_snapshot: eq?.codigo_interno ?? null,
              tipo_equipamento_snapshot: eq?.tipo ?? null,
              localizacao_snapshot: eq?.localizacao ?? null,
              verificado: false,
              observacao: null,
            };
          })
        : [];

    try {
      await ordensServicoRepository.create(supabase, input, itens);
      resetForm();
      carregarTudo();
    } catch (err: any) {
      setError(`Erro ao gerar OS: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  }

  async function toggleVerificado(itemId: string, verificado: boolean) {
    await ordensServicoRepository.atualizarItem(supabase, itemId, { verificado });
    carregarTudo();
  }

  async function cancelarOs(id: string) {
    await ordensServicoRepository.atualizarStatus(supabase, id, "cancelada");
    carregarTudo();
  }

  function abrirConclusao(os: OrdemServico) {
    setOsConcluindo(os);
    setNomeAssinante("");
    setAssinaturaDataUrl(null);
  }

  async function confirmarConclusao() {
    if (!osConcluindo || !assinaturaDataUrl || !nomeAssinante.trim()) return;
    setConcluindo(true);
    setError(null);
    try {
      const caminho = `assinaturas/${osConcluindo.cliente_id}/${osConcluindo.id}-${Date.now()}.png`;
      const blob = await (await fetch(assinaturaDataUrl)).blob();
      const { error: uploadError } = await supabase.storage.from("firecontrol-files").upload(caminho, blob, {
        contentType: "image/png",
      });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from("firecontrol-files").getPublicUrl(caminho);

      await ordensServicoRepository.concluir(supabase, osConcluindo.id, {
        assinatura_cliente_url: urlData.publicUrl,
        assinatura_nome: nomeAssinante.trim(),
      });

      // Alimenta a linha do tempo de cada equipamento vistoriado nesta OS —
      // é o que conecta a Ordem de Serviço ao prontuário/histórico do
      // equipamento. Só registra os itens que o técnico de fato marcou como
      // verificado; item incluído na OS mas não conferido não vira evento.
      const numeroOs = `OS-${String(osConcluindo.numero).padStart(5, "0")}`;
      const itensVerificados = (osConcluindo.itens ?? []).filter((item) => item.verificado && item.equipamento_id);
      if (itensVerificados.length > 0) {
        const { error: historicoError } = await supabase.from("equipamento_historico").insert(
          itensVerificados.map((item) => ({
            equipamento_id: item.equipamento_id,
            data: osConcluindo.data,
            evento: `Vistoria (${numeroOs})`,
            observacoes: item.observacao,
          }))
        );
        if (historicoError) {
          console.error("[ordens-servico] falha ao registrar histórico do equipamento:", historicoError);
        }
      }

      setOsConcluindo(null);
      carregarTudo();
    } catch (err: any) {
      setError(`Erro ao concluir OS: ${err.message}`);
    } finally {
      setConcluindo(false);
    }
  }

  async function baixarPdfDaOs(os: OrdemServico) {
    setGerandoPdfId(os.id);
    setError(null);
    try {
      const cliente = clientes.find((c) => c.id === os.cliente_id);

      let autenticacao: AutenticacaoLaudo | null = null;
      try {
        const resp = await fetch("/api/laudos/emitir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipoDocumento: "ordem_servico", ordemServicoId: os.id }),
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
          }
        }
      } catch (err) {
        console.error("[selo] falha de rede ao chamar /api/laudos/emitir:", err);
      }

      await gerarOrdemServicoPdf(os, cliente, autenticacao);
    } finally {
      setGerandoPdfId(null);
    }
  }

  function nomeCliente(id: string) {
    return clientes.find((c) => c.id === id)?.razao_social ?? "—";
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-brand-ink">Ordens de Serviço</h1>
          <p className="text-sm text-brand-slate/60">
            Gere OS para visitas de inspeção periódica — comprovante de que a vistoria foi realizada, com
            assinatura do cliente.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-brand-red text-white"
        >
          {showForm ? "Cancelar" : "+ Nova OS"}
        </button>
      </div>

      {error && <p className="text-sm text-brand-red bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-black/5 rounded-lg p-4 mb-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-brand-slate/70">Tipo de OS</label>
            <div className="grid sm:grid-cols-2 gap-2 mt-1.5">
              {(Object.keys(TIPO_OS_LABEL) as TipoOS[]).map((t) => (
                <label
                  key={t}
                  className={`flex items-start gap-2.5 border rounded-lg px-3 py-2.5 text-sm cursor-pointer ${
                    tipo === t ? "border-brand-red bg-red-50" : "border-black/10"
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo-os"
                    checked={tipo === t}
                    onChange={() => setTipo(t)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium text-brand-ink">{TIPO_OS_LABEL[t]}</span>
                    <span className="block text-xs text-brand-slate/50 mt-0.5">
                      {t === "vistoria"
                        ? "Lista os equipamentos já cadastrados do cliente para vistoriar."
                        : "Para clientes na fase inicial, sem equipamentos cadastrados ainda."}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-brand-slate/70">Cliente</label>
              <select
                value={clienteId}
                onChange={(e) => {
                  setClienteId(e.target.value);
                  setEventoId("");
                  setEquipamentosSelecionados(new Set());
                }}
                required
                className="w-full mt-1 border border-black/10 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Selecione...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.razao_social}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-brand-slate/70">Evento da agenda (opcional)</label>
              <select
                value={eventoId}
                onChange={(e) => setEventoId(e.target.value)}
                disabled={!clienteId}
                className="w-full mt-1 border border-black/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">Nenhum — OS avulsa</option>
                {eventosDoCliente.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.titulo} · {new Date(ev.data + "T00:00:00").toLocaleDateString("pt-BR")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-brand-slate/70">Data da visita</label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
                className="w-full mt-1 border border-black/10 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-brand-slate/70">Técnico responsável</label>
              <input
                type="text"
                value={responsavelTecnico}
                onChange={(e) => setResponsavelTecnico(e.target.value)}
                placeholder={profile?.nome ?? "Nome do técnico"}
                className="w-full mt-1 border border-black/10 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {tipo === "vistoria" && (
            <div>
              <label className="text-xs font-medium text-brand-slate/70">
                Equipamentos a vistoriar {clienteId && `(${equipamentosDoCliente.length} do cliente)`}
              </label>
              {!clienteId ? (
                <p className="text-xs text-brand-slate/50 mt-1">Selecione um cliente para listar os equipamentos.</p>
              ) : equipamentosDoCliente.length === 0 ? (
                <p className="text-xs text-brand-slate/50 mt-1">
                  Este cliente ainda não tem equipamentos cadastrados — use o tipo "Levantamento / cadastro de
                  equipamentos" acima.
                </p>
              ) : (
                <div className="mt-1.5 border border-black/10 rounded-lg divide-y divide-black/5 max-h-64 overflow-y-auto">
                  {equipamentosDoCliente.map((eq) => (
                    <label key={eq.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-brand-fog">
                      <input
                        type="checkbox"
                        checked={equipamentosSelecionados.has(eq.id)}
                        onChange={() => toggleEquipamento(eq.id)}
                      />
                      <span className="font-mono text-xs text-brand-slate/60">{eq.codigo_interno}</span>
                      <span>{eq.tipo}</span>
                      <span className="text-xs text-brand-slate/50 ml-auto">{eq.localizacao ?? "sem localização"}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-brand-slate/70">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className="w-full mt-1 border border-black/10 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={salvando}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-brand-red text-white disabled:opacity-50"
          >
            {salvando ? "Gerando..." : "Gerar OS"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-center text-brand-slate/60 py-6">Carregando ordens de serviço...</p>
      ) : ordens.length === 0 ? (
        <p className="text-sm text-brand-slate/50 py-6 text-center">Nenhuma OS gerada ainda.</p>
      ) : (
        <div className="space-y-3">
          {ordens.map((os) => (
            <div key={os.id} className="bg-white border border-black/5 rounded-lg p-4">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-semibold text-brand-ink">
                    OS-{String(os.numero).padStart(5, "0")} · {nomeCliente(os.cliente_id)}
                  </p>
                  <p className="text-xs text-brand-slate/60 mt-0.5">
                    {new Date(os.data + "T00:00:00").toLocaleDateString("pt-BR")}
                    {os.responsavel_tecnico && ` · ${os.responsavel_tecnico}`}
                    {" · "}
                    {os.tipo === "levantamento" ? "Levantamento / cadastro" : `${os.itens?.length ?? 0} equipamento(s)`}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusCor[os.status]}`}>
                  {STATUS_OS_LABEL[os.status]}
                </span>
              </div>

              {os.itens && os.itens.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {os.itens.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 text-xs text-brand-slate/70">
                      <input
                        type="checkbox"
                        checked={item.verificado}
                        disabled={os.status !== "aberta"}
                        onChange={(e) => toggleVerificado(item.id, e.target.checked)}
                      />
                      <span className="font-mono">
                        {item.equipamento_id ? (
                          <Link href={`/equipamentos/${item.equipamento_id}`} className="text-brand-red hover:underline">
                            {item.codigo_interno_snapshot ?? "—"}
                          </Link>
                        ) : (
                          item.codigo_interno_snapshot ?? "—"
                        )}
                      </span>
                      <span>{item.tipo_equipamento_snapshot ?? "—"}</span>
                      <span className="text-brand-slate/50 ml-auto">{item.localizacao_snapshot ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-black/5">
                <button
                  onClick={() => baixarPdfDaOs(os)}
                  disabled={gerandoPdfId === os.id}
                  className="text-xs font-medium text-brand-red underline disabled:opacity-50"
                >
                  {gerandoPdfId === os.id ? "gerando PDF..." : "baixar PDF"}
                </button>
                {os.status === "aberta" && (
                  <>
                    <button onClick={() => abrirConclusao(os)} className="text-xs font-medium text-green-700 underline">
                      concluir com assinatura
                    </button>
                    <button onClick={() => cancelarOs(os.id)} className="text-xs text-brand-slate/50 underline">
                      cancelar
                    </button>
                  </>
                )}
                {os.status === "concluida" && os.assinatura_nome && (
                  <span className="text-xs text-brand-slate/50">
                    assinado por {os.assinatura_nome}
                    {os.assinatura_data && ` em ${new Date(os.assinatura_data).toLocaleDateString("pt-BR")}`}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {osConcluindo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-5 w-full max-w-md">
            <h2 className="text-base font-semibold text-brand-ink mb-1">
              Concluir OS-{String(osConcluindo.numero).padStart(5, "0")}
            </h2>
            <p className="text-xs text-brand-slate/60 mb-4">
              Colete a assinatura do cliente no local para comprovar a realização da visita.
            </p>

            <label className="text-xs font-medium text-brand-slate/70">Nome de quem está assinando</label>
            <input
              type="text"
              value={nomeAssinante}
              onChange={(e) => setNomeAssinante(e.target.value)}
              className="w-full mt-1 mb-3 border border-black/10 rounded-lg px-3 py-2 text-sm"
              placeholder="Nome completo"
            />

            <label className="text-xs font-medium text-brand-slate/70 mb-1 block">Assinatura</label>
            <AssinaturaCanvas onChange={setAssinaturaDataUrl} />

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setOsConcluindo(null)} className="text-sm text-brand-slate/60">
                Cancelar
              </button>
              <button
                onClick={confirmarConclusao}
                disabled={concluindo || !assinaturaDataUrl || !nomeAssinante.trim()}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-brand-red text-white disabled:opacity-50"
              >
                {concluindo ? "Salvando..." : "Confirmar conclusão"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
