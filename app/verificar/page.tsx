"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Página de entrada manual do código. Quem escaneia o QR já cai direto em
 * /verificar/[token]; esta aqui é só pra quem quer digitar o código à mão
 * (ex: alguém liu o código impresso no laudo em vez de escanear o QR).
 */
export default function VerificarBuscaPage() {
  const router = useRouter();
  const [token, setToken] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valor = token.trim();
    if (valor) router.push(`/verificar/${encodeURIComponent(valor)}`);
  }

  return (
    <div className="min-h-screen bg-brand-fog flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg border border-black/5 shadow-sm p-6">
        <p className="font-display text-2xl text-center">
          FIRECONTROL <span className="text-brand-red">OS</span>
        </p>
        <p className="text-sm text-brand-slate/70 text-center mt-1 mb-6">
          Verificação de autenticidade de laudo de inspeção
        </p>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Cole aqui o código de autenticação do laudo"
            className="flex-1 border rounded-md px-3 py-2 text-sm font-mono tracking-wide"
            autoFocus
          />
          <button
            type="submit"
            className="bg-brand-red text-white text-sm px-4 py-2 rounded-md hover:bg-brand-redDark transition"
          >
            Verificar
          </button>
        </form>

        <p className="text-xs text-brand-slate/50 text-center mt-4">
          O código fica embaixo do QR Code, no canto do laudo em PDF.
        </p>
      </div>
    </div>
  );
}
