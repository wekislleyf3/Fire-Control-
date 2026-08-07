"use client";

import { useEffect, Fragment, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Home, ClipboardCheck, Droplets, Wrench, Gauge, CircleDot, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Cliente, Equipamento, Inspecao, Documento } from "@/lib/types";
import type { StatusOS, TipoOS } from "@/types/ordemServico";
import { STATUS_OS_LABEL, TIPO_OS_LABEL } from "@/types/ordemServico";
import { getEspecificacoesSchema } from "@/lib/equipamentos/especificacoesSchemas";
import { gerarEtiquetaEquipamento, type TamanhoEtiqueta } from "@/lib/pdf/etiquetaEquipamento";
import { gerarInspecaoPdf, type AutenticacaoLaudo } from "@/lib/pdf/inspecaoPdf";

const statusColor: Record<string, string> = {
  ok: "bg-green-100 text-green-700",
  atencao: "bg-amber-100 text-amber-700",
  vencido: "bg-red-100 text-red-700",
};

const statusCorOs: Record<StatusOS, string> = {
  aberta: "bg-amber-100 text-amber-700",
  concluida: "bg-green-100 text-green-700",
  cancelada: "bg-gray-200 text-gray-500",
};

/** Opções pra registrar manualmente um evento na linha do tempo. */
const TIPOS_EVENTO_MANUAL = ["Recarga", "Troca de peça", "Teste hidrostático", "Manutenção", "Outro"] as const;

/** Escolhe o ícone da linha do tempo com base no texto do evento — cobre os
 * eventos que o próprio sistema já gera ("Inspeção realizada") e os tipos
 * oferecidos no formulário manual abaixo. */
function iconePorEvento(evento: string) {
  const e = evento.toLowerCase();
  if (e.includes("instala")) return Home;
  if (e.includes("inspe")) return ClipboardCheck;
  if (e.includes("recarga")) return Droplets;
  if (e.includes("troca") || e.includes("peça") || e.includes("manuten")) return Wrench;
  if (e.includes("hidrostático") || e.includes("hidrostatico") || e.includes("teste")) return Gauge;
  return CircleDot;
}

type EventoHistorico = {
  id: string;
  equipamento_id: string;
  data: string;
  evento: string;
  observacoes: string | null;
  created_at: string;
};

type PdfEmitido = {
  token: string;
  status: "valido" | "revogado";
  data_emissao: string;
  tipo: "inspecao" | "ordem_servico";
  label: string;
};

type OrdemServicoResumo = {
  id: string;
  numero: number;
  tipo: TipoOS;
  data: string;
  status: StatusOS;
  verificado: boolean;
};

export default function EquipamentoDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [equipamento, setEquipamento] = useState<Equipamento | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [inspecoes, setInspecoes] = useState<Inspecao[]>([]);
  const [historico, setHistorico] = useState<EventoHistorico[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [pdfsEmitidos, setPdfsEmitidos] = useState<PdfEmitido[]>([]);
  const [ordensServico, setOrdensServico] = useState<OrdemServicoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [gerandoEtiqueta, setGerandoEtiqueta] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [gerandoPdfInspecaoId, setGerandoPdfInspecaoId] = useState<string | null>(null);
  const [mostrarQr, setMostrarQr] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mostrarFormEvento, setMostrarFormEvento] = useState(false);
  const [tipoEvento, setTipoEvento] = useState<(typeof TIPOS_EVENTO_MANUAL)[number]>("Recarga");
  const [eventoCustom, setEventoCustom] = useState("");
  const [dataEvento, setDataEvento] = useState(new Date().toISOString().slice(0, 10));
  const [observacaoEvento, setObservacaoEvento] = useState("");
  const [salvandoEvento, setSalvandoEvento] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data: eq } = await supabase.from("equipamentos").select("*").eq("id", params.id).single();

    if (!eq) {
      setNaoEncontrado(true);
      setLoading(false);
      return;
    }
    setEquipamento(eq as Equipamento);

    const [{ data: cl }, { data: insp }, { data: hist }, { data: docs }] = await Promise.all([
      supabase.from("clientes").select("*").eq("id", eq.cliente_id).single(),
      supabase
        .from("inspecoes")
        .select("*")
        .eq("equipamento_id", params.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("equipamento_historico")
        .select("*")
        .eq("equipamento_id", params.id)
        .order("data", { ascending: false })
        .limit(30),
      supabase.from("documentos").select("*").eq("cliente_id", eq.cliente_id).order("created_at", { ascending: false }),
    ]);

    setCliente((cl as Cliente) ?? null);
    setInspecoes((insp as Inspecao[]) ?? []);
    setHistorico((hist as EventoHistorico[]) ?? []);
    setDocumentos((docs as Documento[]) ?? []);

    // PDFs emitidos: laudos de inspeção deste equipamento + Ordens de
    // Serviço que incluíram este equipamento como item.
    const inspecaoIds = (insp ?? []).map((i: { id: string }) => i.id);
    const [laudosInspRes, itensOsRes] = await Promise.all([
      inspecaoIds.length
        ? supabase
            .from("laudos_autenticacao")
            .select("token_validacao, status, data_emissao, inspecao_id")
            .eq("tipo_documento", "inspecao")
            .in("inspecao_id", inspecaoIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from("ordens_servico_itens")
        .select("ordem_servico_id, verificado, ordens_servico(numero, tipo, data, status)")
        .eq("equipamento_id", params.id),
    ]);

    const osIds = (itensOsRes.data ?? []).map((i: any) => i.ordem_servico_id);
    const numeroPorOs = new Map<string, number>(
      (itensOsRes.data ?? []).map((i: any) => [i.ordem_servico_id, i.ordens_servico?.numero])
    );

    setOrdensServico(
      (itensOsRes.data ?? [])
        .filter((i: any) => i.ordens_servico)
        .map((i: any) => ({
          id: i.ordem_servico_id,
          numero: i.ordens_servico.numero,
          tipo: i.ordens_servico.tipo,
          data: i.ordens_servico.data,
          status: i.ordens_servico.status,
          verificado: i.verificado,
        }))
        .sort((a: OrdemServicoResumo, b: OrdemServicoResumo) => new Date(b.data).getTime() - new Date(a.data).getTime())
    );

    const { data: laudosOs } = osIds.length
      ? await supabase
          .from("laudos_autenticacao")
          .select("token_validacao, status, data_emissao, ordem_servico_id")
          .eq("tipo_documento", "ordem_servico")
          .in("ordem_servico_id", osIds)
      : { data: [] as any[] };

    const pdfsInsp: PdfEmitido[] = (laudosInspRes.data ?? []).map((l: any) => ({
      token: l.token_validacao,
      status: l.status,
      data_emissao: l.data_emissao,
      tipo: "inspecao",
      label: `Laudo de inspeção — ${new Date(l.data_emissao).toLocaleDateString("pt-BR")}`,
    }));
    const pdfsOs: PdfEmitido[] = (laudosOs ?? []).map((l: any) => ({
      token: l.token_validacao,
      status: l.status,
      data_emissao: l.data_emissao,
      tipo: "ordem_servico",
      label: `OS-${String(numeroPorOs.get(l.ordem_servico_id) ?? "?").padStart(5, "0")}`,
    }));

    setPdfsEmitidos(
      [...pdfsInsp, ...pdfsOs].sort((a, b) => new Date(b.data_emissao).getTime() - new Date(a.data_emissao).getTime())
    );

    setLoading(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleEtiqueta(tamanho: TamanhoEtiqueta) {
    if (!equipamento) return;
    setGerandoEtiqueta(true);
    try {
      await gerarEtiquetaEquipamento(equipamento, tamanho);
    } finally {
      setGerandoEtiqueta(false);
    }
  }

  async function handleFotoUpload(file: File) {
    if (!equipamento) return;
    setEnviandoFoto(true);
    setError(null);

    const extensao = file.name.split(".").pop();
    const caminho = `equipamentos/${equipamento.id}/foto-${Date.now()}.${extensao}`;

    const { error: uploadError } = await supabase.storage
      .from("firecontrol-files")
      .upload(caminho, file, { upsert: true });

    if (uploadError) {
      setError(`Erro ao enviar foto: ${uploadError.message}`);
      setEnviandoFoto(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("firecontrol-files").getPublicUrl(caminho);
    const { error: updateError } = await supabase
      .from("equipamentos")
      .update({ foto_url: urlData.publicUrl })
      .eq("id", equipamento.id);

    setEnviandoFoto(false);
    if (updateError) {
      setError(`Erro ao salvar foto: ${updateError.message}`);
      return;
    }
    carregar();
  }

  async function handleRegistrarEvento(e: React.FormEvent) {
    e.preventDefault();
    if (!equipamento) return;
    const evento = tipoEvento === "Outro" ? eventoCustom.trim() : tipoEvento;
    if (!evento) {
      setError("Descreva o evento antes de registrar.");
      return;
    }
    setSalvandoEvento(true);
    setError(null);

    const { error: insertError } = await supabase.from("equipamento_historico").insert([
      {
        equipamento_id: equipamento.id,
        data: dataEvento,
        evento,
        observacoes: observacaoEvento || null,
      },
    ]);

    setSalvandoEvento(false);
    if (insertError) {
      setError(`Erro ao registrar evento: ${insertError.message}`);
      return;
    }

    setMostrarFormEvento(false);
    setTipoEvento("Recarga");
    setEventoCustom("");
    setDataEvento(new Date().toISOString().slice(0, 10));
    setObservacaoEvento("");
    carregar();
  }

  async function handleGerarPdfInspecao(inspecao: Inspecao) {
    setGerandoPdfInspecaoId(inspecao.id);
    setError(null);
    try {
      let autenticacao: AutenticacaoLaudo | null = null;
      try {
        const resp = await fetch("/api/laudos/emitir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inspecaoId: inspecao.id }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.token && data?.hash && data?.dataEmissao) {
            autenticacao = { token: data.token, hash: data.hash, dataEmissao: data.dataEmissao };
          }
        }
      } catch {
        // handled abaixo pelo estado "selo pendente" do próprio PDF
      }
      await gerarInspecaoPdf(inspecao, cliente ?? undefined, equipamento ?? undefined, autenticacao);
      carregar();
    } catch (err: any) {
      setError(`Erro ao gerar PDF: ${err.message}`);
    } finally {
      setGerandoPdfInspecaoId(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-brand-slate/60">Carregando equipamento...</div>;
  }

  if (naoEncontrado || !equipamento) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-4 text-center">
          Equipamento não encontrado. O QR Code pode estar apontando para um equipamento que foi excluído.
        </div>
        <div className="text-center mt-4">
          <Link href="/equipamentos" className="text-brand-red text-sm underline">
            Ver todos os equipamentos
          </Link>
        </div>
      </div>
    );
  }

  const especificacoesSchema = getEspecificacoesSchema(equipamento.tipo);
  const especificacoes = equipamento.especificacoes ?? {};
  const urlEquipamento = `${typeof window !== "undefined" ? window.location.origin : ""}/equipamentos/${equipamento.id}`;

  const linhaDoTempo = [
    ...(equipamento.data_instalacao
      ? [
          {
            id: "instalacao",
            data: equipamento.data_instalacao,
            evento: "Instalação",
            observacoes: null as string | null,
          },
        ]
      : []),
    ...historico,
  ].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  return (
    <div className="max-w-2xl mx-auto">
      {error && (
        <p className="text-sm text-brand-red bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* Foto — primeiro contato visual, ocupa o topo do prontuário */}
      <label className="block mb-4 cursor-pointer group">
        {equipamento.foto_url ? (
          <img
            src={equipamento.foto_url}
            alt={equipamento.codigo_interno}
            className="w-full h-56 object-cover rounded-lg border border-black/5"
          />
        ) : (
          <div className="w-full h-40 rounded-lg border-2 border-dashed border-black/10 flex items-center justify-center text-sm text-brand-slate/50 group-hover:bg-brand-fog transition">
            {enviandoFoto ? "Enviando..." : "Toque para adicionar uma foto do equipamento"}
          </div>
        )}
        {equipamento.foto_url && (
          <p className="text-[11px] text-brand-slate/50 mt-1 text-center group-hover:text-brand-red">
            {enviandoFoto ? "Enviando..." : "toque para trocar a foto"}
          </p>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFotoUpload(file);
          }}
        />
      </label>

      {/* Informações — identificação e status */}
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <p className="text-xs text-brand-slate/50">{cliente?.razao_social ?? "Cliente não encontrado"}</p>
          <h1 className="font-display text-2xl">{equipamento.codigo_interno}</h1>
          <p className="text-sm text-brand-slate/70">
            {equipamento.tipo} — {equipamento.localizacao || "sem localização"}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${statusColor[equipamento.status]}`}>
          {equipamento.status}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() =>
            router.push(`/inspecoes?cliente=${equipamento.cliente_id}&equipamento=${equipamento.id}`)
          }
          className="bg-brand-red text-white text-sm px-4 py-2 rounded-md hover:bg-brand-redDark transition"
        >
          Iniciar inspeção deste equipamento
        </button>
        <Link
          href={`/ordens-servico?cliente=${equipamento.cliente_id}`}
          className="border border-black/10 text-sm px-4 py-2 rounded-md hover:bg-brand-fog transition"
        >
          Gerar OS
        </Link>
        <Link
          href={`/equipamentos?busca=${encodeURIComponent(equipamento.codigo_interno)}`}
          className="border border-black/10 text-sm px-4 py-2 rounded-md hover:bg-brand-fog transition"
        >
          Editar cadastro
        </Link>
      </div>

      <div className="bg-white border border-black/5 rounded-lg p-5 mb-4">
        <h2 className="text-sm font-semibold text-brand-slate mb-3">Dados do equipamento</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
          <dt className="text-brand-slate/60">Fabricante</dt>
          <dd className="text-right">{equipamento.fabricante || "—"}</dd>
          <dt className="text-brand-slate/60">Nº de série</dt>
          <dd className="text-right">{equipamento.numero_serie || "—"}</dd>
          <dt className="text-brand-slate/60">Data de instalação</dt>
          <dd className="text-right">
            {equipamento.data_instalacao
              ? new Date(equipamento.data_instalacao + "T00:00:00").toLocaleDateString("pt-BR")
              : "—"}
          </dd>
          <dt className="text-brand-slate/60">Próxima inspeção</dt>
          <dd className="text-right">
            {equipamento.proxima_inspecao
              ? new Date(equipamento.proxima_inspecao + "T00:00:00").toLocaleDateString("pt-BR")
              : "—"}
          </dd>
          <dt className="text-brand-slate/60">Próxima recarga</dt>
          <dd className="text-right">
            {equipamento.proxima_recarga
              ? new Date(equipamento.proxima_recarga + "T00:00:00").toLocaleDateString("pt-BR")
              : "—"}
          </dd>
          <dt className="text-brand-slate/60">Próximo teste hidrostático</dt>
          <dd className="text-right">
            {equipamento.proximo_teste_hidrostatico
              ? new Date(equipamento.proximo_teste_hidrostatico + "T00:00:00").toLocaleDateString("pt-BR")
              : "—"}
          </dd>
        </dl>
      </div>

      {/* Especificações técnicas — específicas do tipo de equipamento */}
      {especificacoesSchema.length > 0 && (
        <div className="bg-white border border-black/5 rounded-lg p-5 mb-4">
          <h2 className="text-sm font-semibold text-brand-slate mb-3">Especificações técnicas</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
            {especificacoesSchema.map((campo) => {
              const valor = especificacoes[campo.name];
              if (valor === undefined || valor === "" || valor === null) return null;
              const exibicao =
                campo.type === "boolean"
                  ? valor
                    ? "Sim"
                    : "Não"
                  : campo.type === "select"
                  ? campo.options?.find((o) => o.value === valor)?.label ?? String(valor)
                  : String(valor);
              return (
                <Fragment key={campo.name}>
                  <dt className="text-brand-slate/60">{campo.label}</dt>
                  <dd className="text-right">{exibicao}</dd>
                </Fragment>
              );
            })}
          </dl>
        </div>
      )}

      {/* Linha do tempo — histórico visual do equipamento (instalação, inspeções,
          recargas, trocas de peça, testes hidrostáticos...), em ordem cronológica,
          pra facilitar auditoria. */}
      <div className="bg-white border border-black/5 rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-brand-slate">Linha do tempo</h2>
          <button
            onClick={() => setMostrarFormEvento((v) => !v)}
            className="text-xs text-brand-red underline flex items-center gap-1"
          >
            <Plus size={12} /> registrar evento
          </button>
        </div>

        {mostrarFormEvento && (
          <form onSubmit={handleRegistrarEvento} className="bg-brand-fog rounded-lg p-3 mb-4 space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-brand-slate/70">Tipo de evento</label>
                <select
                  value={tipoEvento}
                  onChange={(e) => setTipoEvento(e.target.value as (typeof TIPOS_EVENTO_MANUAL)[number])}
                  className="w-full mt-1 border border-black/10 rounded-md px-2 py-1.5 text-sm bg-white"
                >
                  {TIPOS_EVENTO_MANUAL.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-brand-slate/70">Data</label>
                <input
                  type="date"
                  value={dataEvento}
                  onChange={(e) => setDataEvento(e.target.value)}
                  className="w-full mt-1 border border-black/10 rounded-md px-2 py-1.5 text-sm bg-white"
                />
              </div>
            </div>
            {tipoEvento === "Outro" && (
              <div>
                <label className="text-[11px] font-medium text-brand-slate/70">Descrição do evento</label>
                <input
                  type="text"
                  value={eventoCustom}
                  onChange={(e) => setEventoCustom(e.target.value)}
                  placeholder="Ex: Substituição do lacre"
                  className="w-full mt-1 border border-black/10 rounded-md px-2 py-1.5 text-sm bg-white"
                />
              </div>
            )}
            <div>
              <label className="text-[11px] font-medium text-brand-slate/70">Observações (opcional)</label>
              <textarea
                value={observacaoEvento}
                onChange={(e) => setObservacaoEvento(e.target.value)}
                rows={2}
                className="w-full mt-1 border border-black/10 rounded-md px-2 py-1.5 text-sm bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={salvandoEvento}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-brand-red text-white disabled:opacity-50"
            >
              {salvandoEvento ? "Salvando..." : "Registrar"}
            </button>
          </form>
        )}

        {linhaDoTempo.length === 0 ? (
          <p className="text-sm text-brand-slate/60">Nenhum evento registrado ainda para este equipamento.</p>
        ) : (
          <ol>
            {linhaDoTempo.map((item, idx) => {
              const Icone = iconePorEvento(item.evento);
              const ultimo = idx === linhaDoTempo.length - 1;
              return (
                <li key={item.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="w-7 h-7 rounded-full bg-brand-fog border border-black/10 flex items-center justify-center shrink-0 text-brand-red">
                      <Icone size={14} />
                    </span>
                    {!ultimo && <span className="w-px flex-1 bg-black/10 my-0.5" />}
                  </div>
                  <div className={`text-sm ${ultimo ? "pb-0" : "pb-4"}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-brand-ink">{item.evento}</span>
                      <span className="text-brand-slate/50 text-xs">
                        {new Date(item.data + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    {item.observacoes && <p className="text-xs text-brand-slate/60 mt-0.5">{item.observacoes}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Inspeções — histórico específico de inspeções, com PDF individual */}
      <div className="bg-white border border-black/5 rounded-lg p-5 mb-4">
        <h2 className="text-sm font-semibold text-brand-slate mb-3">Inspeções</h2>
        {inspecoes.length === 0 ? (
          <p className="text-sm text-brand-slate/60">Nenhuma inspeção registrada ainda para este equipamento.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {inspecoes.map((insp) => (
              <li key={insp.id} className="py-2.5 flex items-center justify-between text-sm gap-2">
                <span className="shrink-0">{new Date(insp.created_at).toLocaleDateString("pt-BR")}</span>
                <span className="text-brand-slate/60 truncate">{insp.responsavel_tecnico || "—"}</span>
                <span
                  className={`font-medium shrink-0 ${
                    insp.resultado === "conforme" ? "text-green-700" : "text-brand-red"
                  }`}
                >
                  {insp.resultado === "conforme" ? "Conforme" : "Não conforme"}
                </span>
                <button
                  onClick={() => handleGerarPdfInspecao(insp)}
                  disabled={gerandoPdfInspecaoId === insp.id}
                  className="text-xs text-brand-red underline shrink-0 disabled:opacity-50"
                >
                  {gerandoPdfInspecaoId === insp.id ? "gerando..." : "PDF"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Documentos — documentos do cliente (o cadastro ainda não vincula documento a equipamento específico) */}
      <div className="bg-white border border-black/5 rounded-lg p-5 mb-4">
        <h2 className="text-sm font-semibold text-brand-slate mb-1">Documentos</h2>
        <p className="text-xs text-brand-slate/50 mb-3">Documentos do cliente {cliente?.razao_social ?? ""}.</p>
        {documentos.length === 0 ? (
          <p className="text-sm text-brand-slate/60">Nenhum documento cadastrado para este cliente.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {documentos.map((doc) => (
              <li key={doc.id} className="py-2.5 flex items-center justify-between text-sm gap-2">
                <span className="truncate">
                  {doc.tipo} — {doc.nome_arquivo}
                </span>
                <a href={doc.arquivo_url} target="_blank" rel="noreferrer" className="text-xs text-brand-red underline shrink-0">
                  abrir
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ordens de Serviço — todas as OS (aberta, concluída ou cancelada) que
          incluíram este equipamento, é o que liga o módulo de OS ao
          prontuário do equipamento. */}
      <div className="bg-white border border-black/5 rounded-lg p-5 mb-4">
        <h2 className="text-sm font-semibold text-brand-slate mb-3">Ordens de Serviço</h2>
        {ordensServico.length === 0 ? (
          <p className="text-sm text-brand-slate/60">Este equipamento ainda não entrou em nenhuma OS.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {ordensServico.map((os) => (
              <li key={os.id} className="py-2.5 flex items-center justify-between text-sm gap-2">
                <div className="min-w-0">
                  <Link href="/ordens-servico" className="font-medium text-brand-ink hover:text-brand-red truncate block">
                    OS-{String(os.numero).padStart(5, "0")}
                  </Link>
                  <p className="text-xs text-brand-slate/50">
                    {TIPO_OS_LABEL[os.tipo]} · {new Date(os.data + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {os.status === "concluida" && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${os.verificado ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                      {os.verificado ? "verificado" : "não verificado"}
                    </span>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusCorOs[os.status]}`}>
                    {STATUS_OS_LABEL[os.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* PDFs emitidos — todo selo de autenticidade já emitido envolvendo este equipamento */}
      <div className="bg-white border border-black/5 rounded-lg p-5 mb-4">
        <h2 className="text-sm font-semibold text-brand-slate mb-3">PDFs emitidos</h2>
        {pdfsEmitidos.length === 0 ? (
          <p className="text-sm text-brand-slate/60">Nenhum PDF autenticado emitido ainda para este equipamento.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {pdfsEmitidos.map((p) => (
              <li key={p.token} className="py-2.5 flex items-center justify-between text-sm gap-2">
                <span className="truncate">{p.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      p.status === "valido" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {p.status === "valido" ? "válido" : "revogado"}
                  </span>
                  <Link href={`/verificar/${p.token}`} className="text-xs text-brand-red underline" target="_blank">
                    verificar
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* QR Code — o mesmo QR que vai na etiqueta física, disponível pra reimpressão */}
      <div className="bg-white border border-black/5 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-brand-slate mb-3">QR Code</h2>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => setMostrarQr((v) => !v)}
            className="border border-black/10 text-sm px-3 py-2 rounded-md hover:bg-brand-fog transition"
          >
            {mostrarQr ? "Ocultar QR Code" : "Mostrar QR Code"}
          </button>
          <div className="flex items-center gap-1 border border-black/10 rounded-md px-2">
            <span className="text-xs text-brand-slate/60 mr-1">Baixar etiqueta:</span>
            {(["pequena", "media", "grande"] as const).map((tam) => (
              <button
                key={tam}
                onClick={() => handleEtiqueta(tam)}
                disabled={gerandoEtiqueta}
                className="text-xs px-2 py-2 hover:bg-brand-fog transition disabled:opacity-50"
              >
                {gerandoEtiqueta ? "..." : tam === "pequena" ? "P" : tam === "media" ? "M" : "G"}
              </button>
            ))}
          </div>
        </div>
        {mostrarQr && (
          <div className="mt-4">
            <QRCodeSVG value={urlEquipamento} size={140} />
            <p className="text-xs text-brand-slate/50 mt-2 max-w-xs">
              Aponta para esta mesma página — é o que fica impresso na etiqueta colada no equipamento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
