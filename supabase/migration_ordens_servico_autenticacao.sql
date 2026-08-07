-- Generaliza laudos_autenticacao (já usada por inspeção e diagnóstico)
-- pra também autenticar o PDF de Ordem de Serviço. Aditivo: não altera
-- nem apaga nenhuma linha já existente.

ALTER TABLE laudos_autenticacao
    ADD COLUMN IF NOT EXISTS ordem_servico_id UUID REFERENCES ordens_servico(id) ON DELETE CASCADE;

-- A CHECK constraint de tipo_documento precisa ser recriada pra aceitar o
-- novo valor — Postgres não tem "ALTER CONSTRAINT", só dropar e recriar.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'laudos_autenticacao_tipo_documento_check'
    ) THEN
        ALTER TABLE laudos_autenticacao DROP CONSTRAINT laudos_autenticacao_tipo_documento_check;
    END IF;

    ALTER TABLE laudos_autenticacao
        ADD CONSTRAINT laudos_autenticacao_tipo_documento_check
        CHECK (tipo_documento IN ('inspecao', 'diagnostico', 'ordem_servico'));
END $$;

CREATE INDEX IF NOT EXISTS idx_laudos_autenticacao_ordem_servico
    ON laudos_autenticacao (ordem_servico_id);
