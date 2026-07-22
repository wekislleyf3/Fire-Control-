"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";
import type { Cliente, Equipamento } from "@/lib/types";
import { getEspecificacoesSchema } from "@/lib/equipamentos/especificacoesSchemas";

const supabase = createClient();

const TIPOS = [
  "Extintor",
  "Mangueira",
  "Hidrante",
  "Mangotinho",
  "Porta corta-fogo",
  "Iluminação de emergência",
  "Placa",
  "Alarme",
  "Detector",
  "Sprinkler",
  "Bomba",
  "Central de incêndio",
];

const statusColor: Record<string, string> = {
  ok: "bg-green-100 text-green-700",
  atencao: "bg-amber-100 text-amber-700",
  vencido: "bg-red-100 text-red-700",
};

const emptyForm = {
  codigo_interno: "",
  cliente_id: "",
  tipo: TIPOS[0],
  fabricante: "",
  numero_serie: "",
  localizacao: "",
  status: "ok",
  proxima_inspecao: "",
  proxima_recarga: "",
  proximo_teste_hidrostatico: "",
  especificacoes: {} as Record<string, any>,
};

export default function EquipamentosPage() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  async function loadData() {
    setLoading(true);
    const [eq, cl] = await Promise.all([
      supabase.from("equipamentos").select("*").order("created_at", { ascending: false }),
      supabase.from("clientes").select("*").order("razao_social"),
    ]);
    setEquipamentos((eq.data as Equipamento[]) ?? []);
    setClientes((cl.data as Cliente[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function startNew() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(eq: Equipamento) {
    setForm({
      codigo_interno: eq.codigo_interno,
      cliente_id: eq.cliente_id,
      tipo: eq.tipo,
      fabricante: eq.fabricante ?? "",
      numero_serie: eq.numero_serie ?? "",
      localizacao: eq.localizacao ?? "",
      status: eq.status,
      proxima_inspecao: eq.proxima_inspecao ?? "",
      proxima_recarga: eq.proxima_recarga ?? "",
      proximo_teste_hidrostatico: eq.proximo_teste_hidrostatico ?? "",
      especificacoes: eq.especificacoes ?? {},
    });
    setEditingId(eq.id);
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
    if (!form.codigo_interno || !form.cliente_id) return;
    setSaving(true);
    setError(null);

    // datas vazias precisam virar null (coluna "date" no Postgres não aceita "")
    const payload = {
      ...form,
      proxima_inspecao: form.proxima_inspecao || null,
      proxima_recarga: form.proxima_recarga || null,
      proximo_teste_hidrostatico: form.proximo_teste_hidrostatico || null,
    };

    const { error } = editingId
      ? await supabase.from("equipamentos").update(payload).eq("id", editingId)
      : await supabase.from("equipamentos").insert([payload]);

    setSaving(false);
    if (error) {
      setError(`Erro ao salvar equipamento: ${error.message}`);
      return;
    }
    cancelForm();
    loadData();
  }

  async function handleDelete(id: string) {
    setError(null);
    const { error } = await supabase.from("equipamentos").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      setError(`Erro ao excluir equipamento: ${error.message}`);
      return;
    }
    loadData();
  }

  async function handlePhotoUpload(eq: Equipamento, file: File) {
    setUploadingId(eq.id);
    setError(null);

    const extensao = file.name.split(".").pop();
    const caminho = `equipamentos/${eq.id}/foto-${Date.now()}.${extensao}`;

    const { error: uploadError } = await supabase.storage
      .from("firecontrol-files")
      .upload(caminho, file, { upsert: true });

    if (uploadError) {
      setError(`Erro ao enviar foto: ${uploadError.message}`);
      setUploadingId(null);
      return;
    }

    const { data: urlData } = supabase.storage.from("firecontrol-files").getPublicUrl(caminho);

    const { error: updateError } = await supabase
      .from("equipamentos")
      .update({ foto_url: urlData.publicUrl })
      .eq("id", eq.id);

    setUploadingId(null);
    if (updateError) {
      setError(`Erro ao salvar foto: ${updateError.message}`);
      return;
    }
    loadData();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl">Equipamentos</h1>
        <button
          onClick={() => (showForm ? cancelForm() : startNew())}
          className="bg-brand-red text-white text-sm px-4 py-2 rounded-md hover:bg-brand-redDark transition"
        >
          {showForm ? "Cancelar" : "+ Novo equipamento"}
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
            {editingId ? "Editando equipamento" : "Novo equipamento"}
          </p>
          <input
            required
            placeholder="Código interno (ex: FC-EXT-000001) *"
            className="border rounded-md px-3 py-2 text-sm col-span-2"
            value={form.codigo_interno}
            onChange={(e) => setForm({ ...form, codigo_interno: e.target.value })}
          />
          <select
            required
            className="border rounded-md px-3 py-2 text-sm"
            value={form.cliente_id}
            onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
          >
            <option value="">Cliente *</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.matricula ? `${c.matricula} — ` : ""}
                {c.razao_social}
              </option>
            ))}
          </select>
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value, especificacoes: {} })}
          >
            {TIPOS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            placeholder="Fabricante"
            className="border rounded-md px-3 py-2 text-sm"
            value={form.fabricante}
            onChange={(e) => setForm({ ...form, fabricante: e.target.value })}
          />
          <input
            placeholder="Número de série"
            className="border rounded-md px-3 py-2 text-sm"
            value={form.numero_serie}
            onChange={(e) => setForm({ ...form, numero_serie: e.target.value })}
          />
          <input
            placeholder="Localização (setor/pavimento)"
            className="border rounded-md px-3 py-2 text-sm"
            value={form.localizacao}
            onChange={(e) => setForm({ ...form, localizacao: e.target.value })}
          />
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="ok">OK</option>
            <option value="atencao">Atenção</option>
            <option value="vencido">Vencido</option>
          </select>

          {getEspecificacoesSchema(form.tipo).length > 0 && (
            <div className="col-span-2 border-t border-black/5 pt-4">
              <p className="text-xs font-medium text-brand-slate mb-3">
                Especificações técnicas — {form.tipo} (opcional)
              </p>
              <div className="grid grid-cols-2 gap-4">
                {getEspecificacoesSchema(form.tipo).map((field) => {
                  const valor = form.especificacoes[field.name] ?? "";

                  if (field.type === "boolean") {
                    return (
                      <label key={field.name} className="flex items-center gap-2 text-sm mt-2">
                        <input
                          type="checkbox"
                          checked={!!valor}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              especificacoes: { ...form.especificacoes, [field.name]: e.target.checked },
                            })
                          }
                        />
                        {field.label}
                      </label>
                    );
                  }

                  if (field.type === "select") {
                    return (
                      <select
                        key={field.name}
                        className="border rounded-md px-3 py-2 text-sm"
                        value={valor}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            especificacoes: { ...form.especificacoes, [field.name]: e.target.value },
                          })
                        }
                      >
                        <option value="">{field.label}</option>
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    );
                  }

                  return (
                    <input
                      key={field.name}
                      type={field.type}
                      placeholder={field.label}
                      className="border rounded-md px-3 py-2 text-sm"
                      value={valor}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          especificacoes: { ...form.especificacoes, [field.name]: e.target.value },
                        })
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className="col-span-2 grid grid-cols-3 gap-4 border-t border-black/5 pt-4">
            <div>
              <label className="text-xs text-brand-slate">Próxima inspeção</label>
              <input
                type="date"
                className="border rounded-md px-3 py-2 text-sm w-full mt-1"
                value={form.proxima_inspecao}
                onChange={(e) => setForm({ ...form, proxima_inspecao: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-brand-slate">Próxima recarga</label>
              <input
                type="date"
                className="border rounded-md px-3 py-2 text-sm w-full mt-1"
                value={form.proxima_recarga}
                onChange={(e) => setForm({ ...form, proxima_recarga: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-brand-slate">Próximo teste hidrostático</label>
              <input
                type="date"
                className="border rounded-md px-3 py-2 text-sm w-full mt-1"
                value={form.proximo_teste_hidrostatico}
                onChange={(e) => setForm({ ...form, proximo_teste_hidrostatico: e.target.value })}
              />
            </div>
          </div>

          <button
            disabled={saving}
            className="col-span-2 bg-brand-ink text-white text-sm py-2 rounded-md disabled:opacity-60"
          >
            {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar equipamento"}
          </button>
        </form>
      )}

      <div className="bg-white border border-black/5 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-brand-fog text-left text-brand-slate">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Foto</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Localização</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">QR</th>
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
            {!loading && equipamentos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-brand-slate/60">
                  Nenhum equipamento cadastrado ainda.
                </td>
              </tr>
            )}
            {equipamentos.map((eq) => (
              <tr key={eq.id} className="border-t border-black/5">
                <td className="px-4 py-3 font-medium">{eq.codigo_interno}</td>
                <td className="px-4 py-3">
                  <label className="cursor-pointer">
                    {eq.foto_url ? (
                      <img
                        src={eq.foto_url}
                        alt={eq.codigo_interno}
                        className="w-12 h-12 object-cover rounded-md border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-md border border-dashed flex items-center justify-center text-[10px] text-brand-slate/50 text-center">
                        {uploadingId === eq.id ? "..." : "sem foto"}
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(eq, file);
                      }}
                    />
                  </label>
                </td>
                <td className="px-4 py-3">{eq.tipo}</td>
                <td className="px-4 py-3">{eq.localizacao}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor[eq.status]}`}>
                    {eq.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setQrFor(qrFor === eq.id ? null : eq.id)}
                    className="text-brand-red text-xs underline"
                  >
                    {qrFor === eq.id ? "ocultar" : "ver QR"}
                  </button>
                  {qrFor === eq.id && (
                    <div className="mt-2">
                      <QRCodeSVG value={`${eq.codigo_interno}`} size={80} />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {deletingId === eq.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-brand-slate">Excluir + histórico?</span>
                      <button
                        onClick={() => handleDelete(eq.id)}
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
                        onClick={() => startEdit(eq)}
                        className="text-xs text-brand-slate underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeletingId(eq.id)}
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
