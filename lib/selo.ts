import { createHmac } from "crypto";

/**
 * Gera o código de verificação (selo) de um documento a partir de uma
 * assinatura HMAC-SHA256. Só roda no servidor (Route Handler / Server
 * Component) — nunca importe este arquivo de um componente "use client",
 * senão a chave secreta vazaria no bundle do navegador.
 *
 * O código é determinístico: o mesmo (tabela, id, createdAt) sempre gera
 * o mesmo código, então dá pra reconferir a qualquer momento sem precisar
 * guardar nada além do próprio código. Sem a SELO_HMAC_SECRET (que fica só
 * nas variáveis de ambiente do servidor), não é possível calcular um
 * código válido — por isso é "infalsificável": ninguém consegue produzir
 * um selo que passe na verificação sem ter a chave.
 */
export function gerarCodigoSelo(params: { tabela: string; id: string; createdAt: string }): string {
  const secret = process.env.SELO_HMAC_SECRET;
  if (!secret) {
    throw new Error(
      "SELO_HMAC_SECRET não configurada. Defina essa variável de ambiente no servidor (.env.local / Vercel)."
    );
  }

  const base = `${params.tabela}:${params.id}:${params.createdAt}`;
  const hash = createHmac("sha256", secret).update(base).digest("hex").toUpperCase();

  // Formata em blocos de 4 caracteres pra ficar legível e fácil de digitar
  // manualmente na página de verificação: ex. "FC7A-91B2-4D3E-88C1"
  return hash
    .slice(0, 16)
    .match(/.{1,4}/g)!
    .join("-");
}
