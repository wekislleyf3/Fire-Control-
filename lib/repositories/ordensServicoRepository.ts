import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OrdemServico,
  OrdemServicoInput,
  OrdemServicoItem,
  OrdemServicoItemInput,
  StatusOS,
  TipoOS,
} from "@/types/ordemServico";

/**
 * Repository: única camada que sabe o nome das tabelas e monta queries
 * pra Ordens de Serviço. Segue o mesmo padrão de clientesRepository.ts —
 * CRUD cru, sem regra de negócio.
 */
export const ordensServicoRepository = {
  async list(supabase: SupabaseClient): Promise<OrdemServico[]> {
    const { data, error } = await supabase
      .from("ordens_servico")
      .select("*, itens:ordens_servico_itens(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as OrdemServico[]) ?? [];
  },

  async getById(supabase: SupabaseClient, id: string): Promise<OrdemServico | null> {
    const { data, error } = await supabase
      .from("ordens_servico")
      .select("*, itens:ordens_servico_itens(*)")
      .eq("id", id)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return (data as OrdemServico | null) ?? null;
  },

  /** Cria a OS e seus itens (equipamentos vistoriados) em sequência. */
  async create(
    supabase: SupabaseClient,
    input: OrdemServicoInput,
    itens: OrdemServicoItemInput[]
  ): Promise<OrdemServico> {
    const { data: os, error } = await supabase.from("ordens_servico").insert([input]).select().single();
    if (error) throw error;

    if (itens.length > 0) {
      const { error: itensError } = await supabase
        .from("ordens_servico_itens")
        .insert(itens.map((item) => ({ ...item, ordem_servico_id: os.id })));
      if (itensError) throw itensError;
    }

    return this.getById(supabase, os.id) as Promise<OrdemServico>;
  },

  async update(supabase: SupabaseClient, id: string, input: Partial<OrdemServicoInput>): Promise<OrdemServico> {
    const { data, error } = await supabase.from("ordens_servico").update(input).eq("id", id).select().single();
    if (error) throw error;
    return data as OrdemServico;
  },

  /** Marca a OS como concluída e grava a assinatura coletada no local. */
  async concluir(
    supabase: SupabaseClient,
    id: string,
    params: { assinatura_cliente_url: string; assinatura_nome: string }
  ): Promise<OrdemServico> {
    const { data, error } = await supabase
      .from("ordens_servico")
      .update({
        status: "concluida",
        assinatura_cliente_url: params.assinatura_cliente_url,
        assinatura_nome: params.assinatura_nome,
        assinatura_data: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as OrdemServico;
  },

  async atualizarItem(
    supabase: SupabaseClient,
    itemId: string,
    input: Partial<Pick<OrdemServicoItem, "verificado" | "observacao">>
  ): Promise<OrdemServicoItem> {
    const { data, error } = await supabase
      .from("ordens_servico_itens")
      .update(input)
      .eq("id", itemId)
      .select()
      .single();
    if (error) throw error;
    return data as OrdemServicoItem;
  },

  async atualizarStatus(supabase: SupabaseClient, id: string, status: StatusOS): Promise<OrdemServico> {
    const { data, error } = await supabase.from("ordens_servico").update({ status }).eq("id", id).select().single();
    if (error) throw error;
    return data as OrdemServico;
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("ordens_servico").delete().eq("id", id);
    if (error) throw error;
  },

  /** Itens de OS que incluem este equipamento, com os dados básicos da OS pai — usado na página de detalhe do equipamento. */
  async listItensPorEquipamento(
    supabase: SupabaseClient,
    equipamentoId: string
  ): Promise<
    { ordem_servico_id: string; verificado: boolean; numero: number; tipo: TipoOS; data: string; status: StatusOS }[]
  > {
    const { data, error } = await supabase
      .from("ordens_servico_itens")
      .select("ordem_servico_id, verificado, ordens_servico(numero, tipo, data, status)")
      .eq("equipamento_id", equipamentoId);
    if (error) throw error;

    return ((data as any[]) ?? [])
      .filter((i) => i.ordens_servico)
      .map((i) => ({
        ordem_servico_id: i.ordem_servico_id,
        verificado: i.verificado,
        numero: i.ordens_servico.numero,
        tipo: i.ordens_servico.tipo,
        data: i.ordens_servico.data,
        status: i.ordens_servico.status,
      }));
  },

  /** Envia a imagem da assinatura coletada em tela e devolve a URL pública. */
  async uploadAssinatura(supabase: SupabaseClient, clienteId: string, osId: string, blob: Blob): Promise<string> {
    const caminho = `assinaturas/${clienteId}/${osId}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("firecontrol-files")
      .upload(caminho, blob, { contentType: "image/png" });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("firecontrol-files").getPublicUrl(caminho);
    return data.publicUrl;
  },
};
