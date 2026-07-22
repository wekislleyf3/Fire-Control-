"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/hooks/useSupabase";
import { clientesService, ValidationError } from "@/lib/services/clientesService";
import type { Cliente, ClienteInput, TipoPessoa } from "@/types/cliente";

const emptyForm = {
  tipo_pessoa: "juridica" as TipoPessoa,
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  cpf: "",
  inscricao_estadual: "",
  telefone: "",
  whatsapp: "",
  email: "",
  responsavel: "",
  cargo: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  google_maps_url: "",
  observacoes: "",
  status: "ativo",
};

function maskCnpj(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskCpf(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskCep(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export default function ClientesPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMatricula, setEditingMatricula] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [busca, setBusca] = useState("");
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
    setEditingMatricula(null);
    setShowForm(true);
    setError(null);
  }

  function startEdit(c: Cliente) {
    setForm({
      tipo_pessoa: c.tipo_pessoa ?? "juridica",
      razao_social: c.razao_social ?? "",
      nome_fantasia: c.nome_fantasia ?? "",
      cnpj: c.cnpj ?? "",
      cpf: c.cpf ?? "",
      inscricao_estadual: c.inscricao_estadual ?? "",
      telefone: c.telefone ?? "",
      whatsapp: c.whatsapp ?? "",
      email: c.email ?? "",
      responsavel: c.responsavel ?? "",
      cargo: c.cargo ?? "",
      cep: c.cep ?? "",
      logradouro: c.logradouro ?? "",
      numero: c.numero ?? "",
      complemento: c.complemento ?? "",
      bairro: c.bairro ?? "",
      cidade: c.cidade ?? "",
      estado: c.estado ?? "",
      google_maps_url: c.google_maps_url ?? "",
      observacoes: c.observacoes ?? "",
      status: c.status ?? "ativo",
    });
    setEditingId(c.id);
    setEditingMatricula(c.matricula);
    setShowForm(true);
    setError(null);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setEditingMatricula(null);
    setForm({ ...emptyForm });
  }

  async function buscarCep() {
    const digits = form.cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setBuscandoCep(true);
    setError(null);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) {
        setError("CEP não encontrado.");
        return;
      }
      setForm((f) => ({
        ...f,
        logradouro: data.logradouro || f.logradouro,
        bairro: data.bairro || f.bairro,
        cidade: data.localidade || f.cidade,
        estado: data.uf || f.estado,
      }));
    } catch {
      // busca de CEP é só uma conveniência — se falhar (ex: sem internet), o usuário preenche manualmente
      setError("Não foi possível buscar o CEP agora. Preencha o endereço manualmente.");
    } finally {
      setBuscandoCep(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.razao_social) return;
    setSaving(true);
    setError(null);

    try {
      const input = { ...form } as unknown as ClienteInput;
      if (editingId) await clientesService.update(supabase, editingId, input);
      else await clientesService.create(supabase, input);
      cancelForm();
      await loadClientes();
      router.refresh();
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
      router.refresh();
    } catch (err) {
      setError(`Erro ao excluir cliente: ${(err as Error).message}`);
    }
  }

  const clientesFiltrados = clientes.filter((c) => {
    if (!busca.trim()) return true;
    const alvo = busca.trim().toLowerCase();
    const alvoDigits = alvo.replace(/\D/g, "");
    return (
      c.razao_social?.toLowerCase().includes(alvo) ||
      c.nome_fantasia?.toLowerCase().includes(alvo) ||
      c.matricula?.toLowerCase().includes(alvo) ||
      (alvoDigits && c.cnpj?.replace(/\D/g, "").includes(alvoDigits)) ||
      (alvoDigits && c.cpf?.replace(/\D/g, "").includes(alvoDigits))
    );
  });

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
          className="bg-white border border-black/5 rounded-lg p-5 mb-6 space-y-5"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-medium text-brand-slate">
              {editingId ? "Editando cliente" : "Novo cliente"}
            </p>
            {editingMatricula && (
              <span className="text-xs font-mono bg-brand-fog px-2 py-1 rounded-md text-brand-slate">
                Matrícula {editingMatricula}
              </span>
            )}
            {!editingId && (
              <span className="text-xs text-brand-slate/60">
                A matrícula é gerada automaticamente ao salvar.
              </span>
            )}
          </div>

          {/* Tipo de pessoa */}
          <div>
            <label className="text-xs text-brand-slate">Tipo de cadastro</label>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setForm({ ...form, tipo_pessoa: "juridica" })}
                className={`text-sm px-4 py-2 rounded-md border ${
                  form.tipo_pessoa === "juridica"
                    ? "bg-brand-ink text-white border-brand-ink"
                    : "border-black/10 text-brand-slate"
                }`}
              >
                Pessoa Jurídica
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, tipo_pessoa: "fisica" })}
                className={`text-sm px-4 py-2 rounded-md border ${
                  form.tipo_pessoa === "fisica"
                    ? "bg-brand-ink text-white border-brand-ink"
                    : "border-black/10 text-brand-slate"
                }`}
              >
                Pessoa Física
              </button>
            </div>
          </div>

          {/* Identificação */}
          <div className="grid grid-cols-2 gap-4">
            <input
              required
              placeholder={form.tipo_pessoa === "fisica" ? "Nome completo *" : "Razão social *"}
              className="border rounded-md px-3 py-2 text-sm col-span-2"
              value={form.razao_social}
              onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
            />
            {form.tipo_pessoa === "juridica" ? (
              <>
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
                  onChange={(e) => setForm({ ...form, cnpj: maskCnpj(e.target.value) })}
                />
                <input
                  placeholder="Inscrição estadual"
                  className="border rounded-md px-3 py-2 text-sm"
                  value={form.inscricao_estadual}
                  onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })}
                />
              </>
            ) : (
              <input
                placeholder="CPF"
                className="border rounded-md px-3 py-2 text-sm"
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: maskCpf(e.target.value) })}
              />
            )}
          </div>

          {/* Contato */}
          <div className="border-t border-black/5 pt-4 grid grid-cols-2 gap-4">
            <input
              placeholder="Telefone"
              className="border rounded-md px-3 py-2 text-sm"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />
            <input
              placeholder="WhatsApp"
              className="border rounded-md px-3 py-2 text-sm"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            />
            <input
              placeholder="E-mail"
              type="email"
              className="border rounded-md px-3 py-2 text-sm"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              placeholder={form.tipo_pessoa === "fisica" ? "Responsável (se aplicável)" : "Responsável / contato"}
              className="border rounded-md px-3 py-2 text-sm"
              value={form.responsavel}
              onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
            />
            <input
              placeholder="Cargo do responsável"
              className="border rounded-md px-3 py-2 text-sm"
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
            />
          </div>

          {/* Endereço completo */}
          <div className="border-t border-black/5 pt-4">
            <p className="text-sm font-medium text-brand-slate mb-2">Endereço</p>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1 relative">
                <input
                  placeholder="CEP"
                  className="border rounded-md px-3 py-2 text-sm w-full"
                  value={form.cep}
                  onChange={(e) => setForm({ ...form, cep: maskCep(e.target.value) })}
                  onBlur={buscarCep}
                />
                {buscandoCep && (
                  <span className="absolute right-2 top-2.5 text-[10px] text-brand-slate/50">
                    buscando...
                  </span>
                )}
              </div>
              <input
                placeholder="Logradouro (rua/avenida)"
                className="border rounded-md px-3 py-2 text-sm col-span-2"
                value={form.logradouro}
                onChange={(e) => setForm({ ...form, logradouro: e.target.value })}
              />
              <input
                placeholder="Número"
                className="border rounded-md px-3 py-2 text-sm"
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
              />
              <input
                placeholder="Complemento"
                className="border rounded-md px-3 py-2 text-sm col-span-2"
                value={form.complemento}
                onChange={(e) => setForm({ ...form, complemento: e.target.value })}
              />
              <input
                placeholder="Bairro"
                className="border rounded-md px-3 py-2 text-sm"
                value={form.bairro}
                onChange={(e) => setForm({ ...form, bairro: e.target.value })}
              />
              <input
                placeholder="Cidade"
                className="border rounded-md px-3 py-2 text-sm"
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              />
              <input
                placeholder="UF"
                maxLength={2}
                className="border rounded-md px-3 py-2 text-sm uppercase"
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })}
              />
              <input
                placeholder="Link do Google Maps (opcional)"
                className="border rounded-md px-3 py-2 text-sm col-span-2"
                value={form.google_maps_url}
                onChange={(e) => setForm({ ...form, google_maps_url: e.target.value })}
              />
            </div>
          </div>

          <div className="border-t border-black/5 pt-4 grid grid-cols-2 gap-4">
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
            <textarea
              placeholder="Observações"
              className="border rounded-md px-3 py-2 text-sm col-span-2"
              rows={2}
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>

          <button
            disabled={saving}
            className="w-full bg-brand-ink text-white text-sm py-2 rounded-md disabled:opacity-60"
          >
            {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar cliente"}
          </button>
        </form>
      )}

      <input
        placeholder="Buscar por nome, matrícula, CNPJ ou CPF..."
        className="border rounded-md px-3 py-2 text-sm w-full mb-4"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <div className="bg-white border border-black/5 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-brand-fog text-left text-brand-slate">
            <tr>
              <th className="px-4 py-3">Matrícula</th>
              <th className="px-4 py-3">Nome / Razão social</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Cidade/UF</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-brand-slate/60">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && clientesFiltrados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-brand-slate/60">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
            {clientesFiltrados.map((c) => (
              <tr key={c.id} className="border-t border-black/5">
                <td className="px-4 py-3 font-mono text-xs text-brand-slate">{c.matricula ?? "—"}</td>
                <td className="px-4 py-3">
                  <Link href={`/clientes/${c.id}`} className="font-medium text-brand-ink hover:text-brand-red hover:underline">
                    {c.razao_social}
                  </Link>
                  {c.nome_fantasia && <p className="text-xs text-brand-slate/60">{c.nome_fantasia}</p>}
                </td>
                <td className="px-4 py-3 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-brand-fog text-brand-slate">
                    {c.tipo_pessoa === "fisica" ? "PF" : "PJ"}
                  </span>
                </td>
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
