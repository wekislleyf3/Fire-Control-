"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Cliente } from "@/lib/types";

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    telefone: "",
    cidade: "",
    estado: "",
  });

  async function loadClientes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setError(`Erro ao carregar clientes: ${error.message}`);
    } else {
      setError(null);
    }
    setClientes((data as Cliente[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadClientes();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.razao_social) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("clientes").insert([form]);
    setSaving(false);
    if (error) {
      setError(`Erro ao salvar cliente: ${error.message}`);
      return; // não fecha o formulário nem limpa os campos se falhou
    }
    setForm({ razao_social: "", nome_fantasia: "", cnpj: "", telefone: "", cidade: "", estado: "" });
    setShowForm(false);
    loadClientes();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl">Clientes</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-brand-red text-white text-sm px-4 py-2 rounded-md hover:bg-brand-redDark transition"
        >
          {showForm ? "Cancelar" : "+ Novo cliente"}
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
          className="bg-white border border-black/5 rounded-lg p-5 mb-6 grid grid-cols-2 gap-4"
        >
          <input
            required
            placeholder="Razão social *"
            className="border rounded-md px-3 py-2 text-sm col-span-2"
            value={form.razao_social}
            onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
          />
          <input
            placeholder="Nome fantasia"
            className="border rounded-md px-3 py-2 text-sm"
            value={form.nome_fantasia}
            onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
          />
          <input
            placeholder="CNPJ"
            className="border rounded-md px-3 py-2 text-sm"
            value={form.cnpj}
            onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
          />
          <input
            placeholder="Telefone"
            className="border rounded-md px-3 py-2 text-sm"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
          />
          <input
            placeholder="Cidade"
            className="border rounded-md px-3 py-2 text-sm"
            value={form.cidade}
            onChange={(e) => setForm({ ...form, cidade: e.target.value })}
          />
          <input
            placeholder="Estado (UF)"
            className="border rounded-md px-3 py-2 text-sm"
            value={form.estado}
            onChange={(e) => setForm({ ...form, estado: e.target.value })}
          />
          <button
            disabled={saving}
            className="col-span-2 bg-brand-ink text-white text-sm py-2 rounded-md disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar cliente"}
          </button>
        </form>
      )}

      <div className="bg-white border border-black/5 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-fog text-left text-brand-slate">
            <tr>
              <th className="px-4 py-3">Razão social</th>
              <th className="px-4 py-3">Cidade/UF</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-brand-slate/60">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && clientes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-brand-slate/60">
                  Nenhum cliente cadastrado ainda.
                </td>
              </tr>
            )}
            {clientes.map((c) => (
              <tr key={c.id} className="border-t border-black/5">
                <td className="px-4 py-3">{c.razao_social}</td>
                <td className="px-4 py-3">
                  {c.cidade}
                  {c.estado ? `/${c.estado}` : ""}
                </td>
                <td className="px-4 py-3">{c.telefone}</td>
                <td className="px-4 py-3 capitalize">{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
