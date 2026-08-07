import type { SupabaseClient } from "@supabase/supabase-js";
import { equipamentosRepository } from "@/lib/repositories/equipamentosRepository";
import { clientesRepository } from "@/lib/repositories/clientesRepository";
import { documentosRepository } from "@/lib/repositories/documentosRepository";
import { inspecoesRepository, equipamentoHistoricoRepository } from "@/lib/repositories/inspecoesRepository";
import { ordensServicoRepository } from "@/lib/repositories/ordensServicoRepository";
import { laudosRepository } from "@/lib/repositories/laudosRepository";
import type { Equipamento, EquipamentoInput } from "@/types/equipamento";
import type { Cliente } from "@/types/cliente";
import type { Documento } from "@/types/documento";
import type { Inspecao } from "@/types/inspecao";
import type { StatusOS, TipoOS } from "@/types/ordemServico";

/** Erro de validação de negócio, distinto de erros de rede/banco. */
export class ValidationError extends Error {}

type PdfEmitido = {
  token: string;
  status: "valido" | "revogado";
  data_emissao: string;
  tipo: "inspecao" | "ordem_servico";
  label: string;
};

type OrdemServicoResumo = { id: string; numero: number; tipo: TipoOS; data: string; status: StatusOS; verificado: boolean };

export type EquipamentoDetalhe = {
  equipamento: Equipamento;
  cliente: Cliente | null;
  inspecoes: Inspecao[];
  historico: Awaited<ReturnType<typeof equipamentoHistoricoRepository.listPorEquipamento>>;
  documentos: Documento[];
  pdfsEmitidos: PdfEmitido[];
  ordensServico: OrdemServicoResumo[];
};

/** Campos de data do formulário: string vazia precisa virar null (coluna "date" do Postgres não aceita ""). */
const CAMPOS_DE_DATA = [
  "data_instalacao",
  "proxima_inspecao",
  "proxima_manutencao",
  "proxima_recarga",
  "proximo_teste_hidrostatico",
  "garantia_ate",
] as const;

function normalizar(input: EquipamentoInput): EquipamentoInput {
  const normalizado = { ...input };
  for (const campo of CAMPOS_DE_DATA) {
    if ((normalizado as Record<string, unknown>)[campo] === "") {
      (normalizado as Record<string, unknown>)[campo] = null;
    }
  }
  return normalizado;
}

function validate(input: EquipamentoInput) {
  if (!input.codigo_interno || !input.codigo_interno.trim()) {
    throw new ValidationError("Código interno é obrigatório.");
  }
  if (!input.cliente_id) {
    throw new ValidationError("Cliente é obrigatório.");
  }
  if (!input.tipo || !input.tipo.trim()) {
    throw new ValidationError("Tipo de equipamento é obrigatório.");
  }
}

/**
 * Service: regra de negócio + orquestração. Páginas chamam o service,
 * nunca o repository ou o Supabase diretamente.
 */
export const equipamentosService = {
  list(supabase: SupabaseClient): Promise<Equipamento[]> {
    return equipamentosRepository.list(supabase);
  },

  getById(supabase: SupabaseClient, id: string): Promise<Equipamento | null> {
    return equipamentosRepository.getById(supabase, id);
  },

  async create(supabase: SupabaseClient, input: EquipamentoInput): Promise<Equipamento> {
    const normalizado = normalizar(input);
    validate(normalizado);
    return equipamentosRepository.create(supabase, normalizado);
  },

  async update(supabase: SupabaseClient, id: string, input: EquipamentoInput): Promise<Equipamento> {
    const normalizado = normalizar(input);
    validate(normalizado);
    return equipamentosRepository.update(supabase, id, normalizado);
  },

  remove(supabase: SupabaseClient, id: string): Promise<void> {
    return equipamentosRepository.remove(supabase, id);
  },

  /** Envia a foto e já salva a URL no registro do equipamento. */
  async atualizarFoto(supabase: SupabaseClient, equipamento: Equipamento, file: File): Promise<Equipamento> {
    const fotoUrl = await equipamentosRepository.uploadFoto(supabase, equipamento.id, file);
    return equipamentosRepository.update(supabase, equipamento.id, { foto_url: fotoUrl });
  },

  /**
   * Carrega tudo que a página de detalhe do equipamento precisa: dados
   * cadastrais, cliente, inspeções, histórico manual, documentos do
   * cliente, PDFs/selos já emitidos (de inspeções e de OSs que incluíram
   * este equipamento) e o resumo das OSs. Retorna null se o id não existe.
   */
  async carregarDetalhe(supabase: SupabaseClient, id: string): Promise<EquipamentoDetalhe | null> {
    const equipamento = await equipamentosRepository.getById(supabase, id);
    if (!equipamento) return null;

    const [cliente, inspecoes, historico, documentos, itensOs] = await Promise.all([
      clientesRepository.getById(supabase, equipamento.cliente_id),
      inspecoesRepository.listPorEquipamento(supabase, id, 20),
      equipamentoHistoricoRepository.listPorEquipamento(supabase, id, 30),
      documentosRepository.listPorCliente(supabase, equipamento.cliente_id, { apenasVigentes: false }),
      ordensServicoRepository.listItensPorEquipamento(supabase, id),
    ]);

    const osIds = itensOs.map((i) => i.ordem_servico_id);
    const inspecaoIds = inspecoes.map((i) => i.id);

    const [laudosInsp, laudosOs] = await Promise.all([
      laudosRepository.listPorInspecoes(supabase, inspecaoIds),
      laudosRepository.listPorOrdensServico(supabase, osIds),
    ]);

    const ordensServico: OrdemServicoResumo[] = itensOs
      .map((i) => ({
        id: i.ordem_servico_id,
        numero: i.numero,
        tipo: i.tipo,
        data: i.data,
        status: i.status,
        verificado: i.verificado,
      }))
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    const numeroPorOs = new Map(itensOs.map((i) => [i.ordem_servico_id, i.numero]));

    const pdfsInsp: PdfEmitido[] = laudosInsp.map((l) => ({
      token: l.token_validacao,
      status: l.status,
      data_emissao: l.data_emissao,
      tipo: "inspecao",
      label: `Laudo de inspeção — ${new Date(l.data_emissao).toLocaleDateString("pt-BR")}`,
    }));
    const pdfsOs: PdfEmitido[] = laudosOs.map((l) => ({
      token: l.token_validacao,
      status: l.status,
      data_emissao: l.data_emissao,
      tipo: "ordem_servico",
      label: `OS-${String(numeroPorOs.get(l.ordem_servico_id) ?? "?").padStart(5, "0")}`,
    }));

    const pdfsEmitidos = [...pdfsInsp, ...pdfsOs].sort(
      (a, b) => new Date(b.data_emissao).getTime() - new Date(a.data_emissao).getTime()
    );

    return { equipamento, cliente, inspecoes, historico, documentos, pdfsEmitidos, ordensServico };
  },

  /** Registra um evento manual na linha do tempo do equipamento (recarga, troca de peça etc.). */
  registrarEventoManual(
    supabase: SupabaseClient,
    params: { equipamento_id: string; data: string; evento: string; observacoes: string | null }
  ): Promise<void> {
    if (!params.evento.trim()) throw new ValidationError("Descreva o evento antes de registrar.");
    return equipamentoHistoricoRepository.registrar(supabase, params);
  },
};
