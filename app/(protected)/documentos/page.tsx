"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Cliente, Documento } from "@/lib/types";
import { calcularUrgencia, severityStyle } from "@/lib/alerts";
import { documentosService, ValidationError } from "@/lib/services/documentosService";
import { clientesService } from "@/lib/services/clientesService";

const supabase = createClient();

const TIPOS_DOCUMENTO = [
  "AVCB",
  "CLCB",
  "ART",
  "Projeto",
  "Laudo",
  "Contrato",
  "Certificado",
  "Nota fiscal",
  "Ordem de serviço",
];

function situacaoDocumento(validade: string | null) {
  if (!validade) return { label: "Sem validade definida", style: "bg-brand-fog text-brand-slate/60 border-black/10" };
  const urgencia = calcularUrgencia(validade);
  if (!urgencia) return { label: "Válido", style: severityStyle.ok };
  return { label: urgencia.label, style: severityStyle[urgencia.severity] };
}

export default function DocumentosPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [tipo, setTipo] = useState(TIPOS_DOCUMENTO[0]);
  const [validade, setValidade] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // edição rápida de validade
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novaValidade, setNovaValidade] = useState("");

  // renovação (novo arquivo substituindo um vigente)
  const [renovandoId, setRenovandoId] = useState<string | null>(null);
  const [arquivoRenovacao, setArquivoRenovacao] = useState<File | null>(null);
  const [validadeRenovacao, setValidadeRenovacao] = useState("");
  const [processandoRenovacao, setProcessandoRenovacao] = useState(false);

  async function loadClientes() {
    const data = await clientesService.list(supabase);
    setClientes([...data].sort((a, b) => a.razao_social.localeCompare(b.razao_social)));
  }

  async function loadDocumentos(clId: string) {
    if (!clId) {
      setDocumentos([]);
      return;
    }
    try {
      const data = await documentosService.listPorCliente(supabase, clId, mostrarHistorico);
      setDocumentos(data);
    } catch (err) {
      setError(`Erro ao carregar documentos: ${(err as Error).message}`);
    }
  }

  useEffect(() => {
    loadClientes();
    const params = new URLSearchParams(window.location.search);
    const clienteUrl = params.get("cliente");
    if (clienteUrl) setClienteId(clienteUrl);
  }, []);

  useEffect(() => {
    loadDocumentos(clienteId);
  }, [clienteId, mostrarHistorico]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId || !file) return;
    setUploading(true);
    setError(null);

    try {
      await documentosService.upload(supabase, { clienteId, tipo, validade: validade || null, file });
      setFile(null);
      setValidade("");
      loadDocumentos(clienteId);
      router.refresh();
    } catch (err) {
      const mensagem =
        err instanceof ValidationError ? err.message : `Erro ao enviar documento: ${(err as Error).message}`;
      setError(mensagem);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: Documento) {
    setError(null);
    try {
      await documentosService.remove(supabase, doc);
      loadDocumentos(clienteId);
      router.refresh();
    } catch (err) {
      setError(`Erro ao excluir documento: ${(err as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  }

  function iniciarEdicaoValidade(doc: Documento) {
    setEditandoId(doc.id);
    setNovaValidade(doc.validade ?? "");
  }

  async function salvarValidade(doc: Documento) {
    setError(null);
    try {
      await documentosService.atualizarValidade(supabase, doc.id, novaValidade || null);
      loadDocumentos(clienteId);
      router.refresh();
    } catch (err) {
      setError(`Erro ao atualizar validade: ${(err as Error).message}`);
    } finally {
      setEditandoId(null);
    }
  }

  function iniciarRenovacao(doc: Documento) {
    setRenovandoId(doc.id);
    setValidadeRenovacao(doc.validade ?? "");
    setArquivoRenovacao(null);
  }

  async function confirmarRenovacao(doc: Documento) {
    if (!arquivoRenovacao) {
      setError("Selecione o novo arquivo pra renovar o documento.");
      return;
    }
    setProcessandoRenovacao(true);
    setError(null);

    try {
      await documentosService.renovar(supabase, {
        clienteId,
        docAntigo: doc,
        file: arquivoRenovacao,
        validade: validadeRenovacao || null,
      });

      setSucesso(`${doc.tipo} renovado com sucesso.`);
      setRenovandoId(null);
      setArquivoRenovacao(null);
      loadDocumentos(clienteId);
      router.refresh();
    } catch (err) {
      const mensagem =
        err instanceof ValidationError ? err.message : `Erro ao renovar documento: ${(err as Error).message}`;
      setError(mensagem);
    } finally {
      setProcessandoRenovacao(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-6">Documentos</h1>

      <div className="bg-white border border-black/5 rounded-lg p-5 mb-6">
        <label className="text-sm text-brand-slate">Cliente</label>
        <select
          className="border rounded-md px-3 py-2 text-sm w-full mt-1"
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
        >
          <option value="">Selecione um cliente</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.razao_social}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">{error}</div>
      )}
      {sucesso && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md px-4 py-3 mb-4">
          {sucesso}
        </div>
      )}

      {clienteId && (
        <>
          <form onSubmit={handleUpload} className="bg-white border border-black/5 rounded-lg p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <p className="col-span-2 text-sm font-medium text-brand-slate">Novo documento</p>
            <select className="border rounded-md px-3 py-2 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input
              type="date"
              className="border rounded-md px-3 py-2 text-sm"
              placeholder="Validade (opcional)"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
            />
            <input
              required
              type="file"
              className="border rounded-md px-3 py-2 text-sm col-span-2"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button disabled={uploading} className="col-span-2 bg-brand-red text-white text-sm py-2 rounded-md disabled:opacity-60">
              {uploading ? "Enviando..." : "Enviar documento"}
            </button>
          </form>

          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <p className="text-sm text-brand-slate/60">
              {documentos.length} documento{documentos.length !== 1 ? "s" : ""} {mostrarHistorico ? "(com histórico)" : "vigente(s)"}
            </p>
            <label className="flex items-center gap-2 text-xs text-brand-slate/70">
              <input type="checkbox" checked={mostrarHistorico} onChange={(e) => setMostrarHistorico(e.target.checked)} />
              Ver histórico (documentos substituídos)
            </label>
          </div>

          <div className="bg-white border border-black/5 rounded-lg overflow-hidden sm:overflow-x-auto">
            {/* Celular */}
            <div className="sm:hidden divide-y divide-black/5">
              {documentos.length === 0 && (
                <p className="px-4 py-6 text-center text-brand-slate/60">Nenhum documento encontrado.</p>
              )}
              {documentos.map((doc) => {
                const substituido = doc.status === "substituido";
                const situacao = situacaoDocumento(doc.validade);
                return (
                  <div key={doc.id} className={`px-4 py-3 ${substituido ? "opacity-50" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{doc.tipo}</p>
                        <a href={doc.arquivo_url} target="_blank" rel="noreferrer" className="text-xs text-brand-red underline">
                          {doc.nome_arquivo}
                        </a>
                        {substituido && <span className="text-[10px] text-brand-slate/50 block">substituído</span>}
                      </div>
                      {!substituido && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${situacao.style}`}>{situacao.label}</span>
                      )}
                    </div>

                    <div className="mt-2">
                      {editandoId === doc.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="date"
                            value={novaValidade}
                            onChange={(e) => setNovaValidade(e.target.value)}
                            className="border rounded px-2 py-1 text-xs"
                          />
                          <button onClick={() => salvarValidade(doc)} className="text-xs text-white bg-brand-red px-2 py-1 rounded">
                            Salvar
                          </button>
                          <button onClick={() => setEditandoId(null)} className="text-xs px-2 py-1 rounded border">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-brand-slate/60">
                          Validade: {doc.validade ? new Date(doc.validade + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                        </p>
                      )}
                    </div>

                    {!substituido && editandoId !== doc.id && renovandoId !== doc.id && (
                      <div className="flex flex-wrap gap-3 mt-2">
                        <button onClick={() => iniciarEdicaoValidade(doc)} className="text-xs text-brand-slate underline">
                          editar validade
                        </button>
                        <button onClick={() => iniciarRenovacao(doc)} className="text-xs text-blue-700 underline">
                          renovar
                        </button>
                        {deletingId === doc.id ? (
                          <span className="flex items-center gap-2">
                            <button onClick={() => handleDelete(doc)} className="text-xs text-white bg-brand-red px-2 py-1 rounded">
                              Confirmar
                            </button>
                            <button onClick={() => setDeletingId(null)} className="text-xs px-2 py-1 rounded border">
                              Cancelar
                            </button>
                          </span>
                        ) : (
                          <button onClick={() => setDeletingId(doc.id)} className="text-xs text-brand-red underline">
                            excluir
                          </button>
                        )}
                      </div>
                    )}

                    {renovandoId === doc.id && (
                      <div className="mt-2 bg-blue-50/60 rounded-md p-3">
                        <p className="text-xs font-medium text-blue-800 mb-2">
                          Renovar {doc.tipo} — envie o novo arquivo e a nova validade
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="file"
                            onChange={(e) => setArquivoRenovacao(e.target.files?.[0] ?? null)}
                            className="text-xs border rounded px-2 py-1 w-full"
                          />
                          <input
                            type="date"
                            value={validadeRenovacao}
                            onChange={(e) => setValidadeRenovacao(e.target.value)}
                            className="text-xs border rounded px-2 py-1"
                          />
                          <button
                            onClick={() => confirmarRenovacao(doc)}
                            disabled={processandoRenovacao}
                            className="text-xs text-white bg-blue-700 px-3 py-1.5 rounded disabled:opacity-50"
                          >
                            {processandoRenovacao ? "Enviando..." : "Confirmar"}
                          </button>
                          <button onClick={() => setRenovandoId(null)} className="text-xs px-2 py-1 rounded border">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tablet/desktop */}
            <table className="w-full text-sm min-w-[720px] hidden sm:table">
              <thead className="bg-brand-fog text-left text-brand-slate">
                <tr>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Arquivo</th>
                  <th className="px-4 py-3">Validade</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {documentos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-brand-slate/60">
                      Nenhum documento encontrado.
                    </td>
                  </tr>
                )}
                {documentos.map((doc) => {
                  const substituido = doc.status === "substituido";
                  const situacao = situacaoDocumento(doc.validade);
                  return (
                    <>
                      <tr key={doc.id} className={`border-t border-black/5 ${substituido ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3">{doc.tipo}</td>
                        <td className="px-4 py-3">
                          <a href={doc.arquivo_url} target="_blank" rel="noreferrer" className="text-brand-red underline">
                            {doc.nome_arquivo}
                          </a>
                          {substituido && <span className="text-[10px] text-brand-slate/50 block">substituído</span>}
                        </td>
                        <td className="px-4 py-3">
                          {editandoId === doc.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={novaValidade}
                                onChange={(e) => setNovaValidade(e.target.value)}
                                className="border rounded px-2 py-1 text-xs"
                              />
                              <button onClick={() => salvarValidade(doc)} className="text-xs text-white bg-brand-red px-2 py-1 rounded">
                                Salvar
                              </button>
                              <button onClick={() => setEditandoId(null)} className="text-xs px-2 py-1 rounded border">
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <span>{doc.validade ? new Date(doc.validade + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!substituido && (
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${situacao.style}`}>{situacao.label}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!substituido && editandoId !== doc.id && renovandoId !== doc.id && (
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => iniciarEdicaoValidade(doc)} className="text-xs text-brand-slate underline">
                                editar validade
                              </button>
                              <button onClick={() => iniciarRenovacao(doc)} className="text-xs text-blue-700 underline">
                                renovar
                              </button>
                              {deletingId === doc.id ? (
                                <span className="flex items-center gap-2">
                                  <button onClick={() => handleDelete(doc)} className="text-xs text-white bg-brand-red px-2 py-1 rounded">
                                    Confirmar
                                  </button>
                                  <button onClick={() => setDeletingId(null)} className="text-xs px-2 py-1 rounded border">
                                    Cancelar
                                  </button>
                                </span>
                              ) : (
                                <button onClick={() => setDeletingId(doc.id)} className="text-xs text-brand-red underline">
                                  excluir
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      {renovandoId === doc.id && (
                        <tr className="border-t border-black/5 bg-blue-50/40">
                          <td colSpan={5} className="px-4 py-3">
                            <p className="text-xs font-medium text-blue-800 mb-2">
                              Renovar {doc.tipo} — envie o novo arquivo e a nova validade
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="file"
                                onChange={(e) => setArquivoRenovacao(e.target.files?.[0] ?? null)}
                                className="text-xs border rounded px-2 py-1"
                              />
                              <input
                                type="date"
                                value={validadeRenovacao}
                                onChange={(e) => setValidadeRenovacao(e.target.value)}
                                className="text-xs border rounded px-2 py-1"
                              />
                              <button
                                onClick={() => confirmarRenovacao(doc)}
                                disabled={processandoRenovacao}
                                className="text-xs text-white bg-blue-700 px-3 py-1.5 rounded disabled:opacity-50"
                              >
                                {processandoRenovacao ? "Enviando..." : "Confirmar renovação"}
                              </button>
                              <button onClick={() => setRenovandoId(null)} className="text-xs px-2 py-1 rounded border">
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
