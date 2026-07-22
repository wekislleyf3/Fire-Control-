export type EquipamentoStatus = "ok" | "atencao" | "vencido";

export type Equipamento = {
  id: string;
  codigo_interno: string;
  cliente_id: string;
  unidade_id: string | null;
  numero_patrimonio: string | null;
  tipo: string;
  classe: string | null;
  capacidade: string | null;
  fabricante: string | null;
  modelo: string | null;
  numero_serie: string | null;
  ano_fabricacao: number | null;
  data_instalacao: string | null;
  localizacao: string | null;
  setor: string | null;
  pavimento: string | null;
  foto_url: string | null;
  qr_code_url: string | null;
  observacoes: string | null;
  status: EquipamentoStatus;
  ultima_inspecao: string | null;
  proxima_inspecao: string | null;
  ultima_manutencao: string | null;
  proxima_manutencao: string | null;
  ultima_recarga: string | null;
  proxima_recarga: string | null;
  ultimo_teste_hidrostatico: string | null;
  proximo_teste_hidrostatico: string | null;
  garantia_ate: string | null;
  /**
   * Campos técnicos específicos do tipo de equipamento (ex: pressão do
   * extintor, diâmetro da mangueira, vazão do hidrante...). Opcional e
   * livre (JSONB) — não substitui nenhuma coluna existente, apenas
   * complementa com detalhes técnicos por tipo. Ver lib/equipamentos/especificacoesSchemas.ts.
   */
  especificacoes?: Record<string, any> | null;
  created_at: string;
};

export type EquipamentoInput = Omit<Equipamento, "id" | "created_at" | "status">;
