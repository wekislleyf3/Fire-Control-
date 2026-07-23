export type StatusLaudo = "valido" | "revogado";

export type LaudoAutenticacao = {
  id: string;
  inspecao_id: string;
  equipamento_id: string;
  token_validacao: string;
  hash_documento: string;
  status: StatusLaudo;
  data_emissao: string;
};
