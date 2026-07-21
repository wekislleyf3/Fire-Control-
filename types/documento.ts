export type Documento = {
  id: string;
  cliente_id: string;
  tipo: string;
  nome_arquivo: string;
  arquivo_url: string;
  validade: string | null;
  created_at: string;
};

export type DocumentoInput = Omit<Documento, "id" | "created_at">;
