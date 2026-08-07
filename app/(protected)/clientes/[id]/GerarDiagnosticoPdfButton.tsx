"use client";

import { useState } from "react";
import type { Cliente } from "@/types/cliente";
import type { DiagnosticoCliente } from "@/lib/diagnostico";
import { gerarDiagnosticoPdf, type AutenticacaoLaudo } from "@/lib/pdf/diagnosticoPdf";

export default function GerarDiagnosticoPdfButton({
  cliente,
  diagnostico,
}: {
  cliente: Cliente;
  diagnostico: DiagnosticoCliente;
}) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleClick() {
    setGerando(true);
    setErro(null);
    try {
      let autenticacao: AutenticacaoLaudo | null = null;
      try {
        const resp = await fetch("/api/laudos/emitir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipoDocumento: "diagnostico", clienteId: cliente.id }),
        });

        if (!resp.ok) {
          const corpoErro = await resp.text().catch(() => "");
          console.error(`[selo] /api/laudos/emitir (diagnostico) respondeu ${resp.status}:`, corpoErro);
          setErro(`Falha ao emitir o selo (HTTP ${resp.status}): ${corpoErro.slice(0, 200)}`);
        } else {
          const data = await resp.json();
          if (data?.token && data?.hash && data?.dataEmissao) {
            autenticacao = { token: data.token, hash: data.hash, dataEmissao: data.dataEmissao };
          } else {
            console.error("[selo] resposta sem token/hash/dataEmissao:", data);
            setErro(`Selo emitido incompleto: ${JSON.stringify(data).slice(0, 200)}`);
          }
        }
      } catch (err) {
        console.error("[selo] falha de rede ao emitir selo do diagnóstico:", err);
        setErro(`Falha de rede ao emitir o selo: ${(err as Error).message}`);
      }

      await gerarDiagnosticoPdf(cliente, diagnostico, autenticacao);
    } catch (err) {
      console.error("[pdf] falha ao gerar o PDF de diagnóstico:", err);
      setErro(`Erro ao gerar o PDF: ${(err as Error).message}`);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={gerando}
        className="bg-brand-red text-white text-sm px-4 py-2 rounded-md hover:bg-brand-redDark transition disabled:opacity-60"
      >
        {gerando ? "Gerando..." : "Emitir diagnóstico em PDF"}
      </button>
      {erro && <p className="text-xs text-brand-red mt-2 max-w-sm">{erro}</p>}
    </div>
  );
}
