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

export type InspecaoInput = Omit<Inspecao, "id" | "created_at">;
