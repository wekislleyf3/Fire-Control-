"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Cliente, Equipamento } from "@/lib/types";
import type { EventoAgenda, EventoAgendaInput } from "@/types/agendaEvento";
import { TIPOS_EVENTO } from "@/types/agendaEvento";

const supabase = createClient();

const prioridadeCor: Record<string, string> = {
  baixa: "bg-blue-50 text-blue-700 border-blue-200",
  normal: "bg-gray-50 text-brand-slate border-black/10",
  alta: "bg-red-50 text-brand-red border-red-200",
};

const statusCor: Record<string, string> = {
  agendado: "bg-amber-100 text-amber-700",
  concluido: "bg-green-100 text-green-700",
  cancelado: "bg-gray-200 text-gray-500 line-through",
};

const emptyForm: EventoAgendaInput = {
  cliente_id: null,
  equipamento_id: null,
  tipo: "visita",
  titulo: "",
  data: format(new Date(), "yyyy-MM-dd"),
  horario: null,
  responsavel: null,
  prioridade: "normal",
  status: "agendado",
  observacoes: null,
};

export default function AgendaPage() {
  const [visualizacao, setVisualizacao] = useState<"dia" | "semana" | "mes">("semana");
  const [dataRef, setDataRef] = useState(new Date());
  const [eventos, setEventos] = useState<EventoAgenda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EventoAgendaInput>({ ...emptyForm });
  const [error, setError] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const periodo = useMemo(() => {
    if (visualizacao === "dia") return { inicio: dataRef, fim: dataRef };
    if (visualizacao === "semana")
      return { inicio: startOfWeek(dataRef, { locale: ptBR }), fim: endOfWeek(dataRef, { locale: ptBR }) };
    return { inicio: startOfMonth(dataRef), fim: endOfMonth(dataRef) };
  }, [visualizacao, dataRef]);

  async function carregarEventos() {
    setLoading(true);
    const inicioStr = format(periodo.inicio, "yyyy-MM-dd");
    const fimStr = format(periodo.fim, "yyyy-MM-dd");
    const { data, error: err } = await supabase
      .from("agenda_eventos")
      .select("*")
      .gte("data", inicioStr)
      .lte("data", fimStr)
      .order("data", { ascending: true })
      .order("horario", { ascending: true, nullsFirst: false });

    if (err) setError(`Erro ao carregar agenda: ${err.message}`);
    else setEventos((data as EventoAgenda[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    carregarEventos();
  }, [periodo.inicio.getTime(), periodo.fim.getTime()]);

  useEffect(() => {
    async function carregarBase() {
      const [cl, eq] = await Promise.all([
        supabase.from("clientes").select("*").order("razao_social"),
        supabase.from("equipamentos").select("*"),
      ]);
      setClientes((cl.data as Cliente[]) ?? []);
      setEquipamentos((eq.data as Equipamento[]) ?? []);
    }
    carregarBase();
  }, []);

  function navegar(direcao: -1 | 1) {
    if (visualizacao === "dia") setDataRef((d) => addDays(d, direcao));
    else if (visualizacao === "semana") setDataRef((d) => addWeeks(d, direcao));
    else setDataRef((d) => addMonths(d, direcao));
  }

  function abrirNovo(diaPreenchido?: Date) {
    setForm({ ...emptyForm, data: format(diaPreenchido ?? dataRef, "yyyy-MM-dd") });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    setSalvando(true);
    setError(null);

    const { error: err } = await supabase.from("agenda_eventos").insert([
      {
        ...form,
        cliente_id: form.cliente_id || null,
        equipamento_id: form.equipamento_id || null,
        horario: form.horario || null,
        responsavel: form.responsavel || null,
        observacoes: form.observacoes || null,
      },
    ]);

    setSalvando(false);
    if (err) {
      setError(`Erro ao salvar evento: ${err.message}`);
      return;
    }
    setShowForm(false);
    setForm({ ...emptyForm });
    carregarEventos();
  }

  async function atualizarStatus(evento: EventoAgenda, status: "concluido" | "cancelado") {
    const { error: err } = await supabase.from("agenda_eventos").update({ status }).eq("id", evento.id);
    if (err) {
      setError(`Erro ao atualizar evento: ${err.message}`);
      return;
    }
    carregarEventos();
  }

  const equipamentosDoCliente = equipamentos.filter((e) => e.cliente_id === form.cliente_id);

  const dias = useMemo(() => {
    const lista: Date[] = [];
    let atual = periodo.inicio;
    while (atual.getTime() <= periodo.fim.getTime()) {
      lista.push(atual);
      atual = addDays(atual, 1);
    }
    return lista;
  }, [periodo]);

  function eventosDoDia(dia: Date) {
    return eventos.filter((ev) => isSameDay(new Date(ev.data + "T00:00:00"), dia));
  }

  function nomeCliente(id: string | null) {
    if (!id) return null;
    return clientes.find((c) => c.id === id)?.razao_social ?? null;
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap mb-4 gap-3">
        <div>
          <h1 className="font-display text-4xl">Agenda</h1>
          <p className="text-base text-brand-slate/60">Visitas, inspeções, manutenções e retornos agendados.</p>
        </div>
        <button
          onClick={() => (showForm ? setShowForm(false) : abrirNovo())}
          className="bg-brand-red text-white text-sm px-4 py-2 rounded-md hover:bg-brand-redDark transition shrink-0"
        >
          {showForm ? "Cancelar" : "+ Novo evento"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-black/5 rounded-lg p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div className="col-span-2">
            <label className="text-xs text-brand-slate">Título *</label>
            <input
              type="text"
              required
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ex: Inspeção semestral"
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-brand-slate">Tipo</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as EventoAgendaInput["tipo"] })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              {TIPOS_EVENTO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-brand-slate">Prioridade</label>
            <select
              value={form.prioridade}
              onChange={(e) => setForm({ ...form, prioridade: e.target.value as EventoAgendaInput["prioridade"] })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-brand-slate">Data *</label>
            <input
              type="date"
              required
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-brand-slate">Horário</label>
            <input
              type="time"
              value={form.horario ?? ""}
              onChange={(e) => setForm({ ...form, horario: e.target.value || null })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-brand-slate">Cliente</label>
            <select
              value={form.cliente_id ?? ""}
              onChange={(e) => setForm({ ...form, cliente_id: e.target.value || null, equipamento_id: null })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">Nenhum / interno</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razao_social}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-brand-slate">Equipamento (opcional)</label>
            <select
              value={form.equipamento_id ?? ""}
              onChange={(e) => setForm({ ...form, equipamento_id: e.target.value || null })}
              disabled={!form.cliente_id}
              className="w-full border rounded-md px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">Nenhum</option>
              {equipamentosDoCliente.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.codigo_interno} — {eq.tipo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-brand-slate">Responsável</label>
            <input
              type="text"
              value={form.responsavel ?? ""}
              onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
              placeholder="Nome do técnico"
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div className="col-span-2">
            <label className="text-xs text-brand-slate">Observações</label>
            <textarea
              rows={2}
              value={form.observacoes ?? ""}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div className="col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={salvando}
              className="bg-brand-red text-white text-sm px-6 py-2 rounded-md hover:bg-brand-redDark transition disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar evento"}
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-1 bg-brand-fog rounded-md p-1">
          {(["dia", "semana", "mes"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVisualizacao(v)}
              className={`text-xs px-3 py-1.5 rounded ${
                visualizacao === v ? "bg-white shadow-sm font-medium" : "text-brand-slate/60"
              }`}
            >
              {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => navegar(-1)} className="text-sm px-2 py-1 rounded border">
            ‹
          </button>
          <button onClick={() => setDataRef(new Date())} className="text-xs px-2 py-1 rounded border">
            Hoje
          </button>
          <button onClick={() => navegar(1)} className="text-sm px-2 py-1 rounded border">
            ›
          </button>
          <span className="text-sm text-brand-slate ml-1">
            {format(periodo.inicio, "d MMM", { locale: ptBR })} – {format(periodo.fim, "d MMM yyyy", { locale: ptBR })}
          </span>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-brand-slate/60 py-6">Carregando agenda...</p>
      ) : (
        <div className="space-y-4">
          {dias.map((dia) => {
            const evs = eventosDoDia(dia);
            const ehHoje = isSameDay(dia, new Date());
            return (
              <div key={dia.toISOString()} className="bg-white border border-black/5 rounded-lg overflow-hidden">
                <div
                  className={`px-4 py-2.5 flex items-center justify-between border-b border-black/5 ${
                    ehHoje ? "bg-red-50" : "bg-brand-fog"
                  }`}
                >
                  <p className={`text-sm font-medium ${ehHoje ? "text-brand-red" : "text-brand-slate"}`}>
                    {format(dia, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    {ehHoje && " (hoje)"}
                  </p>
                  <button onClick={() => abrirNovo(dia)} className="text-xs text-brand-red underline">
                    + adicionar
                  </button>
                </div>
                {evs.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-brand-slate/50">Nada agendado.</p>
                ) : (
                  <ul className="divide-y divide-black/5">
                    {evs.map((ev) => (
                      <li key={ev.id} className="px-4 py-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {ev.horario && (
                              <span className="text-xs font-mono text-brand-slate/60">{ev.horario.slice(0, 5)}</span>
                            )}
                            <span className={`text-sm font-medium ${ev.status === "cancelado" ? "line-through text-brand-slate/40" : ""}`}>
                              {ev.titulo}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${prioridadeCor[ev.prioridade]}`}>
                              {ev.prioridade}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusCor[ev.status]}`}>
                              {ev.status}
                            </span>
                          </div>
                          <p className="text-xs text-brand-slate/60 mt-0.5">
                            {TIPOS_EVENTO.find((t) => t.value === ev.tipo)?.label}
                            {nomeCliente(ev.cliente_id) && ` · ${nomeCliente(ev.cliente_id)}`}
                            {ev.responsavel && ` · ${ev.responsavel}`}
                          </p>
                        </div>
                        {ev.status === "agendado" && (
                          <div className="flex gap-2 shrink-0 items-center">
                            {ev.cliente_id && (
                              <Link
                                href={`/ordens-servico?evento=${ev.id}&cliente=${ev.cliente_id}`}
                                className="text-xs text-brand-red underline"
                              >
                                gerar OS
                              </Link>
                            )}
                            <button
                              onClick={() => atualizarStatus(ev, "concluido")}
                              className="text-xs text-green-700 underline"
                            >
                              concluir
                            </button>
                            <button
                              onClick={() => atualizarStatus(ev, "cancelado")}
                              className="text-xs text-brand-slate/50 underline"
                            >
                              cancelar
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
