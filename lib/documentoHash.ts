import { createHash } from "crypto";

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

/** Serializa de forma determinística (ordem de chaves fixa) e aplica SHA-256. */
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

  return createHash("sha256").update(base).digest("hex");
}
