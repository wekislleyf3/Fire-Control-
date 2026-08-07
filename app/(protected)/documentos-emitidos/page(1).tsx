"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type LinhaLaudo = {
  token_validacao: string;
  tipo_documento: "inspecao" | "diagnostico";
  status: "valido" | "revogado";
  data_emissao: string;
  inspecoes: {
    resultado: string;
    equipamentos: { codigo_interno: string; tipo: string } | null;
    clientes: { razao_social: string } | null;
  } | null;
  clientes: { razao_social: string } | null;
};

const supabase = createClient();

export default function DocumentosEmitidosPage() {
  const [laudos, setLaudos] = useState<LinhaLaudo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "valido" | "revogado">("todos");
  const [busca, setBusca] = useState("");
  const [revogandoToken, setRevogandoToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("laudos_autenticacao")
      .select(
        `token_validacao, tipo_documento, status, data_emissao,
         inspecoes ( resultado, equipamentos ( codigo_interno, tipo ), clientes ( razao_social ) ),
         clientes ( razao_social )`
      )
      .order("data_emissao", { ascending: false })
      .limit(200);

    if (err) {
      setError(`Erro ao carregar documentos emitidos: ${err.message}`);
    } else {
      setLaudos((data as unknown as LinhaLaudo[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleRevogar(token: string) {
    setError(null);
    const { error: err } = await supabase
      .from("laudos_autenticacao")
      .update({ status: "revogado" })
      .eq("token_validacao", token);

    setRevogandoToken(null);
    if (err) {
      setError(`Erro ao revogar selo: ${err.message}`);
      return;
    }
    carregar();
  }

  function clienteDe(laudo: LinhaLaudo): string {
    if (laudo.tipo_documento === "inspecao") return laudo.inspecoes?.clientes?.razao_social ?? "—";
    return laudo.clientes?.razao_social ?? "—";
  }

  function equipamentoDe(laudo: LinhaLaudo): string {
    if (laudo.tipo_documento !== "inspecao" || !laudo.inspecoes?.equipamentos) return "—";
    return `${laudo.inspecoes.equipamentos.codigo_interno} — ${laudo.inspecoes.equipamentos.tipo}`;
  }

  const laudosFiltrados = laudos.filter((l) => {
    if (filtroStatus !== "todos" && l.status !== filtroStatus) return false;
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return (
      clienteDe(l).toLowerCase().includes(termo) ||
      equipamentoDe(l).toLowerCase().includes(termo) ||
      l.token_validacao.toLowerCase().includes(termo)
    );
  });

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-display text-4xl">Documentos emitidos</h1>
          <p className="text-base text-brand-slate/60">
            Todos os selos de autenticidade já emitidos (laudos de inspeção e diagnósticos).
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente, equipamento ou token..."
          className="flex-1 border rounded-md px-3 py-2 text-sm"
        />
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="todos">Todos os status</option>
          <option value="valido">Válidos</option>
          <option value="revogado">Revogados</option>
        </select>
      </div>

      <div className="bg-white border border-black/5 rounded-lg overflow-hidden sm:overflow-x-auto">
        {/* Celular */}
        <div className="sm:hidden divide-y divide-black/5">
          {loading && <p className="px-4 py-6 text-center text-brand-slate/60">Carregando...</p>}
          {!loading && laudosFiltrados.length === 0 && (
            <p className="px-4 py-6 text-center text-brand-slate/60">Nenhum documento emitido encontrado.</p>
          )}
          {laudosFiltrados.map((laudo) => (
            <div key={laudo.token_validacao} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{clienteDe(laudo)}</p>
                  <p className="text-xs text-brand-slate/60">
                    {laudo.tipo_documento === "inspecao" ? "Inspeção" : "Diagnóstico"}
                    {equipamentoDe(laudo) !== "—" && ` · ${equipamentoDe(laudo)}`}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    laudo.status === "valido" ? "bg-green-100 text-green-700" : "bg-red-100 text-brand-red"
                  }`}
                >
                  {laudo.status === "valido" ? "Válido" : "Revogado"}
                </span>
              </div>
              <p className="text-xs text-brand-slate/60 mt-1">{new Date(laudo.data_emissao).toLocaleString("pt-BR")}</p>

              <div className="flex flex-wrap items-center gap-3 mt-2">
                <Link href={`/verificar/${laudo.token_validacao}`} target="_blank" className="text-xs text-brand-slate underline">
                  Ver
                </Link>
                {laudo.status === "valido" &&
                  (revogandoToken === laudo.token_validacao ? (
                    <span className="flex items-center gap-2">
                      <button
                        onClick={() => handleRevogar(laudo.token_validacao)}
                        className="text-xs text-white bg-brand-red px-2 py-1 rounded"
                      >
                        Confirmar
                      </button>
                      <button onClick={() => setRevogandoToken(null)} className="text-xs px-2 py-1 rounded border">
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setRevogandoToken(laudo.token_validacao)} className="text-xs text-brand-red underline">
                      Revogar
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* Tablet/desktop */}
        <table className="w-full text-sm min-w-[720px] hidden sm:table">
          <thead className="bg-brand-fog text-brand-slate/70 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Equipamento</th>
              <th className="px-4 py-3 text-left">Emitido em</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-brand-slate/60">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && laudosFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-brand-slate/60">
                  Nenhum documento emitido encontrado.
                </td>
              </tr>
            )}
            {laudosFiltrados.map((laudo) => (
              <tr key={laudo.token_validacao} className="border-t border-black/5">
                <td className="px-4 py-3">
                  {laudo.tipo_documento === "inspecao" ? "Inspeção" : "Diagnóstico"}
                </td>
                <td className="px-4 py-3">{clienteDe(laudo)}</td>
                <td className="px-4 py-3">{equipamentoDe(laudo)}</td>
                <td className="px-4 py-3">{new Date(laudo.data_emissao).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      laudo.status === "valido"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-brand-red"
                    }`}
                  >
                    {laudo.status === "valido" ? "Válido" : "Revogado"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/verificar/${laudo.token_validacao}`}
                      target="_blank"
                      className="text-xs text-brand-slate underline"
                    >
                      Ver
                    </Link>
                    {laudo.status === "valido" &&
                      (revogandoToken === laudo.token_validacao ? (
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-brand-slate">Revogar?</span>
                          <button
                            onClick={() => handleRevogar(laudo.token_validacao)}
                            className="text-xs text-white bg-brand-red px-2 py-1 rounded"
                          >
                            Sim
                          </button>
                          <button
                            onClick={() => setRevogandoToken(null)}
                            className="text-xs px-2 py-1 rounded border"
                          >
                            Não
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setRevogandoToken(laudo.token_validacao)}
                          className="text-xs text-brand-red underline"
                        >
                          Revogar
                        </button>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
