"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ETAPAS_PIPELINE, proximaEtapa, etapaAnterior, type EtapaPipeline } from "@/types/pipeline";
import { mudarEtapaPipeline } from "@/lib/pipeline";

const supabase = createClient();

export default function PipelineControle({ clienteId, etapaAtual }: { clienteId: string; etapaAtual: EtapaPipeline }) {
  const router = useRouter();
  const [movendo, setMovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const indiceAtual = ETAPAS_PIPELINE.findIndex((e) => e.value === etapaAtual);

  async function mover(direcao: "avancar" | "voltar") {
    const nova = direcao === "avancar" ? proximaEtapa(etapaAtual) : etapaAnterior(etapaAtual);
    if (!nova) return;
    setMovendo(true);
    setErro(null);
    const { error } = await mudarEtapaPipeline(supabase, clienteId, etapaAtual, nova);
    setMovendo(false);
    if (error) {
      setErro(error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="bg-white border border-black/5 rounded-lg p-4 md:p-5">
      <p className="font-display text-lg mb-3">Pipeline</p>
      {erro && <p className="text-xs text-brand-red mb-2">{erro}</p>}

      <div className="flex items-center gap-1 flex-wrap mb-3">
        {ETAPAS_PIPELINE.map((etapa, i) => (
          <span
            key={etapa.value}
            className={`text-[10px] px-2 py-1 rounded-full ${
              i === indiceAtual
                ? "bg-brand-red text-white font-semibold"
                : i < indiceAtual
                ? "bg-green-100 text-green-700"
                : "bg-brand-fog text-brand-slate/50"
            }`}
          >
            {etapa.label}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => mover("voltar")}
          disabled={movendo || !etapaAnterior(etapaAtual)}
          className="text-xs px-3 py-1.5 rounded border disabled:opacity-30"
        >
          ‹ Etapa anterior
        </button>
        <button
          onClick={() => mover("avancar")}
          disabled={movendo || !proximaEtapa(etapaAtual)}
          className="text-xs px-3 py-1.5 rounded bg-brand-red text-white disabled:opacity-30"
        >
          {movendo ? "Movendo..." : "Avançar etapa ›"}
        </button>
      </div>
    </div>
  );
}
