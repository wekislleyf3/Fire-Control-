import type { SupabaseClient } from "@supabase/supabase-js";
import type { Documento, DocumentoInput, StatusDocumento } from "@/types/documento";

const BUCKET = "firecontrol-files";
const MARCADOR_CAMINHO = `/${BUCKET}/`;

/**
 * Repository: única camada que sabe o nome da tabela/bucket e monta
 * queries pra Documentos. Segue o mesmo padrão de clientesRepository.ts —
 * CRUD cru, sem regra de negócio.
 */
export const documentosRepository = {
  async listPorCliente(
    supabase: SupabaseClient,
    clienteId: string,
    opts: { apenasVigentes: boolean }
  ): Promise<Documento[]> {
    let query = supabase
      .from("documentos")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });
    if (opts.apenasVigentes) query = query.eq("status", "vigente");

    const { data, error } = await query;
    if (error) throw error;
    return (data as Documento[]) ?? [];
  },

  /** Todos os documentos com validade preenchida, de todos os clientes — usado nos dashboards de Pendências e IFC. */
  async listTodosComValidade(supabase: SupabaseClient): Promise<Documento[]> {
    const { data, error } = await supabase.from("documentos").select("*").not("validade", "is", null);
    if (error) throw error;
    return (data as Documento[]) ?? [];
  },

  async create(supabase: SupabaseClient, input: DocumentoInput & { status?: StatusDocumento }): Promise<Documento> {
    const { data, error } = await supabase.from("documentos").insert([input]).select().single();
    if (error) throw error;
    return data as Documento;
  },

  async update(
    supabase: SupabaseClient,
    id: string,
    input: Partial<Pick<Documento, "validade" | "status" | "substituido_por">>
  ): Promise<Documento> {
    const { data, error } = await supabase.from("documentos").update(input).eq("id", id).select().single();
    if (error) throw error;
    return data as Documento;
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("documentos").delete().eq("id", id);
    if (error) throw error;
  },

  /** Envia o arquivo pro bucket público e devolve a URL final + nome original. */
  async uploadArquivo(supabase: SupabaseClient, clienteId: string, file: File): Promise<{ url: string; nome: string }> {
    const caminho = `documentos/${clienteId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(caminho, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
    return { url: data.publicUrl, nome: file.name };
  },

  /** Remove o arquivo do bucket a partir da URL pública salva no documento. */
  async removerArquivo(supabase: SupabaseClient, arquivoUrl: string): Promise<void> {
    const idx = arquivoUrl.indexOf(MARCADOR_CAMINHO);
    if (idx < 0) return; // URL não segue o padrão esperado — nada a remover
    const caminho = arquivoUrl.slice(idx + MARCADOR_CAMINHO.length);
    const { error } = await supabase.storage.from(BUCKET).remove([caminho]);
    if (error) throw error;
  },
};
