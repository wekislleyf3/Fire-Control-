"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TIPOS_EQUIPAMENTO, checklistPadraoDoTipo, type Procedimento, type ProcedimentoItem } from "@/lib/metodoFire";

const supabase = createClient();

type ItemForm = { id?: string; chave: string; pergunta: string; norma_referencia: string; critico: boolean };

function novoItem(): ItemForm {
  return { chave: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`, pergunta: "", norma_referencia: "", critico: false };
}

const emptyProcedimento = {
  nome: "",
  descricao: "",
  objetivo: "",
  responsavel_padrao: "",
  normas_relacionadas: "",
  documentos_necessarios: "",
  frequencia: "",
};

export default function MetodoFirePage() {
  const [procedimentos, setProcedimentos] = useState<Record<string, Procedimento>>({});
  const [loading, setLoading] = useState(true);
  const [tipoAberto, setTipoAberto] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyProcedimento });
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from("procedimentos").select("*");
    const mapa: Record<string, Procedimento> = {};
    for (const p of (data as Procedimento[]) ?? []) mapa[p.tipo_equipamento] = p;
    setProcedimentos(mapa);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function abrirTipo(tipo: string) {
    setError(null);
    setSucesso(null);
    setTipoAberto(tipo);
    const existente = procedimentos[tipo];

    if (existente) {
      setForm({
        nome: existente.nome,
        descricao: existente.descricao ?? "",
        objetivo: existente.objetivo ?? "",
        responsavel_padrao: existente.responsavel_padrao ?? "",
        normas_relacionadas: existente.normas_relacionadas ?? "",
        documentos_necessarios: existente.documentos_necessarios ?? "",
        frequencia: existente.frequencia ?? "",
      });
      const { data } = await supabase
        .from("procedimento_itens")
        .select("*")
        .eq("procedimento_id", existente.id)
        .order("ordem", { ascending: true });
      setItens(
        ((data as ProcedimentoItem[]) ?? []).map((i) => ({
          id: i.id,
          chave: i.chave,
          pergunta: i.pergunta,
          norma_referencia: i.norma_referencia ?? "",
          critico: i.critico,
        }))
      );
    } else {
      // Ponto de partida: nome padrão + checklist atual (hardcoded) do tipo,
      // pra não começar do zero — dá pra editar/remover itens livremente.
      setForm({ ...emptyProcedimento, nome: `Procedimento — ${tipo}` });
      setItens(
        checklistPadraoDoTipo(tipo).map((i) => ({
          chave: i.key,
          pergunta: i.label,
          norma_referencia: i.norma_referencia ?? "",
          critico: !!i.critico,
        }))
      );
    }
  }

  function fechar() {
    setTipoAberto(null);
    setForm({ ...emptyProcedimento });
    setItens([]);
  }

  function atualizarItem(idx: number, campo: keyof ItemForm, valor: string | boolean) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)));
  }

  function moverItem(idx: number, direcao: -1 | 1) {
    setItens((prev) => {
      const novo = [...prev];
      const alvo = idx + direcao;
      if (alvo < 0 || alvo >= novo.length) return prev;
      [novo[idx], novo[alvo]] = [novo[alvo], novo[idx]];
      return novo;
    });
  }

  function removerItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  async function salvar() {
    if (!tipoAberto || !form.nome.trim()) return;
    setSalvando(true);
    setError(null);

    try {
      const existente = procedimentos[tipoAberto];
      let procedimentoId = existente?.id;

      if (existente) {
        const { error: updError } = await supabase
          .from("procedimentos")
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq("id", existente.id);
        if (updError) throw new Error(updError.message);
      } else {
        const { data: criado, error: insError } = await supabase
          .from("procedimentos")
          .insert({ tipo_equipamento: tipoAberto, ...form })
          .select("id")
          .single();
        if (insError || !criado) throw new Error(insError?.message ?? "erro ao criar procedimento");
        procedimentoId = criado.id;
      }

      // Substitui todos os itens (mais simples e seguro que tentar diffar).
      await supabase.from("procedimento_itens").delete().eq("procedimento_id", procedimentoId);
      if (itens.length > 0) {
        const { error: itensError } = await supabase.from("procedimento_itens").insert(
          itens.map((it, ordem) => ({
            procedimento_id: procedimentoId,
            chave: it.chave,
            pergunta: it.pergunta,
            norma_referencia: it.norma_referencia || null,
            critico: it.critico,
            ordem,
          }))
        );
        if (itensError) throw new Error(itensError.message);
      }

      setSucesso(`Procedimento de "${tipoAberto}" salvo — já vale pra próxima inspeção desse tipo.`);
      await carregar();
      fechar();
    } catch (err) {
      setError(`Erro ao salvar: ${(err as Error).message}`);
    } finally {
      setSalvando(false);
    }
  }

  async function restaurarPadrao(tipo: string) {
    const existente = procedimentos[tipo];
    if (!existente) return;
    setSalvando(true);
    const { error: err } = await supabase.from("procedimentos").delete().eq("id", existente.id);
    setSalvando(false);
    if (err) {
      setError(`Erro ao restaurar padrão: ${err.message}`);
      return;
    }
    setSucesso(`"${tipo}" voltou a usar o checklist padrão do sistema.`);
    await carregar();
    fechar();
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-4xl">Método Fire</h1>
        <p className="text-base text-brand-slate/60">
          Procedimentos padronizados por tipo de equipamento — o que for cadastrado aqui já vale
          automaticamente na próxima inspeção daquele tipo.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">{error}</div>
      )}
      {sucesso && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md px-4 py-3 mb-4">
          {sucesso}
        </div>
      )}

      {loading ? (
        <p className="text-center text-brand-slate/60 py-6">Carregando...</p>
      ) : !tipoAberto ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TIPOS_EQUIPAMENTO.map((tipo) => {
            const custom = procedimentos[tipo];
            return (
              <button
                key={tipo}
                onClick={() => abrirTipo(tipo)}
                className="bg-white border border-black/5 rounded-xl p-4 text-left hover:border-brand-red/40 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{tipo}</p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                      custom ? "bg-blue-50 text-blue-700" : "bg-brand-fog text-brand-slate/60"
                    }`}
                  >
                    {custom ? "Customizado" : "Padrão do sistema"}
                  </span>
                </div>
                {custom?.frequencia && <p className="text-xs text-brand-slate/60 mt-1">Frequência: {custom.frequencia}</p>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-display text-2xl">{tipoAberto}</h2>
            <div className="flex gap-2">
              {procedimentos[tipoAberto] && (
                <button
                  onClick={() => restaurarPadrao(tipoAberto)}
                  disabled={salvando}
                  className="text-xs px-3 py-1.5 rounded-md border text-brand-slate/70 disabled:opacity-50"
                >
                  Restaurar padrão do sistema
                </button>
              )}
              <button onClick={fechar} className="text-xs px-3 py-1.5 rounded-md border">
                Voltar
              </button>
            </div>
          </div>

          <div className="bg-white border border-black/5 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs text-brand-slate">Nome do procedimento *</label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-brand-slate">Descrição</label>
              <textarea
                rows={2}
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-brand-slate">Objetivo</label>
              <textarea
                rows={2}
                value={form.objetivo}
                onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-brand-slate">Responsável padrão</label>
              <input
                value={form.responsavel_padrao}
                onChange={(e) => setForm({ ...form, responsavel_padrao: e.target.value })}
                placeholder="Ex: Técnico de campo"
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-brand-slate">Frequência</label>
              <input
                value={form.frequencia}
                onChange={(e) => setForm({ ...form, frequencia: e.target.value })}
                placeholder="Ex: Mensal, Semestral, Anual"
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-brand-slate">Normas relacionadas</label>
              <input
                value={form.normas_relacionadas}
                onChange={(e) => setForm({ ...form, normas_relacionadas: e.target.value })}
                placeholder="Ex: NBR 12962, NBR 15808"
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-brand-slate">Documentos necessários</label>
              <input
                value={form.documentos_necessarios}
                onChange={(e) => setForm({ ...form, documentos_necessarios: e.target.value })}
                placeholder="Ex: AVCB, ART"
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="bg-white border border-black/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-display text-lg">Checklist de inspeção</p>
              <button onClick={() => setItens((prev) => [...prev, novoItem()])} className="text-xs text-brand-red underline">
                + adicionar item
              </button>
            </div>

            {itens.length === 0 && <p className="text-sm text-brand-slate/60">Nenhum item — adicione pelo menos um.</p>}

            <div className="space-y-2">
              {itens.map((item, idx) => (
                <div key={item.chave} className="border border-black/5 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <input
                        value={item.pergunta}
                        onChange={(e) => atualizarItem(idx, "pergunta", e.target.value)}
                        placeholder="Pergunta do item de verificação"
                        className="w-full border rounded-md px-3 py-2 text-sm mb-2"
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          value={item.norma_referencia}
                          onChange={(e) => atualizarItem(idx, "norma_referencia", e.target.value)}
                          placeholder="Norma (opcional)"
                          className="border rounded-md px-2 py-1 text-xs w-40"
                        />
                        <label className="flex items-center gap-1.5 text-xs text-brand-slate">
                          <input
                            type="checkbox"
                            checked={item.critico}
                            onChange={(e) => atualizarItem(idx, "critico", e.target.checked)}
                          />
                          Item crítico (reprova a inspeção se marcado não conforme)
                        </label>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={() => moverItem(idx, -1)} disabled={idx === 0} className="text-xs px-1.5 py-0.5 rounded border disabled:opacity-30">
                        ↑
                      </button>
                      <button
                        onClick={() => moverItem(idx, 1)}
                        disabled={idx === itens.length - 1}
                        className="text-xs px-1.5 py-0.5 rounded border disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button onClick={() => removerItem(idx)} className="text-xs px-1.5 py-0.5 rounded border text-brand-red">
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={salvar}
              disabled={salvando || !form.nome.trim() || itens.length === 0}
              className="bg-brand-red text-white text-sm px-6 py-2.5 rounded-md hover:bg-brand-redDark transition disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar procedimento"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
