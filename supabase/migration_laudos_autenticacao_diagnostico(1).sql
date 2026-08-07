-- Generaliza laudos_autenticacao pra autenticar também o PDF de
-- diagnóstico do cliente (não só inspeções). Aditivo: não altera nem
-- apaga nenhuma linha já existente.

ALTER TABLE laudos_autenticacao ALTER COLUMN inspecao_id DROP NOT NULL;
ALTER TABLE laudos_autenticacao ALTER COLUMN equipamento_id DROP NOT NULL;

ALTER TABLE laudos_autenticacao
    ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE;

ALTER TABLE laudos_autenticacao
    ADD COLUMN IF NOT EXISTS tipo_documento TEXT NOT NULL DEFAULT 'inspecao';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'laudos_autenticacao_tipo_documento_check'
    ) THEN
        ALTER TABLE laudos_autenticacao
            ADD CONSTRAINT laudos_autenticacao_tipo_documento_check
            CHECK (tipo_documento IN ('inspecao', 'diagnostico'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_laudos_autenticacao_cliente
    ON laudos_autenticacao (cliente_id);
