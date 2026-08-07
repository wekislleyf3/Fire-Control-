import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { calcularUrgencia, hojeBrasilia, hojeBrasiliaStr } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function inicioDoDiaISO() {
  return `${hojeBrasiliaStr()}T00:00:00-03:00`;
}

async function getOperacao() {
  noStore();
  const supabase = createClient();
  const hojeISO = inicioDoDiaISO();

  const [equipamentosRes, documentosRes, inspecoesHojeRes, laudosHojeRes, clientesRes, agendaHojeRes, agendaProximaRes] =
    await Promise.all([
      supabase
        .from("equipamentos")
        .select("id, codigo_interno, tipo, status, proxima_inspecao, proxima_recarga, proximo_teste_hidrostatico, clientes(razao_social)"),
      supabase.from("documentos").select("id, validade").not("validade", "is", null),
      supabase.from("inspecoes").select("id, resultado, created_at").gte("created_at", hojeISO),
      supabase.from("laudos_autenticacao").select("id, tipo_documento, cliente_id, created_at:data_emissao").gte("data_emissao", hojeISO),
      supabase.from("clientes").select("id"),
      supabase
        .from("agenda_eventos")
        .select("id, titulo, tipo, horario, responsavel, status, clientes(razao_social)")
        .eq("data", hojeBrasiliaStr())
        .neq("status", "cancelado")
        .order("horario", { ascending: true, nullsFirst: false }),
      supabase
        .from("agenda_eventos")
        .select("id, titulo, tipo, data, horario, clientes(razao_social)")
        .gt("data", hojeBrasiliaStr())
        .eq("status", "agendado")
        .order("data", { ascending: true })
        .order("horario", { ascending: true, nullsFirst: false })
        .limit(5),
    ]);

  const equipamentos = (equipamentosRes.data as any[]) ?? [];
  const documentos = (documentosRes.data as any[]) ?? [];
  const inspecoesHoje = inspecoesHojeRes.data ?? [];
  const laudosHoje = (laudosHojeRes.data as any[]) ?? [];
  const totalClientes = clientesRes.data?.length ?? 0;

  let equipVencidos = 0;
  let equipAtencao = 0;
  let equipProximos30d = 0;
  const criticos: { codigo: string; cliente: string; tipo: string; label: string }[] = [];

  for (const eq of equipamentos) {
    if (eq.status === "atencao") equipAtencao++;

    const datas = [eq.proxima_inspecao, eq.proxima_recarga, eq.proximo_teste_hidrostatico];
    let piorSeveridade: string | null = null;
    let piorLabel = "";

    for (const data of datas) {
      const u = calcularUrgencia(data);
      if (!u) continue;
      if (u.severity === "vencido" || u.severity === "hoje") {
        piorSeveridade = "vencido";
        piorLabel = u.label;
      } else if ((u.severity === "critico" || u.severity === "atencao") && piorSeveridade !== "vencido") {
        piorSeveridade = "proximo";
        piorLabel = u.label;
      }
    }

    if (piorSeveridade === "vencido") {
      equipVencidos++;
      criticos.push({
        codigo: eq.codigo_interno,
        cliente: eq.clientes?.razao_social ?? "—",
        tipo: eq.tipo,
        label: piorLabel,
      });
    } else if (piorSeveridade === "proximo") {
      equipProximos30d++;
    }
  }
  criticos.sort((a, b) => a.cliente.localeCompare(b.cliente));

  const hoje = hojeBrasilia();
  const docsVencidos = documentos.filter((d) => {
    const v = new Date(d.validade + "T00:00:00-03:00");
    return v.getTime() < hoje.getTime();
  }).length;

  const inspecoesConformes = inspecoesHoje.filter((i: any) => i.resultado === "conforme").length;
  const diagnosticosHoje = laudosHoje.filter((l) => l.tipo_documento === "diagnostico").length;

  return {
    totalClientes,
    equipVencidos,
    equipAtencao,
    equipProximos30d,
    docsVencidos,
    inspecoesHojeTotal: inspecoesHoje.length,
    inspecoesConformes,
    diagnosticosHoje,
    criticos: criticos.slice(0, 8),
    agendaHoje: (agendaHojeRes.data as any[]) ?? [],
    agendaProxima: (agendaProximaRes.data as any[]) ?? [],
  };
}

export default async function OperacaoPage() {
  const op = await getOperacao();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Operação</h1>
        <p className="text-base text-brand-slate/70">
          Central operacional — o que precisa de atenção agora, calculado em tempo real.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
        <Link href="/pendencias" className="rounded-xl border-2 border-brand-red bg-white p-5 md:p-6 block hover:bg-brand-fog transition">
          <p className="text-sm text-brand-slate">Equipamentos vencidos</p>
          <p className="font-display text-4xl md:text-5xl mt-1 text-brand-red">{op.equipVencidos}</p>
        </Link>
        <Link href="/pendencias" className="rounded-xl border border-black/5 bg-white p-5 md:p-6 block hover:bg-brand-fog transition">
          <p className="text-sm text-brand-slate">Próximos do vencimento (30 dias)</p>
          <p className="font-display text-4xl md:text-5xl mt-1">{op.equipProximos30d}</p>
        </Link>
        <Link href="/pendencias" className="rounded-xl border border-black/5 bg-white p-5 md:p-6 block hover:bg-brand-fog transition">
          <p className="text-sm text-brand-slate">Documentos vencidos</p>
          <p className="font-display text-4xl md:text-5xl mt-1">{op.docsVencidos}</p>
        </Link>
        <div className="rounded-xl border border-black/5 bg-white p-5 md:p-6">
          <p className="text-sm text-brand-slate">Equipamentos em atenção</p>
          <p className="font-display text-4xl md:text-5xl mt-1">{op.equipAtencao}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        <div className="rounded-xl border border-black/5 bg-white p-5 md:p-6">
          <p className="text-sm text-brand-slate">Inspeções realizadas hoje</p>
          <p className="font-display text-4xl mt-1">{op.inspecoesHojeTotal}</p>
          {op.inspecoesHojeTotal > 0 && (
            <p className="text-xs text-brand-slate/60 mt-1">
              {op.inspecoesConformes} conformes · {op.inspecoesHojeTotal - op.inspecoesConformes} não conformes
            </p>
          )}
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-5 md:p-6">
          <p className="text-sm text-brand-slate">Diagnósticos emitidos hoje</p>
          <p className="font-display text-4xl mt-1">{op.diagnosticosHoje}</p>
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-5 md:p-6">
          <p className="text-sm text-brand-slate">Clientes cadastrados</p>
          <p className="font-display text-4xl mt-1">{op.totalClientes}</p>
        </div>
      </div>

      {op.criticos.length > 0 && (
        <div className="bg-white border border-black/5 rounded-lg overflow-x-auto">
          <div className="px-4 md:px-5 py-3 font-display text-lg border-b border-black/5 flex items-center justify-between">
            <span>Clientes que precisam de atenção agora</span>
            <Link href="/pendencias" className="text-xs text-brand-red underline">
              ver todas as pendências
            </Link>
          </div>
          <table className="w-full text-sm min-w-[520px]">
            <thead className="bg-brand-fog text-left text-brand-slate">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Equipamento</th>
                <th className="px-4 py-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {op.criticos.map((c, i) => (
                <tr key={i} className="border-t border-black/5">
                  <td className="px-4 py-3 font-medium">{c.cliente}</td>
                  <td className="px-4 py-3">
                    {c.codigo} — {c.tipo}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">{c.label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <div className="bg-white border border-black/5 rounded-lg overflow-hidden">
          <div className="px-4 py-3 font-display text-lg border-b border-black/5 flex items-center justify-between">
            <span>Agenda de hoje</span>
            <Link href="/agenda" className="text-xs text-brand-red underline">
              ver agenda
            </Link>
          </div>
          {op.agendaHoje.length === 0 ? (
            <p className="px-4 py-4 text-sm text-brand-slate/50">Nada agendado para hoje.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {op.agendaHoje.map((ev: any) => (
                <li key={ev.id} className="px-4 py-2.5 text-sm flex items-center justify-between gap-2">
                  <span>
                    {ev.horario && <span className="font-mono text-xs text-brand-slate/60 mr-2">{ev.horario.slice(0, 5)}</span>}
                    {ev.titulo}
                    {ev.clientes?.razao_social && <span className="text-brand-slate/50"> · {ev.clientes.razao_social}</span>}
                  </span>
                  {ev.status === "concluido" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">
                      concluído
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-black/5 rounded-lg overflow-hidden">
          <div className="px-4 py-3 font-display text-lg border-b border-black/5">Próximas atividades</div>
          {op.agendaProxima.length === 0 ? (
            <p className="px-4 py-4 text-sm text-brand-slate/50">Nada agendado nos próximos dias.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {op.agendaProxima.map((ev: any) => (
                <li key={ev.id} className="px-4 py-2.5 text-sm">
                  <span className="text-xs text-brand-slate/60 mr-2">
                    {format(new Date(ev.data + "T00:00:00"), "dd/MM")}
                  </span>
                  {ev.titulo}
                  {ev.clientes?.razao_social && <span className="text-brand-slate/50"> · {ev.clientes.razao_social}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-brand-fog border border-black/5 rounded-lg p-4 md:p-5">
        <p className="text-sm font-medium text-brand-slate mb-2">Ainda não disponível nesta central</p>
        <p className="text-xs text-brand-slate/60">
          Laudos aguardando assinatura depende de um módulo de assinatura digital que ainda não existe.
          Assim que for construído, entra automaticamente aqui.
        </p>
      </div>
    </div>
  );
}
