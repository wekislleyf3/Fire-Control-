export type ClienteStatus = "ativo" | "inativo";
export type TipoPessoa = "fisica" | "juridica";

export type Cliente = {
  id: string;
  /** Gerada automaticamente pelo banco no cadastro (ex: FC-00001). */
  matricula: string | null;
  tipo_pessoa: TipoPessoa;
  /** Pessoa jurídica: razão social. Pessoa física: nome completo. */
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  cpf: string | null;
  inscricao_estadual: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  responsavel: string | null;
  cargo: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  google_maps_url: string | null;
  observacoes: string | null;
  status: ClienteStatus;
  proxima_visita: string | null;
  created_at: string;
};

/** Campos aceitos ao criar/editar um cliente pelo formulário. Matrícula é sempre gerada pelo banco. */
export type ClienteInput = Omit<Cliente, "id" | "created_at" | "matricula">;

/** Monta o endereço completo em uma única linha, pronto para exibição. */
export function enderecoCompleto(c: Pick<Cliente, "logradouro" | "numero" | "complemento" | "bairro" | "cidade" | "estado" | "cep">): string {
  const linha1 = [c.logradouro, c.numero].filter(Boolean).join(", ");
  const partes = [linha1 || null, c.complemento, c.bairro, [c.cidade, c.estado].filter(Boolean).join("/")].filter(Boolean);
  return partes.join(" — ");
}
