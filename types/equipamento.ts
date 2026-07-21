export type EquipamentoStatus = "ok" | "atencao" | "vencido";

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
  status: EquipamentoStatus;
  created_at: string;
};

export type EquipamentoInput = Omit<Equipamento, "id" | "created_at" | "status">;
