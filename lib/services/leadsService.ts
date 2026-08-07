import type { SupabaseClient } from "@supabase/supabase-js";
import { leadsRepository } from "@/lib/repositories/leadsRepository";
import { clientesService } from "@/lib/services/clientesService";
import { agendaRepository } from "@/lib/repositories/agendaRepository";
import type { LeadSite } from "@/types/leadSite";
import type { Cliente } from "@/types/cliente";

/**
 * Service: regra de negócio + orquestração. Páginas chamam o service,
 * nunca o repository ou o Supabase diretamente.
 */
export const leadsService = {
  list(supabase: SupabaseClient, apenasNovos: boolean): Promise<LeadSite[]> {
    return leadsRepository.list(supabase, { apenasNovos });
  },

  /**
   * Converte um lead em cliente: cria o cliente (entra em "Prospecção" no
   * Pipeline por padrão), agenda a visita se o lead indicou data
   * preferida, e marca o lead como convertido. Se a criação do cliente
   * falhar, nada mais acontece; se só o passo final (marcar convertido)
   * falhar, o cliente já existe e o erro avisa disso — quem chamar decide
   * como comunicar.
   */
  async converterEmCliente(supabase: SupabaseClient, lead: LeadSite): Promise<Cliente> {
    const novoCliente = await clientesService.create(supabase, {
      tipo_pessoa: "juridica",
      razao_social: lead.estabelecimento || lead.nome,
      nome_fantasia: null,
      cnpj: null,
      cpf: null,
      inscricao_estadual: null,
      telefone: null,
      whatsapp: lead.whatsapp,
      email: null,
      responsavel: lead.nome,
      cargo: null,
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: lead.bairro,
      cidade: null,
      estado: null,
      google_maps_url: null,
      observacoes: lead.interesse ? `Interesse (site): ${lead.interesse}` : null,
      status: "ativo",
      proxima_visita: null,
    });

    // Se a pessoa indicou data preferida, já cria o evento na Agenda.
    if (lead.data_preferida) {
      await agendaRepository.create(supabase, {
        cliente_id: novoCliente.id,
        tipo: "visita",
        titulo: `Visita técnica — diagnóstico (${lead.estabelecimento || lead.nome})`,
        data: lead.data_preferida,
        observacoes: lead.turno_preferido ? `Turno preferido: ${lead.turno_preferido}` : null,
      });
    }

    try {
      await leadsRepository.updateStatus(supabase, lead.id, "convertido", novoCliente.id);
    } catch (err) {
      throw new Error(
        `Cliente criado, mas não consegui marcar o lead como convertido: ${(err as Error).message}`
      );
    }

    return novoCliente;
  },

  descartar(supabase: SupabaseClient, id: string): Promise<void> {
    return leadsRepository.updateStatus(supabase, id, "descartado");
  },
};
