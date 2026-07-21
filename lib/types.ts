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
  status: "ativo" | "inativo";
  proxima_visita: string | null;
  created_at: string;
};


export type Equipamento = {
  id: string;
  codigo_interno: string;
  cliente_id: string;
  tipo: string;
  fabricante: string | null;
  numero_serie: string | null;
  localizacao: string | null;
  foto_url: string | null;
  proxima_inspecao: string | null;
  proxima_recarga: string | null;
  proximo_teste_hidrostatico: string | null;
  status: "ok" | "atencao" | "vencido";
  created_at: string;
};


export type Documento = {
  id: string;
  cliente_id: string;
  tipo: string;
  nome_arquivo: string;
  arquivo_url: string;
  validade: string | null;
  created_at: string;
};


export type Inspecao = {
  id: string;
  cliente_id: string;
  equipamento_id: string;
  funcionando: boolean;
  lacre_integro: boolean;
  manometro_correto: boolean;
  corrosao: boolean;
  acesso_livre: boolean;
  sinalizacao_correta: boolean;
  necessita_manutencao: boolean;
  observacoes: string | null;
  created_at: string;
};