export type ClienteStatus = "ativo" | "inativo";

export type Cliente = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  responsavel: string | null;
  cidade: string | null;
  estado: string | null;
  status: ClienteStatus;
  proxima_visita: string | null;
  created_at: string;
};

/** Campos aceitos ao criar/editar um cliente pelo formulário. */
export type ClienteInput = Omit<Cliente, "id" | "created_at">;
