/**
 * Checklists de inspeção por tipo de equipamento.
 *
 * Cada tipo de equipamento (Extintor, Mangueira, Hidrante, ...) tem seus
 * próprios itens de verificação — os itens mostrados no formulário de
 * inspeção mudam automaticamente conforme o equipamento selecionado.
 *
 * `critico: true` significa que, se o item for marcado como "não conforme",
 * a inspeção inteira é automaticamente classificada como "não conforme",
 * independente dos demais itens.
 */
export type ChecklistItemDef = {
  key: string;
  label: string;
  critico?: boolean;
};

/** Usado para qualquer tipo de equipamento que não tenha checklist específico abaixo. */
export const CHECKLIST_PADRAO: ChecklistItemDef[] = [
  { key: "funcionando", label: "Equipamento funcionando corretamente?", critico: true },
  { key: "acesso_livre", label: "Acesso livre e desobstruído?", critico: true },
  { key: "sinalizacao_correta", label: "Sinalização correta e visível?" },
  { key: "identificacao_legivel", label: "Identificação/etiqueta legível?" },
  { key: "sem_corrosao", label: "Sem sinais de corrosão ou dano físico?" },
  { key: "necessita_manutencao", label: "Necessita manutenção?", critico: true },
];

export const CHECKLISTS_POR_TIPO: Record<string, ChecklistItemDef[]> = {
  "Extintor": [
    { key: "lacre_integro", label: "Lacre e pino de segurança íntegros?", critico: true },
    { key: "manometro_correto", label: "Manômetro na faixa correta (verde)?", critico: true },
    { key: "mangueira_bico_ok", label: "Mangueira e bico/difusor em bom estado?" },
    { key: "sem_corrosao_amassado", label: "Sem corrosão, amassados ou vazamentos?", critico: true },
    { key: "sinalizacao_correta", label: "Sinalização e identificação visíveis?" },
    { key: "acesso_livre", label: "Acesso livre e desobstruído?", critico: true },
    { key: "suporte_altura_correta", label: "Fixado no suporte, na altura correta?" },
    { key: "prazo_validade_ok", label: "Dentro do prazo de validade/recarga?", critico: true },
    { key: "necessita_manutencao", label: "Necessita manutenção ou recarga?", critico: true },
  ],
  "Mangueira": [
    { key: "estado_conservacao", label: "Mangueira sem furos, cortes ou ressecamento?", critico: true },
    { key: "esguicho_ok", label: "Esguicho/registro em bom estado?" },
    { key: "acoplamentos_ok", label: "Acoplamentos e uniões sem vazamento?", critico: true },
    { key: "abrigo_ok", label: "Abrigo/caixa de mangueira em bom estado?" },
    { key: "acesso_livre", label: "Acesso livre e desobstruído?", critico: true },
    { key: "sinalizacao_correta", label: "Sinalização correta e visível?" },
    { key: "teste_hidrostatico_ok", label: "Teste hidrostático dentro do prazo?", critico: true },
    { key: "necessita_manutencao", label: "Necessita manutenção ou substituição?", critico: true },
  ],
  "Hidrante": [
    { key: "registro_ok", label: "Registro de abertura funcionando sem travar?", critico: true },
    { key: "mangueira_acoplada_ok", label: "Mangueira, esguicho e chave de mangueira presentes?", critico: true },
    { key: "pressao_ok", label: "Pressão de água adequada?", critico: true },
    { key: "vazamentos", label: "Sem vazamentos nas conexões?", critico: true },
    { key: "abrigo_ok", label: "Abrigo/caixa em bom estado e sinalizado?" },
    { key: "acesso_livre", label: "Acesso livre e desobstruído?", critico: true },
    { key: "necessita_manutencao", label: "Necessita manutenção?", critico: true },
  ],
  "Mangotinho": [
    { key: "estado_conservacao", label: "Mangote sem furos, cortes ou ressecamento?", critico: true },
    { key: "esguicho_ok", label: "Esguicho regulável em bom estado?" },
    { key: "registro_ok", label: "Registro/válvula funcionando sem travar?", critico: true },
    { key: "abrigo_ok", label: "Abrigo em bom estado e sinalizado?" },
    { key: "acesso_livre", label: "Acesso livre e desobstruído?", critico: true },
    { key: "necessita_manutencao", label: "Necessita manutenção?", critico: true },
  ],
  "Porta corta-fogo": [
    { key: "fechamento_automatico", label: "Fechamento automático (mola/braço hidráulico) funcionando?", critico: true },
    { key: "veda_corretamente", label: "Veda corretamente o vão, sem folgas?", critico: true },
    { key: "barra_antipanico_ok", label: "Barra antipânico funcionando (se houver)?" },
    { key: "sem_travas_impedimento", label: "Sem cunhas, cordas ou travas que impeçam o fechamento?", critico: true },
    { key: "sinalizacao_correta", label: "Sinalização de \"mantenha fechada\" visível?" },
    { key: "acesso_livre", label: "Acesso livre e desobstruído dos dois lados?" },
    { key: "necessita_manutencao", label: "Necessita manutenção (dobradiças, fechadura, vedação)?", critico: true },
  ],
  "Iluminação de emergência": [
    { key: "acende_na_falta_luz", label: "Acende automaticamente na falta de energia?", critico: true },
    { key: "bateria_ok", label: "Bateria com carga/autonomia adequada?", critico: true },
    { key: "led_lampada_ok", label: "LED/lâmpada sem queima ou falha?" },
    { key: "fixacao_ok", label: "Fixação e posicionamento corretos?" },
    { key: "sem_danos_fisicos", label: "Sem danos físicos ou trincas?" },
    { key: "necessita_manutencao", label: "Necessita manutenção ou troca de bateria?", critico: true },
  ],
  "Placa": [
    { key: "visivel_bem_posicionada", label: "Visível e bem posicionada?", critico: true },
    { key: "fotoluminescente_ok", label: "Material fotoluminescente/iluminado funcionando?" },
    { key: "legivel_sem_danos", label: "Legível, sem rasuras, quebras ou desbotamento?" },
    { key: "fixacao_ok", label: "Fixação firme?" },
    { key: "necessita_manutencao", label: "Necessita substituição?", critico: true },
  ],
  "Alarme": [
    { key: "central_ok", label: "Central de alarme sem falhas/avarias sinalizadas?", critico: true },
    { key: "acionadores_ok", label: "Acionadores manuais acessíveis e sinalizados?", critico: true },
    { key: "sirenes_ok", label: "Sirenes/avisadores sonoros e visuais funcionando?", critico: true },
    { key: "bateria_backup_ok", label: "Bateria de backup em boas condições?" },
    { key: "acesso_livre", label: "Acesso livre aos acionadores?" },
    { key: "necessita_manutencao", label: "Necessita manutenção?", critico: true },
  ],
  "Detector": [
    { key: "led_indicador_ok", label: "LED indicador de funcionamento normal?", critico: true },
    { key: "sem_sujeira_obstrucao", label: "Sem poeira, tinta ou obstrução no sensor?", critico: true },
    { key: "fixacao_ok", label: "Fixação correta no teto/parede?" },
    { key: "teste_funcional_ok", label: "Teste funcional (botão de teste) respondeu corretamente?", critico: true },
    { key: "necessita_manutencao", label: "Necessita limpeza ou substituição?", critico: true },
  ],
  "Sprinkler": [
    { key: "bulbo_ampola_ok", label: "Bulbo/ampola íntegro, sem vazamento?", critico: true },
    { key: "sem_pintura_obstrucao", label: "Sem pintura, corrosão ou obstrução no bico?", critico: true },
    { key: "pressao_rede_ok", label: "Pressão da rede dentro do esperado?", critico: true },
    { key: "area_cobertura_livre", label: "Área de cobertura sem obstruções (estoque, forro)?" },
    { key: "necessita_manutencao", label: "Necessita manutenção ou substituição?", critico: true },
  ],
  "Bomba": [
    { key: "liga_automatico", label: "Aciona automaticamente na queda de pressão?", critico: true },
    { key: "sem_vazamentos", label: "Sem vazamentos nas conexões/gaxetas?", critico: true },
    { key: "pressao_manometros_ok", label: "Pressão nos manômetros dentro da faixa?", critico: true },
    { key: "nivel_combustivel_oleo", label: "Nível de combustível/óleo adequado (bomba diesel)?" },
    { key: "painel_comando_ok", label: "Painel de comando sem alarmes/falhas?", critico: true },
    { key: "necessita_manutencao", label: "Necessita manutenção?", critico: true },
  ],
  "Central de incêndio": [
    { key: "sem_avarias_sinalizadas", label: "Painel sem avarias ou falhas sinalizadas?", critico: true },
    { key: "bateria_backup_ok", label: "Bateria de backup em boas condições?", critico: true },
    { key: "zonas_monitoradas_ok", label: "Todas as zonas monitoradas, sem bypass indevido?", critico: true },
    { key: "log_eventos_ok", label: "Log de eventos revisado, sem falhas recorrentes?" },
    { key: "necessita_manutencao", label: "Necessita manutenção?", critico: true },
  ],
};

/** Retorna o checklist aplicável ao tipo de equipamento (ou o padrão, se não houver um específico). */
export function getChecklistParaTipo(tipo: string | null | undefined): ChecklistItemDef[] {
  if (!tipo) return CHECKLIST_PADRAO;
  return CHECKLISTS_POR_TIPO[tipo] ?? CHECKLIST_PADRAO;
}

/** Monta o objeto de respostas padrão (tudo conforme, itens críticos "necessita manutenção" como false). */
export function respostasPadrao(itens: ChecklistItemDef[]): Record<string, boolean> {
  const respostas: Record<string, boolean> = {};
  for (const item of itens) {
    respostas[item.key] = !item.key.startsWith("necessita_manutencao");
  }
  return respostas;
}

/**
 * Calcula o resultado geral da inspeção a partir das respostas do checklist.
 * Qualquer item crítico marcado como "não conforme" reprova a inspeção.
 */
export function calcularResultado(
  itens: ChecklistItemDef[],
  respostas: Record<string, boolean>
): "conforme" | "nao_conforme" {
  const reprovado = itens.some((item) => {
    const respondeuConforme = respostas[item.key];
    if (item.key.startsWith("necessita_manutencao")) {
      // Para este item, "true" significa que HÁ necessidade de manutenção — logo reprova.
      return respondeuConforme === true;
    }
    return item.critico && respondeuConforme === false;
  });
  return reprovado ? "nao_conforme" : "conforme";
}
