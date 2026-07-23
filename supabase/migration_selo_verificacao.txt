-- Código de verificação (selo) impresso no PDF de inspeção.
-- É gerado no servidor via HMAC-SHA256 (ver lib/selo.ts + app/api/selo/route.ts),
-- então não dá pra alguém forjar um código válido sem ter a chave secreta
-- do servidor (SELO_HMAC_SECRET, nunca exposta ao navegador).

ALTER TABLE inspecoes ADD COLUMN IF NOT EXISTS codigo_verificacao TEXT;

-- Único quando preenchido (permite múltiplas linhas com valor NULL, que é o
-- estado de inspeções antigas, geradas antes desta funcionalidade existir).
CREATE UNIQUE INDEX IF NOT EXISTS idx_inspecoes_codigo_verificacao
    ON inspecoes (codigo_verificacao)
    WHERE codigo_verificacao IS NOT NULL;
