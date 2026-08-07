import type { SupabaseClient } from "@supabase/supabase-js";
import { CHECKLISTS_POR_TIPO, CHECKLIST_PADRAO, getChecklistParaTipo, type ChecklistItemDef } from "@/lib/checklists";

export const TIPOS_EQUIPAMENTO = [
  "Extintor",
  "Mangueira",
  "Hidrante",
  "Mangotinho",
  "Porta corta-fogo",
  "Iluminação de emergência",
  "Placa",
  "Alarme",
  "Detector",
  "Sprinkler",
  "Bomba",
  "Central de incêndio",
];

export type Procedimento = {
  id: string;
  tipo_equipamento: string;
  nome: string;
  descricao: string | null;
  objetivo: string | null;
  responsavel_padrao: string | null;
  normas_relacionadas: string | null;
  documentos_necessarios: string | null;
  frequencia: string | null;
  created_at: string;
  updated_at: string;
};

export type ProcedimentoItem = {
  id: string;
  procedimento_id: string;
  chave: string;
  pergunta: string;
  norma_referencia: string | null;
  critico: boolean;
  ordem: number;
};

export type ProcedimentoInput = Omit<Procedimento, "id" | "created_at" | "updated_at">;

/**
 * Busca o checklist aplicável a um tipo de equipamento: se existir um
 * procedimento customizado (Método Fire) com itens cadastrados, usa ele;
 * senão, cai automaticamente no checklist padrão do sistema
 * (lib/checklists.ts) — é assim que "nada quebra" pra quem não
 * personalizar nada.
 */
export async function getChecklistDoProcedimento(
  supabase: SupabaseClient,
  tipo: string | null | undefined
): Promise<ChecklistItemDef[]> {
  if (!tipo) return CHECKLIST_PADRAO;

  const { data: procedimento } = await supabase
    .from("procedimentos")
    .select("id")
    .eq("tipo_equipamento", tipo)
    .maybeSingle();

  if (!procedimento) return getChecklistParaTipo(tipo);

  const { data: itens } = await supabase
    .from("procedimento_itens")
    .select("chave, pergunta, norma_referencia, critico")
    .eq("procedimento_id", procedimento.id)
    .order("ordem", { ascending: true });

  if (!itens || itens.length === 0) return getChecklistParaTipo(tipo);

  return itens.map((i) => ({
    key: i.chave,
    label: i.pergunta,
    critico: i.critico,
    norma_referencia: i.norma_referencia ?? undefined,
  }));
}

/** Checklist padrão (hardcoded) de um tipo — usado como ponto de partida ao criar um procedimento customizado. */
export function checklistPadraoDoTipo(tipo: string): ChecklistItemDef[] {
  return CHECKLISTS_POR_TIPO[tipo] ?? CHECKLIST_PADRAO;
}
