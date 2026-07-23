-- Tabela de autenticação de laudos (PDFs de inspeção).
-- Cada emissão de laudo gera uma linha aqui, com um token único (UUID) e um
-- hash de integridade do conteúdo da inspeção no momento da emissão.
--
-- Por que uma tabela própria em vez de colunas soltas em `inspecoes`?
-- Porque uma mesma inspeção pode ser reemitida (ex: se os dados dela forem
-- corrigidos depois), e cada emissão precisa do seu próprio token/hash —
-- a emissão antiga é marcada como "revogado" em vez de apagada, mantendo
-- o histórico de auditoria.

-- Técnico responsável pela inspeção, exibido na página pública de
-- verificação do selo. Nulo em inspeções antigas, registradas antes desta
-- coluna existir.
ALTER TABLE inspecoes ADD COLUMN IF NOT EXISTS responsavel_tecnico TEXT;

CREATE TABLE IF NOT EXISTS laudos_autenticacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspecao_id UUID NOT NULL REFERENCES inspecoes(id) ON DELETE CASCADE,
    equipamento_id UUID NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
    token_validacao UUID NOT NULL DEFAULT gen_random_uuid(),
    hash_documento TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'valido' CHECK (status IN ('valido', 'revogado')),
    data_emissao TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Token é o que vai no QR Code: precisa ser único e rápido de buscar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_laudos_autenticacao_token
    ON laudos_autenticacao (token_validacao);

-- Para achar rapidamente todas as emissões de uma inspeção (histórico).
CREATE INDEX IF NOT EXISTS idx_laudos_autenticacao_inspecao
    ON laudos_autenticacao (inspecao_id);

ALTER TABLE laudos_autenticacao ENABLE ROW LEVEL SECURITY;

-- Mesma política usada nas outras tabelas do sistema: qualquer usuário
-- autenticado do FireControl OS tem acesso completo. A leitura pública
-- (para quem escaneia o QR sem estar logado) NÃO passa por aqui — ela usa
-- a service_role key só no servidor (ver lib/supabase/admin.ts), nunca
-- pelo cliente anônimo/RLS.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'laudos_autenticacao' AND policyname = 'authenticated_full_access'
    ) THEN
        CREATE POLICY "authenticated_full_access" ON laudos_autenticacao
            FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;
