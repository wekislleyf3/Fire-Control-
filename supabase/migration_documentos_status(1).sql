-- Permite renovar um documento (novo arquivo + nova validade) sem perder
-- o histórico do anterior — em vez de apagar, o documento antigo vira
-- "substituido" e continua aparecendo na Timeline do cliente.

ALTER TABLE documentos ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'vigente';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'documentos_status_check'
    ) THEN
        ALTER TABLE documentos ADD CONSTRAINT documentos_status_check
            CHECK (status IN ('vigente', 'substituido'));
    END IF;
END $$;

-- Aponta pro documento que renovou este (se houver), pra manter o rastro.
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS substituido_por UUID REFERENCES documentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documentos_status ON documentos (status);
