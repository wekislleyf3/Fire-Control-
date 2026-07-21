"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "@/hooks/useSupabase";
import { clientesService, ValidationError } from "@/lib/services/clientesService";
import type { Cliente, ClienteInput } from "@/types/cliente";

const emptyForm = {
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  telefone: "",
  cidade: "",
  estado: "",
  status: "ativo",
};

export default function ClientesPage() {
  const supabase = useSupabase();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  async function loadClientes() {
    setLoading(true);
    try {
      const data = await clientesService.list(supabase);
      setClientes(data);
      setError(null);
    } catch (err) {
      setError(`Erro ao carregar clientes: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClientes();
  }, []);

  function startNew() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(c: Cliente) {
    setForm({
      razao_social: c.razao_social ?? "",
      nome_fantasia: c.nome_fantasia ?? "",
      cnpj: c.cnpj ?? "",
      telefone: c.telefone ?? "",
      cidade: c.cidade ?? "",
      estado: c.estado ?? "",
      status: c.status ?? "ativo",
    });
    setEditingId(c.id);
    setShowForm(true);
    setError(null);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.razao_social) return;
    setSaving(true);
    setError(null);

    try {
      const input = form as unknown as ClienteInput;
      if (editingId) await clientesService.update(supabase, editingId, input);
      else await clientesService.create(supabase, input);
      cancelForm();
      await loadClientes();
    } catch (err) {
      const message =
        err instanceof ValidationError ? err.message : `Erro ao salvar cliente: ${(err as Error).message}`;
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await clientesService.remove(supabase, id);
      setDeletingId(null);
      await loadClientes();
    } catch (err) {
      setError(`Erro ao excluir cliente: ${(err as Error).message}`);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl">Clientes</h1>
        <button
          onClick={() => (showForm ? cancelForm() : startNew())}
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
          <p className="col-span-2 text-sm font-medium text-brand-slate">
            {editingId ? "Editando cliente" : "Novo cliente"}
          </p>
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
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
          <button
            disabled={saving}
            className="col-span-2 bg-brand-ink text-white text-sm py-2 rounded-md disabled:opacity-60"
          >
            {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar cliente"}
          </button>
        </form>
      )}

      <div className="bg-white border border-black/5 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-brand-fog text-left text-brand-slate">
            <tr>
              <th className="px-4 py-3">Razão social</th>
              <th className="px-4 py-3">Cidade/UF</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-brand-slate/60">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && clientes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-brand-slate/60">
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
                <td className="px-4 py-3">
                  {deletingId === c.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-brand-slate">Confirmar exclusão?</span>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-xs text-white bg-brand-red px-2 py-1 rounded"
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="text-xs px-2 py-1 rounded border"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => startEdit(c)}
                        className="text-xs text-brand-slate underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeletingId(c.id)}
                        className="text-xs text-brand-red underline"
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
