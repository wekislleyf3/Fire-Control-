export type StatusDocumento = "vigente" | "substituido";

export type Documento = {
  id: string;
  cliente_id: string;
  tipo: string;
  nome_arquivo: string;
  arquivo_url: string;
  validade: string | null;
  /** 'vigente' é o documento ativo hoje; 'substituido' fica só pra histórico (Timeline). */
  status: StatusDocumento;
  substituido_por: string | null;
  created_at: string;
};

export type DocumentoInput = Omit<Documento, "id" | "created_at" | "status" | "substituido_por">;
