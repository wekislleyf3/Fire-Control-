"use client";

import { useState } from "react";
import type { Cliente } from "@/types/cliente";
import type { DiagnosticoCliente } from "@/lib/diagnostico";
import { gerarDiagnosticoPdf } from "@/lib/pdf/diagnosticoPdf";

export default function GerarDiagnosticoPdfButton({
  cliente,
  diagnostico,
}: {
  cliente: Cliente;
  diagnostico: DiagnosticoCliente;
}) {
  const [gerando, setGerando] = useState(false);

  function handleClick() {
    setGerando(true);
    try {
      gerarDiagnosticoPdf(cliente, diagnostico);
    } finally {
      setGerando(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={gerando}
      className="bg-brand-red text-white text-sm px-4 py-2 rounded-md hover:bg-brand-redDark transition disabled:opacity-60"
    >
      {gerando ? "Gerando..." : "Emitir diagnóstico em PDF"}
    </button>
  );
}
