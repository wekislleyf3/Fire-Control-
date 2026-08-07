import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { faixaDoIfc } from "@/lib/ifc";
import { calcularUrgencia, calcularStatusEquipamento, severityStyle } from "@/lib/alerts";
import { enderecoCompleto } from "@/types/cliente";
import { labelEtapa } from "@/types/pipeline";
import { clientesService } from "@/lib/services/clientesService";
import GerarDiagnosticoPdfButton from "./GerarDiagnosticoPdfButton";
import PipelineControle from "./PipelineControle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusColor: Record<string, string> = {
  ok: "bg-green-100 text-green-700",
  atencao: "bg-amber-100 text-amber-700",
  vencido: "bg-red-100 text-red-700",
};

async function getClienteDetalhe(id: string) {
  noStore();
  const supabase = createClient();
  return clientesService.carregarDetalhe(supabase, id);
}

export default async function ClienteDetalhePage({ params }: { params: { id: string } }) {
  const dados = await getClienteDetalhe(params.id);
  if (!dados) notFound();

  const { cliente, equipamentos, documentos, inspecoes, diagnostico, proximosVencimentos, timeline, proximaVisita, ultimoRelatorio } =
    dados;
  const cor = faixaDoIfc(diagnostico.ifc.score);

  const situacao =
    diagnostico.ifc.score >= 85
      ? { emoji: "🟢", texto: "Em conformidade" }
      : diagnostico.ifc.score >= 70
      ? { emoji: "🟡", texto: "Atenção necessária" }
      : { emoji: "🔴", texto: "Situação crítica" };

  const iconeTimeline: Record<string, string> = {
    cadastro: "📋",
    documento: "📄",
    inspecao: "🔍",
    diagnostico: "🩺",
    pipeline: "➡️",
    agenda: "📅",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/clientes" className="text-xs text-brand-slate/60 hover:underline">
            ← Voltar para Clientes
          </Link>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <h1 className="font-display text-3xl">{cliente.razao_social}</h1>
            <span className="text-xs font-mono bg-brand-fog px-2 py-1 rounded-md text-brand-slate">
              {cliente.matricula ?? "sem matrícula"}
            </span>
            <span
              className={`text-xs px-2 py-1 rounded-full capitalize ${
                cliente.status === "ativo" ? "bg-green-100 text-green-700" : "bg-brand-fog text-brand-slate"
              }`}
            >
              {cliente.status}
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700">
              {labelEtapa(cliente.etapa_pipeline)}
            </span>
          </div>
          {cliente.nome_fantasia && <p className="text-sm text-brand-slate/60">{cliente.nome_fantasia}</p>}
        </div>
        <GerarDiagnosticoPdfButton cliente={cliente} diagnostico={diagnostico} />
      </div>

      {/* Situação Geral do Cliente — visão em menos de 5 segundos */}
      <div className={`rounded-xl border-2 p-6 ${cor.bg} ${cor.border}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-brand-slate/60 uppercase tracking-wide">Situação geral</p>
            <p className={`text-3xl font-display ${cor.text}`}>
              {situacao.emoji} {situacao.texto}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-brand-slate/60">IFC</p>
            <p className={`text-5xl font-display ${cor.text}`}>{diagnostico.ifc.score}%</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
          <div className="bg-white/70 rounded-lg px-4 py-3">
            <p className="text-xs text-brand-slate/60">Equipamentos</p>
            <p className="text-xl font-semibold">{equipamentos.length}</p>
          </div>
          <div className="bg-white/70 rounded-lg px-4 py-3">
            <p className="text-xs text-brand-slate/60">Pendências</p>
            <p className="text-xl font-semibold">{diagnostico.problemas.length}</p>
          </div>
          <div className="bg-white/70 rounded-lg px-4 py-3">
            <p className="text-xs text-brand-slate/60">Documentos</p>
            <p className="text-xl font-semibold">{documentos.length}</p>
          </div>
          <div className="bg-white/70 rounded-lg px-4 py-3">
            <p className="text-xs text-brand-slate/60">Próxima visita</p>
            <p className="text-base font-semibold mt-1">
              {proximaVisita ? new Date(proximaVisita.data + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
            </p>
          </div>
          <div className="bg-white/70 rounded-lg px-4 py-3">
            <p className="text-xs text-brand-slate/60">Último relatório</p>
            <p className="text-base font-semibold mt-1">
              {ultimoRelatorio ? new Date(ultimoRelatorio).toLocaleDateString("pt-BR") : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Informações gerais */}
      <div className="bg-white border border-black/5 rounded-lg p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-brand-slate/60 mb-1">
            {cliente.tipo_pessoa === "fisica" ? "CPF" : "CNPJ"}
          </p>
          <p>{(cliente.tipo_pessoa === "fisica" ? cliente.cpf : cliente.cnpj) ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-brand-slate/60 mb-1">Endereço</p>
          <p>{enderecoCompleto(cliente) || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-brand-slate/60 mb-1">Contato</p>
          <p>
            {cliente.telefone || "—"}
            {cliente.email ? ` · ${cliente.email}` : ""}
          </p>
        </div>
        <div>
          <p className="text-xs text-brand-slate/60 mb-1">Responsável</p>
          <p>
            {cliente.responsavel || "—"}
            {cliente.cargo ? ` (${cliente.cargo})` : ""}
          </p>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="rounded-lg border border-black/5 bg-white p-4 md:p-5">
          <p className="text-xs md:text-sm text-brand-slate">Equipamentos</p>
          <p className="font-display text-3xl md:text-4xl mt-1 text-brand-ink">{diagnostico.totalEquipamentos}</p>
          <p className="text-[11px] text-brand-slate/50 mt-0.5">analisados</p>
        </div>
        <div className="rounded-lg border border-black/5 bg-white p-4 md:p-5">
          <p className="text-xs md:text-sm text-brand-slate">Em conformidade</p>
          <p className="font-display text-3xl md:text-4xl mt-1 text-green-600">{diagnostico.equipamentosConformes}</p>
          <p className="text-[11px] text-brand-slate/50 mt-0.5">equipamentos</p>
        </div>
        <div className="rounded-lg border border-amber-400 bg-white p-4 md:p-5">
          <p className="text-xs md:text-sm text-brand-slate">Pendências</p>
          <p className="font-display text-3xl md:text-4xl mt-1 text-amber-500">{diagnostico.equipamentosPendentes}</p>
          <p className="text-[11px] text-brand-slate/50 mt-0.5">ação recomendada</p>
        </div>
        <div className={`rounded-lg border-2 ${cor.border} ${cor.bg} p-4 md:p-5`}>
          <p className="text-xs md:text-sm text-brand-slate">IFC</p>
          <p className={`font-display text-3xl md:text-4xl mt-1 ${cor.text}`}>{diagnostico.ifc.score}</p>
          <p className={`text-[11px] font-medium mt-0.5 ${cor.text}`}>{cor.label}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Principais problemas */}
        <div className="bg-white border border-black/5 rounded-lg p-4 md:p-5">
          <p className="font-display text-lg mb-3">Principais problemas</p>
          {diagnostico.problemas.length === 0 && (
            <p className="text-sm text-green-700">Nenhuma pendência encontrada — cliente em conformidade.</p>
          )}
          <ul className="space-y-2">
            {diagnostico.problemas.slice(0, 8).map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={p.severidade === "vencido" ? "text-brand-red" : "text-amber-500"}>●</span>
                <span>{p.descricao}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Próximas inspeções / vencimentos */}
        <div className="bg-white border border-black/5 rounded-lg p-4 md:p-5">
          <p className="font-display text-lg mb-3">Próximos vencimentos</p>
          {proximosVencimentos.length === 0 && (
            <p className="text-sm text-brand-slate/60">Nada vencendo nos próximos 90 dias.</p>
          )}
          <ul className="space-y-2.5">
            {proximosVencimentos.map((v, i) => (
              <li key={i} className="flex items-center justify-between text-sm border-b border-black/5 pb-2 last:border-0">
                <div>
                  <p className="font-medium">{v.equipamento.codigo_interno}</p>
                  <p className="text-xs text-brand-slate/60">{v.label}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${severityStyle[v.urgencia!.severity]}`}>
                  {v.urgencia!.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Equipamentos */}
        <div className="bg-white border border-black/5 rounded-lg p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-display text-lg">Equipamentos</p>
            <Link href="/equipamentos" className="text-xs text-brand-red underline">
              gerenciar
            </Link>
          </div>
          {equipamentos.length === 0 && <p className="text-sm text-brand-slate/60">Nenhum equipamento cadastrado.</p>}
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {equipamentos.map((eq) => (
              <li key={eq.id} className="flex items-center justify-between text-sm border-b border-black/5 pb-2 last:border-0">
                <div>
                  <p className="font-medium">{eq.codigo_interno}</p>
                  <p className="text-xs text-brand-slate/60">
                    {eq.tipo}
                    {eq.localizacao ? ` — ${eq.localizacao}` : ""}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[calcularStatusEquipamento(eq)] ?? "bg-brand-fog"}`}>
                  {calcularStatusEquipamento(eq)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Últimos documentos */}
        <div className="bg-white border border-black/5 rounded-lg p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-display text-lg">Últimos documentos</p>
            <Link href="/documentos" className="text-xs text-brand-red underline">
              gerenciar
            </Link>
          </div>
          {documentos.length === 0 && <p className="text-sm text-brand-slate/60">Nenhum documento cadastrado.</p>}
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {documentos.slice(0, 8).map((doc) => {
              const u = calcularUrgencia(doc.validade);
              return (
                <li key={doc.id} className="flex items-center justify-between text-sm border-b border-black/5 pb-2 last:border-0">
                  <div>
                    <p className="font-medium">{doc.tipo}</p>
                    <p className="text-xs text-brand-slate/60">{doc.nome_arquivo}</p>
                  </div>
                  {u ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${severityStyle[u.severity]}`}>
                      {u.label}
                    </span>
                  ) : (
                    <span className="text-xs text-brand-slate/40">
                      {doc.validade ? new Date(doc.validade + "T00:00:00").toLocaleDateString("pt-BR") : "sem validade"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Histórico de inspeções */}
      <div className="bg-white border border-black/5 rounded-lg p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-display text-lg">Histórico de inspeções</p>
          <Link href="/inspecoes" className="text-xs text-brand-red underline">
            nova inspeção
          </Link>
        </div>
        {inspecoes.length === 0 && <p className="text-sm text-brand-slate/60">Nenhuma inspeção registrada ainda.</p>}
        <ul className="space-y-2.5">
          {inspecoes.map((i) => {
            const ok = i.resultado ? i.resultado === "conforme" : true;
            return (
              <li key={i.id} className="flex items-center justify-between text-sm border-b border-black/5 pb-2 last:border-0">
                <div>
                  <p className="font-medium">{i.equipamentos?.codigo_interno ?? "—"}</p>
                  <p className="text-xs text-brand-slate/60">{i.observacoes || "sem observações"}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {ok ? "Conforme" : "Não conforme"}
                  </span>
                  <p className="text-[11px] text-brand-slate/50 mt-0.5">
                    {new Date(i.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <PipelineControle clienteId={cliente.id} etapaAtual={cliente.etapa_pipeline} />

      {/* Timeline */}
      <div className="bg-white border border-black/5 rounded-lg p-4 md:p-5">
        <p className="font-display text-lg mb-3">Linha do tempo</p>
        {timeline.length === 0 ? (
          <p className="text-sm text-brand-slate/60">Nenhum evento registrado ainda.</p>
        ) : (
          <ul className="space-y-3 max-h-96 overflow-y-auto">
            {timeline.map((ev, i) => (
              <li key={i} className="flex items-start gap-3 text-sm border-b border-black/5 pb-3 last:border-0">
                <span className="shrink-0">{iconeTimeline[ev.tipo] ?? "•"}</span>
                <div className="flex-1">
                  <p className="font-medium">{ev.titulo}</p>
                  {ev.detalhe && <p className="text-xs text-brand-slate/60">{ev.detalhe}</p>}
                </div>
                <span className="text-xs text-brand-slate/50 shrink-0">
                  {new Date(ev.data).toLocaleDateString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
