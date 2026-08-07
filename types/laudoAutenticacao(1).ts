export type StatusLaudo = "valido" | "revogado";
export type TipoDocumentoLaudo = "inspecao" | "diagnostico";

export type LaudoAutenticacao = {
  id: string;
  tipo_documento: TipoDocumentoLaudo;
  inspecao_id: string | null;
  equipamento_id: string | null;
  cliente_id: string | null;
  token_validacao: string;
  hash_documento: string;
  status: StatusLaudo;
  data_emissao: string;
};
