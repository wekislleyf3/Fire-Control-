"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { IfcResultado } from "@/lib/ifc";

const supabase = createClient();

export default function RegistrarIfcButton({ resultado }: { resultado: IfcResultado }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSaving(true);
    setError(null);

    const hoje = new Date();
    const mesReferencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;

    const { error } = await supabase.from("ifc_historico").upsert(
      [
        {
          mes_referencia: mesReferencia,
          score: resultado.score,
          pct_equipamentos_ok: resultado.pctEquipamentosOk,
          pct_documentos_ok: resultado.pctDocumentosOk,
          pct_sem_nao_conformidade: resultado.pctSemNaoConformidade,
        },
      ],
      { onConflict: "mes_referencia" }
    );

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={saving}
        className="bg-brand-ink text-white text-sm px-4 py-2 rounded-md hover:bg-black transition disabled:opacity-60"
      >
        {saving ? "Registrando..." : "Registrar IFC deste mês"}
      </button>
      {done && <p className="text-xs text-green-700 mt-2">Registrado no histórico deste mês.</p>}
      {error && <p className="text-xs text-brand-red mt-2">Erro: {error}</p>}
    </div>
  );
}
