"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Cliente } from "@/lib/types";
import { ETAPAS_PIPELINE, proximaEtapa, etapaAnterior } from "@/types/pipeline";
import { mudarEtapaPipeline } from "@/lib/pipeline";
import { clientesService } from "@/lib/services/clientesService";

const supabase = createClient();

export default function PipelinePage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movendoId, setMovendoId] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const data = await clientesService.list(supabase);
      setClientes([...data].sort((a, b) => a.razao_social.localeCompare(b.razao_social)));
    } catch (err) {
      setError(`Erro ao carregar clientes: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function mover(cliente: Cliente, direcao: "avancar" | "voltar") {
    const etapaAtual = cliente.etapa_pipeline;
    const nova = direcao === "avancar" ? proximaEtapa(etapaAtual) : etapaAnterior(etapaAtual);
    if (!nova) return;

    setMovendoId(cliente.id);
    const { error: err } = await mudarEtapaPipeline(supabase, cliente.id, etapaAtual, nova);
    setMovendoId(null);

    if (err) {
      setError(`Erro ao mover cliente: ${err}`);
      return;
    }
    carregar();
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-4xl">Pipeline</h1>
        <p className="text-base text-brand-slate/60">
          Em qual etapa do Método Fire cada cliente está, da prospecção ao monitoramento contínuo.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-center text-brand-slate/60 py-6">Carregando...</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
          {ETAPAS_PIPELINE.map((etapa) => {
            const clientesDaEtapa = clientes.filter((c) => c.etapa_pipeline === etapa.value);
            return (
              <div key={etapa.value} className="bg-brand-fog rounded-lg p-3 w-64 shrink-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-xs font-semibold text-brand-slate uppercase">{etapa.label}</p>
                  <span className="text-xs bg-white rounded-full px-2 py-0.5 text-brand-slate/60">
                    {clientesDaEtapa.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {clientesDaEtapa.length === 0 && (
                    <p className="text-xs text-brand-slate/40 px-1">Nenhum cliente aqui.</p>
                  )}
                  {clientesDaEtapa.map((cliente) => (
                    <div key={cliente.id} className="bg-white border border-black/5 rounded-lg p-3.5">
                      <Link href={`/clientes/${cliente.id}`} className="text-sm font-medium hover:text-brand-red transition block mb-2">
                        {cliente.razao_social}
                      </Link>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => mover(cliente, "voltar")}
                          disabled={movendoId === cliente.id || !etapaAnterior(cliente.etapa_pipeline)}
                          className="text-xs px-2 py-1 rounded border disabled:opacity-30"
                        >
                          ‹ Voltar
                        </button>
                        <button
                          onClick={() => mover(cliente, "avancar")}
                          disabled={movendoId === cliente.id || !proximaEtapa(cliente.etapa_pipeline)}
                          className="text-xs px-2 py-1 rounded bg-brand-red text-white disabled:opacity-30"
                        >
                          Avançar ›
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
