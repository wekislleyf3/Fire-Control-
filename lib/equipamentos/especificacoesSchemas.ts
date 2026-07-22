/**
 * Campos técnicos extras por tipo de equipamento, guardados na coluna
 * JSONB `especificacoes` (ver migration_equipamentos_especificacoes.sql).
 *
 * Isso é 100% opcional e aditivo: nenhum campo aqui é obrigatório para
 * salvar um equipamento. As chaves usadas em `TIPOS` (app/(protected)/
 * equipamentos/page.tsx) são a mesma usada aqui, então basta indexar
 * ESPECIFICACOES_POR_TIPO[form.tipo] para pegar os campos do tipo atual.
 *
 * Tipos sem entrada específica abaixo simplesmente não mostram nenhum
 * campo extra no formulário (fallback: array vazio).
 */

export interface FieldDefinition {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean";
  options?: { label: string; value: string }[];
  placeholder?: string;
}

export const ESPECIFICACOES_POR_TIPO: Record<string, FieldDefinition[]> = {
  Extintor: [
    {
      name: "agente_extintor",
      label: "Agente Extintor",
      type: "select",
      options: [
        { label: "Água (AP)", value: "agua" },
        { label: "Pó Químico Seco (PQS - BC)", value: "pqs_bc" },
        { label: "Pó Químico Seco (ABC)", value: "pqs_abc" },
        { label: "Dióxido de Carbono (CO2)", value: "co2" },
        { label: "Espuma Mecânica", value: "espuma" },
      ],
    },
    { name: "capacidade", label: "Capacidade (kg/L)", type: "text", placeholder: "Ex: 6kg ou 10 Litros" },
    { name: "pressao", label: "Pressão de Trabalho", type: "text", placeholder: "Ex: 1.0 MPa" },
    { name: "lacre_numero", label: "Número do Lacre", type: "text" },
    { name: "manometro_ok", label: "Manômetro na faixa correta", type: "boolean" },
  ],
  Mangueira: [
    {
      name: "tipo_mangueira",
      label: "Tipo da Mangueira",
      type: "select",
      options: [
        { label: "Tipo 1 (Edificações residenciais)", value: "tipo_1" },
        { label: "Tipo 2 (Edificações comerciais)", value: "tipo_2" },
        { label: "Tipo 3 (Áreas industriais)", value: "tipo_3" },
        { label: "Tipo 4 (Indústrias pesadas)", value: "tipo_4" },
        { label: "Tipo 5 (Indústrias químicas)", value: "tipo_5" },
      ],
    },
    { name: "diametro", label: "Diâmetro (pol/mm)", type: "text", placeholder: 'Ex: 1 1/2" ou 38mm' },
    { name: "comprimento", label: "Comprimento (m)", type: "text", placeholder: "Ex: 15m" },
    { name: "uniao_tipo", label: "Tipo de União", type: "text", placeholder: "Ex: Storz" },
  ],
  Mangotinho: [
    { name: "diametro", label: "Diâmetro (pol/mm)", type: "text", placeholder: 'Ex: 3/4" ou 25mm' },
    { name: "comprimento", label: "Comprimento (m)", type: "text", placeholder: "Ex: 30m" },
  ],
  Hidrante: [
    {
      name: "tipo_hidrante",
      label: "Tipo de Hidrante",
      type: "select",
      options: [
        { label: "De Parede (Caixa)", value: "parede" },
        { label: "Coluna / Urbano", value: "coluna" },
        { label: "Recalque (Passeio)", value: "recalque" },
      ],
    },
    { name: "diametro_saida", label: "Diâmetro da Saída", type: "text", placeholder: 'Ex: 2 1/2"' },
    { name: "pressao_estatica", label: "Pressão Estática (mca)", type: "text" },
    { name: "vazao", label: "Vazão Estimada (L/min)", type: "text" },
    { name: "chave_storz_presente", label: "Chave Storz presente", type: "boolean" },
  ],
  "Porta corta-fogo": [
    {
      name: "classificacao",
      label: "Resistência ao Fogo",
      type: "select",
      options: [
        { label: "P60 (60 minutos)", value: "p60" },
        { label: "P90 (90 minutos)", value: "p90" },
        { label: "P120 (120 minutos)", value: "p120" },
      ],
    },
    { name: "sentido_abertura", label: "Sentido de Abertura", type: "text" },
    { name: "possui_barra_antipanico", label: "Possui barra antipânico", type: "boolean" },
    { name: "retentor_eletromagnetico", label: "Possui retentor eletromagnético", type: "boolean" },
  ],
  "Iluminação de emergência": [
    {
      name: "tipo_luminaria",
      label: "Tipo de Sistema",
      type: "select",
      options: [
        { label: "Bloco Autônomo", value: "bloco_autonomo" },
        { label: "Centralizada (Bateria)", value: "centralizada" },
        { label: "Luminária Exclusiva LED", value: "led_exclusiva" },
      ],
    },
    { name: "autonomia_horas", label: "Autonomia (Horas)", type: "number", placeholder: "Ex: 2" },
    { name: "fluxo_luminoso_lumens", label: "Fluxo Luminoso (Lúmens)", type: "number", placeholder: "Ex: 1200" },
  ],
  Placa: [
    {
      name: "tipo_sinalizacao",
      label: "Categoria",
      type: "select",
      options: [
        { label: "Orientação e Salvamento", value: "orientacao_salvamento" },
        { label: "Equipamentos de Combate", value: "equipamentos" },
        { label: "Alerta e Perigo", value: "alerta" },
        { label: "Proibição", value: "proibicao" },
      ],
    },
    { name: "fotoluminescente", label: "É fotoluminescente (NBR 13434)", type: "boolean" },
    { name: "dimensoes", label: "Dimensões (cm)", type: "text", placeholder: "Ex: 20x30 cm" },
  ],
};

export function getEspecificacoesSchema(tipo: string | null | undefined): FieldDefinition[] {
  if (!tipo) return [];
  return ESPECIFICACOES_POR_TIPO[tipo] ?? [];
}
