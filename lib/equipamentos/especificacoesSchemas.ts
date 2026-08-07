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
  Alarme: [
    {
      name: "tipo_acionamento",
      label: "Tipo de Acionamento",
      type: "select",
      options: [
        { label: "Manual", value: "manual" },
        { label: "Automático", value: "automatico" },
        { label: "Misto (manual + automático)", value: "misto" },
      ],
    },
    { name: "zona", label: "Zona / Setor", type: "text", placeholder: "Ex: Zona 3 - Bloco B" },
    { name: "tensao_operacao", label: "Tensão de Operação", type: "text", placeholder: "Ex: 24VDC" },
    { name: "possui_central_propria", label: "Possui central própria (não integrada)", type: "boolean" },
  ],
  Detector: [
    {
      name: "tipo_deteccao",
      label: "Tipo de Detecção",
      type: "select",
      options: [
        { label: "Fumaça (óptico/iônico)", value: "fumaca" },
        { label: "Calor / Temperatura", value: "calor" },
        { label: "Chama", value: "chama" },
        { label: "Múltiplo (multissensor)", value: "multiplo" },
      ],
    },
    { name: "endereco_zona", label: "Endereço / Zona", type: "text", placeholder: "Ex: Loop 1 - End. 12" },
    { name: "sensibilidade", label: "Sensibilidade Configurada", type: "text", placeholder: "Ex: Média" },
  ],
  Sprinkler: [
    {
      name: "tipo_bulbo",
      label: "Tipo de Elemento Sensível",
      type: "select",
      options: [
        { label: "Bulbo de Vidro", value: "bulbo_vidro" },
        { label: "Fusível Metálico", value: "fusivel" },
      ],
    },
    { name: "temperatura_acionamento", label: "Temperatura de Acionamento", type: "text", placeholder: "Ex: 68°C" },
    { name: "pressao_trabalho", label: "Pressão de Trabalho", type: "text", placeholder: "Ex: 1.2 MPa" },
    { name: "cobertura_m2", label: "Área de Cobertura (m²)", type: "number", placeholder: "Ex: 12" },
  ],
  Bomba: [
    {
      name: "tipo_bomba",
      label: "Tipo de Bomba",
      type: "select",
      options: [
        { label: "Elétrica (principal)", value: "eletrica" },
        { label: "Diesel (reserva)", value: "diesel" },
        { label: "Jockey (pressurização)", value: "jockey" },
      ],
    },
    { name: "vazao_nominal", label: "Vazão Nominal", type: "text", placeholder: "Ex: 500 L/min" },
    { name: "pressao_nominal", label: "Pressão Nominal", type: "text", placeholder: "Ex: 8 kgf/cm²" },
    { name: "potencia_motor", label: "Potência do Motor", type: "text", placeholder: "Ex: 15 cv" },
  ],
  "Central de incêndio": [
    {
      name: "tipo_central",
      label: "Tipo de Central",
      type: "select",
      options: [
        { label: "Convencional", value: "convencional" },
        { label: "Endereçável", value: "enderecavel" },
      ],
    },
    { name: "numero_zonas", label: "Número de Zonas/Laços", type: "number", placeholder: "Ex: 8" },
    { name: "possui_backup_bateria", label: "Possui bateria de backup", type: "boolean" },
    { name: "autonomia_bateria_horas", label: "Autonomia da Bateria (horas)", type: "number", placeholder: "Ex: 24" },
  ],
};

export function getEspecificacoesSchema(tipo: string | null | undefined): FieldDefinition[] {
  if (!tipo) return [];
  return ESPECIFICACOES_POR_TIPO[tipo] ?? [];
}
