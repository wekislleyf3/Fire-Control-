export type StatusLeadSite = "novo" | "convertido" | "descartado";

export type LeadSite = {
  id: string;
  nome: string;
  whatsapp: string;
  estabelecimento: string | null;
  bairro: string | null;
  data_preferida: string | null;
  turno_preferido: string | null;
  interesse: string | null;
  status: StatusLeadSite;
  cliente_id: string | null;
  created_at: string;
};
