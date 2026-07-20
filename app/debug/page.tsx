"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function DebugPage() {
  const [pingResult, setPingResult] = useState<string>("testando...");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(vazio)";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "(vazio)";

  useEffect(() => {
    supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .then(({ error, count }) => {
        if (error) setPingResult(`ERRO: ${error.message}`);
        else setPingResult(`OK — conectou, ${count ?? 0} clientes encontrados`);
      });
  }, []);

  return (
    <div className="font-mono text-sm space-y-4">
      <h1 className="font-display text-2xl">Diagnóstico</h1>
      <div>
        <p className="text-brand-slate">NEXT_PUBLIC_SUPABASE_URL (entre aspas, pra revelar espaços):</p>
        <p className="bg-white border rounded p-3 break-all">{JSON.stringify(url)}</p>
        <p className="text-xs text-brand-slate mt-1">
          Tamanho: {url.length} caracteres. Deve começar com "https://" e terminar em ".co" — sem barra "/" no final.
        </p>
      </div>
      <div>
        <p className="text-brand-slate">NEXT_PUBLIC_SUPABASE_ANON_KEY (primeiros/últimos 6 caracteres):</p>
        <p className="bg-white border rounded p-3 break-all">
          {key.length > 12 ? `${key.slice(0, 6)}...${key.slice(-6)}` : JSON.stringify(key)}
        </p>
        <p className="text-xs text-brand-slate mt-1">Tamanho: {key.length} caracteres.</p>
      </div>
      <div>
        <p className="text-brand-slate">Teste de conexão real com o Supabase:</p>
        <p className="bg-white border rounded p-3 break-all">{pingResult}</p>
      </div>
    </div>
  );
}
