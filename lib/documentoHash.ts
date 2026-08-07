import { createHmac } from "crypto";

/**
 * Assina com HMAC-SHA256 usando SELO_HMAC_SECRET (só existe no servidor,
 * nunca prefixado com NEXT_PUBLIC_). Sem isso, hash SHA-256 puro seria
 * recalculável por qualquer um que conheça o algoritmo (que é público,
 * já que o repositório é aberto) — o HMAC garante que só quem tem o
 * segredo consegue gerar um hash válido, tornando o selo à prova de
 * forjamento e não só de adulteração acidental no banco.
 */
function hmacSha256(base: string): string {
  const secret = process.env.SELO_HMAC_SECRET;
  if (!secret) {
    throw new Error(
      "SELO_HMAC_SECRET não configurada. Gere uma string aleatória longa (ex: `openssl rand -hex 32`) e defina essa variável no servidor (.env.local / Vercel)."
    );
  }
  return createHmac("sha256", secret).update(base).digest("hex");
}

/**
 * Dados da inspeção que entram no hash de integridade do documento.
 * É sobre ESSES dados que o hash é calculado — não sobre os bytes finais
 * do PDF. Isso é proposital: o PDF final contém o próprio QR/hash impresso
 * nele, então tentar fazer hash do PDF depois de já ter impresso o hash
 * dentro dele é uma referência circular impossível de resolver. Em vez
 * disso, o hash garante a integridade do CONTEÚDO da inspeção: se alguém
 * alterar o resultado, o checklist ou o técnico responsável no banco depois
 * da emissão, o hash recalculado na verificação não vai mais bater com o
 * que foi gravado — evidenciando a adulteração.
 */
export type ConteudoParaHash = {
  inspecaoId: string;
  equipamentoId: string;
  clienteId: string;
  resultado: string;
  itensChecklist: Record<string, boolean>;
  responsavelTecnico: string | null;
  dataInspecao: string; // created_at da inspeção
};

/** Serializa de forma determinística (ordem de chaves fixa) e assina com HMAC-SHA256. */
export function hashConteudoInspecao(dados: ConteudoParaHash): string {
  const itensOrdenados = Object.keys(dados.itensChecklist)
    .sort()
    .map((k) => `${k}=${dados.itensChecklist[k]}`)
    .join(",");

  const base = [
    dados.inspecaoId,
    dados.equipamentoId,
    dados.clienteId,
    dados.resultado,
    dados.responsavelTecnico ?? "",
    dados.dataInspecao,
    itensOrdenados,
  ].join("|");

  return hmacSha256(base);
}

/**
 * Mesma ideia de `hashConteudoInspecao`, mas para o diagnóstico de um
 * cliente. IMPORTANTE: o hash cobre os dados BRUTOS e estáveis dos
 * equipamentos/documentos (código, tipo, status, datas de vencimento) —
 * NUNCA a lista de "problemas" ou o score do IFC calculados na hora, que
 * usam contagem de dias restantes e mudam sozinhos a cada dia que passa
 * (ex: "vence em 5 dias" vira "vence em 4 dias" no dia seguinte). Se o
 * hash incluísse esses valores derivados, o selo ficaria "inválido"
 * mesmo sem ninguém ter mexido em nada — só porque o tempo passou. Hash
 * só muda de verdade quando um equipamento/documento é criado, editado
 * ou removido para aquele cliente.
 */
export type EquipamentoParaHashDiagnostico = {
  codigo_interno: string;
  tipo: string;
  status: string;
  proxima_inspecao: string | null;
  proxima_recarga: string | null;
  proximo_teste_hidrostatico: string | null;
};

export type DocumentoParaHashDiagnostico = {
  tipo: string;
  validade: string | null;
};

export type ConteudoDiagnosticoParaHash = {
  clienteId: string;
  equipamentos: EquipamentoParaHashDiagnostico[];
  documentos: DocumentoParaHashDiagnostico[];
};

export function hashConteudoDiagnostico(dados: ConteudoDiagnosticoParaHash): string {
  const equipamentosOrdenados = [...dados.equipamentos]
    .sort((a, b) => a.codigo_interno.localeCompare(b.codigo_interno))
    .map(
      (e) =>
        `${e.codigo_interno}:${e.tipo}:${e.status}:${e.proxima_inspecao ?? ""}:${e.proxima_recarga ?? ""}:${
          e.proximo_teste_hidrostatico ?? ""
        }`
    )
    .join(",");

  const documentosOrdenados = [...dados.documentos]
    .sort((a, b) => a.tipo.localeCompare(b.tipo))
    .map((d) => `${d.tipo}:${d.validade ?? ""}`)
    .join(",");

  const base = [dados.clienteId, equipamentosOrdenados, documentosOrdenados].join("|");

  return hmacSha256(base);
}

/**
 * Hash de integridade da Ordem de Serviço. Cobre tipo, cliente, data,
 * técnico, status, os itens (equipamento + se já foi verificado em campo)
 * e a assinatura coletada — qualquer alteração num desses pontos depois da
 * emissão faz o hash recalculado na verificação não bater mais com o
 * gravado, evidenciando adulteração.
 */
export type ItemParaHashOrdemServico = {
  equipamentoId: string | null;
  verificado: boolean;
};

export type ConteudoOrdemServicoParaHash = {
  ordemServicoId: string;
  clienteId: string;
  tipo: string;
  data: string;
  responsavelTecnico: string | null;
  status: string;
  itens: ItemParaHashOrdemServico[];
  assinaturaNome: string | null;
  assinaturaData: string | null;
};

export function hashConteudoOrdemServico(dados: ConteudoOrdemServicoParaHash): string {
  const itensOrdenados = [...dados.itens]
    .sort((a, b) => (a.equipamentoId ?? "").localeCompare(b.equipamentoId ?? ""))
    .map((i) => `${i.equipamentoId ?? ""}:${i.verificado}`)
    .join(",");

  const base = [
    dados.ordemServicoId,
    dados.clienteId,
    dados.tipo,
    dados.data,
    dados.responsavelTecnico ?? "",
    dados.status,
    itensOrdenados,
    dados.assinaturaNome ?? "",
    dados.assinaturaData ?? "",
  ].join("|");

  return hmacSha256(base);
}
