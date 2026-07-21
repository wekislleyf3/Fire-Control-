import type { SupabaseClient } from "@supabase/supabase-js";
import { clientesRepository } from "@/lib/repositories/clientesRepository";
import type { Cliente, ClienteInput } from "@/types/cliente";

/** Erro de validação de negócio, distinto de erros de rede/banco. */
export class ValidationError extends Error {}

function validate(input: ClienteInput) {
  if (!input.razao_social || !input.razao_social.trim()) {
    throw new ValidationError("Razão social é obrigatória.");
  }
  if (input.cnpj && input.cnpj.replace(/\D/g, "").length !== 14) {
    throw new ValidationError("CNPJ inválido — deve ter 14 dígitos.");
  }
}

/**
 * Service: regra de negócio + orquestração. Páginas chamam o service,
 * nunca o repository ou o Supabase diretamente.
 */
export const clientesService = {
  list(supabase: SupabaseClient): Promise<Cliente[]> {
    return clientesRepository.list(supabase);
  },

  async create(supabase: SupabaseClient, input: ClienteInput): Promise<Cliente> {
    validate(input);
    return clientesRepository.create(supabase, input);
  },

  async update(supabase: SupabaseClient, id: string, input: ClienteInput): Promise<Cliente> {
    validate(input);
    return clientesRepository.update(supabase, id, input);
  },

  remove(supabase: SupabaseClient, id: string): Promise<void> {
    return clientesRepository.remove(supabase, id);
  },
};
