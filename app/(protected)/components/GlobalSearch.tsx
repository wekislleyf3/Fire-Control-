"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Users, Wrench, FolderOpen, ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type ResultadoCliente = { id: string; razao_social: string; nome_fantasia: string | null; matricula: string | null };
type ResultadoEquipamento = { id: string; codigo_interno: string; tipo: string; localizacao: string | null };
type ResultadoDocumento = { id: string; nome_arquivo: string; tipo: string; cliente_id: string };
type ResultadoInspecao = { id: string; observacoes: string | null; created_at: string };

type Resultados = {
  clientes: ResultadoCliente[];
  equipamentos: ResultadoEquipamento[];
  documentos: ResultadoDocumento[];
  inspecoes: ResultadoInspecao[];
};

const VAZIO: Resultados = { clientes: [], equipamentos: [], documentos: [], inspecoes: [] };

export default function GlobalSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<Resultados>(VAZIO);

  useEffect(() => {
    const termo = query.trim();
    if (termo.length < 2) {
      setResultados(VAZIO);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(async () => {
      const like = `%${termo}%`;

      const [clientesRes, equipamentosRes, documentosRes, inspecoesRes] = await Promise.all([
        supabase
          .from("clientes")
          .select("id, razao_social, nome_fantasia, matricula")
          .or(`razao_social.ilike.${like},nome_fantasia.ilike.${like},cnpj.ilike.${like},cpf.ilike.${like}`)
          .limit(5),
        supabase
          .from("equipamentos")
          .select("id, codigo_interno, tipo, localizacao")
          .or(`codigo_interno.ilike.${like},tipo.ilike.${like},localizacao.ilike.${like},numero_serie.ilike.${like}`)
          .limit(5),
        supabase
          .from("documentos")
          .select("id, nome_arquivo, tipo, cliente_id")
          .or(`nome_arquivo.ilike.${like},tipo.ilike.${like}`)
          .limit(5),
        supabase
          .from("inspecoes")
          .select("id, observacoes, created_at")
          .not("observacoes", "is", null)
          .ilike("observacoes", like)
          .limit(5),
      ]);

      setResultados({
        clientes: (clientesRes.data as ResultadoCliente[]) ?? [],
        equipamentos: (equipamentosRes.data as ResultadoEquipamento[]) ?? [],
        documentos: (documentosRes.data as ResultadoDocumento[]) ?? [],
        inspecoes: (inspecoesRes.data as ResultadoInspecao[]) ?? [],
      });
      setLoading(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);

  const totalResultados =
    resultados.clientes.length +
    resultados.equipamentos.length +
    resultados.documentos.length +
    resultados.inspecoes.length;

  function irPara(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-slate/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar cliente, equipamento, documento..."
          className="w-full border rounded-md pl-9 pr-8 py-2 text-sm focus:ring-2 focus:ring-brand-red/30 focus:border-brand-red outline-none"
        />
        {loading && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-brand-slate/40" />
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-black/10 rounded-md shadow-lg max-h-[70vh] overflow-y-auto">
          {!loading && totalResultados === 0 && (
            <p className="text-sm text-brand-slate/60 p-4 text-center">Nada encontrado para "{query}".</p>
          )}

          {resultados.clientes.length > 0 && (
            <div className="py-2">
              <p className="px-3 pb-1 text-[11px] font-semibold text-brand-slate/50 uppercase flex items-center gap-1.5">
                <Users size={12} /> Clientes
              </p>
              {resultados.clientes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => irPara(`/clientes/${c.id}`)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-brand-fog transition"
                >
                  <p className="font-medium">{c.razao_social}</p>
                  <p className="text-xs text-brand-slate/50">
                    {c.matricula ?? "sem matrícula"} {c.nome_fantasia ? `· ${c.nome_fantasia}` : ""}
                  </p>
                </button>
              ))}
            </div>
          )}

          {resultados.equipamentos.length > 0 && (
            <div className="py-2 border-t border-black/5">
              <p className="px-3 pb-1 text-[11px] font-semibold text-brand-slate/50 uppercase flex items-center gap-1.5">
                <Wrench size={12} /> Equipamentos
              </p>
              {resultados.equipamentos.map((eq) => (
                <button
                  key={eq.id}
                  onClick={() => irPara(`/equipamentos?busca=${encodeURIComponent(eq.codigo_interno)}`)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-brand-fog transition"
                >
                  <p className="font-medium">
                    {eq.codigo_interno} — {eq.tipo}
                  </p>
                  <p className="text-xs text-brand-slate/50">{eq.localizacao ?? "sem localização"}</p>
                </button>
              ))}
            </div>
          )}

          {resultados.documentos.length > 0 && (
            <div className="py-2 border-t border-black/5">
              <p className="px-3 pb-1 text-[11px] font-semibold text-brand-slate/50 uppercase flex items-center gap-1.5">
                <FolderOpen size={12} /> Documentos
              </p>
              {resultados.documentos.map((d) => (
                <button
                  key={d.id}
                  onClick={() => irPara(`/documentos?cliente=${d.cliente_id}`)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-brand-fog transition"
                >
                  <p className="font-medium truncate">{d.nome_arquivo}</p>
                  <p className="text-xs text-brand-slate/50">{d.tipo}</p>
                </button>
              ))}
            </div>
          )}

          {resultados.inspecoes.length > 0 && (
            <div className="py-2 border-t border-black/5">
              <p className="px-3 pb-1 text-[11px] font-semibold text-brand-slate/50 uppercase flex items-center gap-1.5">
                <ClipboardCheck size={12} /> Inspeções
              </p>
              {resultados.inspecoes.map((i) => (
                <button
                  key={i.id}
                  onClick={() => irPara("/inspecoes")}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-brand-fog transition"
                >
                  <p className="font-medium truncate">{i.observacoes}</p>
                  <p className="text-xs text-brand-slate/50">
                    {new Date(i.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
