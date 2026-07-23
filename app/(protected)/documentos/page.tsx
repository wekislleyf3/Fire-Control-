"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Cliente, Documento } from "@/lib/types";

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

export default function DocumentosPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [tipo, setTipo] = useState(TIPOS_DOCUMENTO[0]);
  const [validade, setValidade] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadClientes() {
    const { data } = await supabase.from("clientes").select("*").order("razao_social");
    setClientes((data as Cliente[]) ?? []);
  }

  async function loadDocumentos(clId: string) {
    if (!clId) {
      setDocumentos([]);
      return;
    }
    const { data, error } = await supabase
      .from("documentos")
      .select("*")
      .eq("cliente_id", clId)
      .order("created_at", { ascending: false });
    if (error) setError(`Erro ao carregar documentos: ${error.message}`);
    setDocumentos((data as Documento[]) ?? []);
  }

  useEffect(() => {
    loadClientes();
    const params = new URLSearchParams(window.location.search);
    const clienteUrl = params.get("cliente");
    if (clienteUrl) setClienteId(clienteUrl);
  }, []);

  useEffect(() => {
    loadDocumentos(clienteId);
  }, [clienteId]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId || !file) return;
    setUploading(true);
    setError(null);

    const caminho = `documentos/${clienteId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("firecontrol-files")
      .upload(caminho, file);

    if (uploadError) {
      setError(`Erro ao enviar arquivo: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("firecontrol-files").getPublicUrl(caminho);

    const { error: insertError } = await supabase.from("documentos").insert([
      {
        cliente_id: clienteId,
        tipo,
        nome_arquivo: file.name,
        arquivo_url: urlData.publicUrl,
        validade: validade || null,
      },
    ]);

    setUploading(false);
    if (insertError) {
      setError(`Erro ao salvar documento: ${insertError.message}`);
      return;
    }

    setFile(null);
    setValidade("");
    loadDocumentos(clienteId);
    router.refresh();
  }

  async function handleDelete(doc: Documento) {
    setError(null);
    // extrai o caminho do storage a partir da URL pública, pra remover o arquivo também
    const marcador = "/firecontrol-files/";
    const idx = doc.arquivo_url.indexOf(marcador);
    const caminho = idx >= 0 ? doc.arquivo_url.slice(idx + marcador.length) : null;

    if (caminho) {
      await supabase.storage.from("firecontrol-files").remove([caminho]);
    }
    const { error } = await supabase.from("documentos").delete().eq("id", doc.id);
    setDeletingId(null);
    if (error) {
      setError(`Erro ao excluir documento: ${error.message}`);
      return;
    }
    loadDocumentos(clienteId);
    router.refresh();
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
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {clienteId && (
        <>
          <form
            onSubmit={handleUpload}
            className="bg-white border border-black/5 rounded-lg p-5 mb-6 grid grid-cols-2 gap-4"
          >
            <p className="col-span-2 text-sm font-medium text-brand-slate">Novo documento</p>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
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
            <button
              disabled={uploading}
              className="col-span-2 bg-brand-red text-white text-sm py-2 rounded-md disabled:opacity-60"
            >
              {uploading ? "Enviando..." : "Enviar documento"}
            </button>
          </form>

          <div className="bg-white border border-black/5 rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-brand-fog text-left text-brand-slate">
                <tr>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Arquivo</th>
                  <th className="px-4 py-3">Validade</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {documentos.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-brand-slate/60">
                      Nenhum documento enviado ainda pra este cliente.
                    </td>
                  </tr>
                )}
                {documentos.map((doc) => (
                  <tr key={doc.id} className="border-t border-black/5">
                    <td className="px-4 py-3">{doc.tipo}</td>
                    <td className="px-4 py-3">
                      <a
                        href={doc.arquivo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-red underline"
                      >
                        {doc.nome_arquivo}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {doc.validade ? new Date(doc.validade + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {deletingId === doc.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(doc)}
                            className="text-xs text-white bg-brand-red px-2 py-1 rounded"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="text-xs px-2 py-1 rounded border"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(doc.id)}
                          className="text-xs text-brand-red underline"
                        >
                          Excluir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
