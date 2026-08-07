"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { leadsService } from "@/lib/services/leadsService";
import type { LeadSite } from "@/types/leadSite";

const supabase = createClient();

export default function LeadsSitePage() {
  const [leads, setLeads] = useState<LeadSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"novo" | "todos">("novo");
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const data = await leadsService.list(supabase, filtro === "novo");
      setLeads(data);
    } catch (err) {
      setError(`Erro ao carregar leads: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [filtro]);

  async function converterEmCliente(lead: LeadSite) {
    setProcessandoId(lead.id);
    setError(null);
    setSucesso(null);

    try {
      await leadsService.converterEmCliente(supabase, lead);
      setSucesso(`${lead.estabelecimento || lead.nome} virou cliente — já está em "Prospecção" no Pipeline.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcessandoId(null);
      carregar();
    }
  }

  async function descartar(lead: LeadSite) {
    setProcessandoId(lead.id);
    try {
      await leadsService.descartar(supabase, lead.id);
    } catch (err) {
      setError(`Erro ao descartar: ${(err as Error).message}`);
    } finally {
      setProcessandoId(null);
      carregar();
    }
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
