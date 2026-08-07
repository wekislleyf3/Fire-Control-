"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type LeadSite = {
  id: string;
  nome: string;
  whatsapp: string;
  estabelecimento: string | null;
  bairro: string | null;
  data_preferida: string | null;
  turno_preferido: string | null;
  interesse: string | null;
  status: "novo" | "convertido" | "descartado";
  cliente_id: string | null;
  created_at: string;
};

export default function LeadsSitePage() {
  const [leads, setLeads] = useState<LeadSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"novo" | "todos">("novo");
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    let query = supabase.from("leads_site").select("*").order("created_at", { ascending: false });
    if (filtro === "novo") query = query.eq("status", "novo");

    const { data, error: err } = await query;
    if (err) setError(`Erro ao carregar leads: ${err.message}`);
    else setLeads((data as LeadSite[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, [filtro]);

  async function converterEmCliente(lead: LeadSite) {
    setProcessandoId(lead.id);
    setError(null);
    setSucesso(null);

    const { data: novoCliente, error: clienteError } = await supabase
      .from("clientes")
      .insert({
        tipo_pessoa: "juridica",
        razao_social: lead.estabelecimento || lead.nome,
        whatsapp: lead.whatsapp,
        responsavel: lead.nome,
        bairro: lead.bairro,
        observacoes: lead.interesse ? `Interesse (site): ${lead.interesse}` : null,
        status: "ativo",
      })
      .select("id")
      .single();

    if (clienteError || !novoCliente) {
      setError(`Erro ao criar cliente: ${clienteError?.message ?? "erro desconhecido"}`);
      setProcessandoId(null);
      return;
    }

    // Se a pessoa indicou data preferida, já cria o evento na Agenda.
    if (lead.data_preferida) {
      await supabase.from("agenda_eventos").insert({
        cliente_id: novoCliente.id,
        tipo: "visita",
        titulo: `Visita técnica — diagnóstico (${lead.estabelecimento || lead.nome})`,
        data: lead.data_preferida,
        observacoes: lead.turno_preferido ? `Turno preferido: ${lead.turno_preferido}` : null,
      });
    }

    const { error: updateError } = await supabase
      .from("leads_site")
      .update({ status: "convertido", cliente_id: novoCliente.id })
      .eq("id", lead.id);

    setProcessandoId(null);

    if (updateError) {
      setError(`Cliente criado, mas não consegui marcar o lead como convertido: ${updateError.message}`);
    } else {
      setSucesso(`${lead.estabelecimento || lead.nome} virou cliente — já está em "Prospecção" no Pipeline.`);
    }
    carregar();
  }

  async function descartar(lead: LeadSite) {
    setProcessandoId(lead.id);
    const { error: err } = await supabase.from("leads_site").update({ status: "descartado" }).eq("id", lead.id);
    setProcessandoId(null);
    if (err) setError(`Erro ao descartar: ${err.message}`);
    carregar();
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-4xl">Leads do site</h1>
        <p className="text-base text-brand-slate/60">
          Agendamentos recebidos pelo formulário público (firecontrolgestao.site/agendamento.html).
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}
      {sucesso && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md px-4 py-3 mb-4">
          {sucesso}
        </div>
      )}

      <div className="flex gap-1 bg-brand-fog rounded-md p-1 w-fit mb-4">
        {(["novo", "todos"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`text-xs px-3 py-1.5 rounded ${
              filtro === f ? "bg-white shadow-sm font-medium" : "text-brand-slate/60"
            }`}
          >
            {f === "novo" ? "Novos" : "Todos"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-brand-slate/60 py-6">Carregando...</p>
      ) : leads.length === 0 ? (
        <p className="text-center text-brand-slate/60 py-6">Nenhum lead {filtro === "novo" ? "novo" : ""} encontrado.</p>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <div key={lead.id} className="bg-white border border-black/5 rounded-lg p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium">{lead.estabelecimento || lead.nome}</p>
                  <p className="text-xs text-brand-slate/60">
                    {lead.nome} · {lead.whatsapp} {lead.bairro && `· ${lead.bairro}`}
                  </p>
                  <p className="text-xs text-brand-slate/60 mt-1">
                    {lead.interesse && `Interesse: ${lead.interesse}`}
                    {lead.data_preferida &&
                      ` · Prefere: ${new Date(lead.data_preferida + "T00:00:00").toLocaleDateString("pt-BR")}${
                        lead.turno_preferido ? ` (${lead.turno_preferido})` : ""
                      }`}
                  </p>
                  <p className="text-[11px] text-brand-slate/40 mt-1">
                    Recebido em {new Date(lead.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {lead.status === "novo" && (
                    <>
                      <button
                        onClick={() => converterEmCliente(lead)}
                        disabled={processandoId === lead.id}
                        className="text-xs bg-brand-red text-white px-3 py-1.5 rounded-md hover:bg-brand-redDark transition disabled:opacity-50"
                      >
                        {processandoId === lead.id ? "..." : "Converter em cliente"}
                      </button>
                      <button
                        onClick={() => descartar(lead)}
                        disabled={processandoId === lead.id}
                        className="text-xs text-brand-slate/50 underline"
                      >
                        Descartar
                      </button>
                    </>
                  )}
                  {lead.status === "convertido" && lead.cliente_id && (
                    <Link href={`/clientes/${lead.cliente_id}`} className="text-xs text-green-700 underline">
                      Ver cliente
                    </Link>
                  )}
                  {lead.status === "descartado" && (
                    <span className="text-xs text-brand-slate/40">Descartado</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
