import type { SupabaseClient } from "@supabase/supabase-js";
import { documentosRepository } from "@/lib/repositories/documentosRepository";
import type { Documento } from "@/types/documento";

export class ValidationError extends Error {}

type UploadParams = {
  clienteId: string;
  tipo: string;
  validade: string | null;
  file: File;
};

type RenovarParams = {
  clienteId: string;
  docAntigo: Documento;
  file: File;
  validade: string | null;
};

/**
 * Service: regra de negócio + orquestração. Páginas chamam o service,
 * nunca o repository ou o Supabase diretamente.
 */
export const documentosService = {
  listPorCliente(supabase: SupabaseClient, clienteId: string, mostrarHistorico: boolean): Promise<Documento[]> {
    if (!clienteId) return Promise.resolve([]);
    return documentosRepository.listPorCliente(supabase, clienteId, { apenasVigentes: !mostrarHistorico });
  },

  async upload(supabase: SupabaseClient, params: UploadParams): Promise<Documento> {
    if (!params.clienteId) throw new ValidationError("Selecione um cliente.");
    if (!params.file) throw new ValidationError("Selecione um arquivo.");

    const { url, nome } = await documentosRepository.uploadArquivo(supabase, params.clienteId, params.file);
    return documentosRepository.create(supabase, {
      cliente_id: params.clienteId,
      tipo: params.tipo,
      nome_arquivo: nome,
      arquivo_url: url,
      validade: params.validade,
    });
  },

  async remove(supabase: SupabaseClient, doc: Documento): Promise<void> {
    await documentosRepository.removerArquivo(supabase, doc.arquivo_url);
    await documentosRepository.remove(supabase, doc.id);
  },

  atualizarValidade(supabase: SupabaseClient, id: string, validade: string | null): Promise<Documento> {
    return documentosRepository.update(supabase, id, { validade });
  },

  /**
   * Renova um documento vigente: envia o novo arquivo, cria o registro
   * novo (já vigente) e marca o antigo como substituído, ligando os dois
   * via `substituido_por`. As duas escritas não são atômicas (a API do
   * Supabase client não expõe transação aqui) — se a segunda falhar, o
   * documento antigo fica sem o vínculo, mas o novo já existe; nesse caso
   * o erro é repassado pra quem chamou tratar.
   */
  async renovar(supabase: SupabaseClient, params: RenovarParams): Promise<Documento> {
    if (!params.file) throw new ValidationError("Selecione o novo arquivo pra renovar o documento.");

    const { url, nome } = await documentosRepository.uploadArquivo(supabase, params.clienteId, params.file);

    const novoDoc = await documentosRepository.create(supabase, {
      cliente_id: params.clienteId,
      tipo: params.docAntigo.tipo,
      nome_arquivo: nome,
      arquivo_url: url,
      validade: params.validade,
      status: "vigente",
    });

    await documentosRepository.update(supabase, params.docAntigo.id, {
      status: "substituido",
      substituido_por: novoDoc.id,
    });

    return novoDoc;
  },
};
