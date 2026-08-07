-- Pipeline operacional: cada cliente está em uma etapa do Método Fire.
-- Aditivo — não mexe em nenhuma coluna existente.

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS etapa_pipeline TEXT NOT NULL DEFAULT 'prospeccao';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'clientes_etapa_pipeline_check'
    ) THEN
        ALTER TABLE clientes ADD CONSTRAINT clientes_etapa_pipeline_check
            CHECK (etapa_pipeline IN (
                'prospeccao', 'cliente_ativo', 'cadastro', 'levantamento', 'inspecao',
                'diagnostico', 'orcamento', 'execucao', 'regularizacao', 'monitoramento'
            ));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clientes_etapa_pipeline ON clientes (etapa_pipeline);

-- Histórico de mudanças de etapa (alimenta a Timeline do cliente).
CREATE TABLE IF NOT EXISTS cliente_pipeline_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    etapa_anterior TEXT,
    etapa_nova TEXT NOT NULL,
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cliente_pipeline_historico_cliente ON cliente_pipeline_historico (cliente_id);

ALTER TABLE cliente_pipeline_historico ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'cliente_pipeline_historico' AND policyname = 'authenticated_full_access'
    ) THEN
        CREATE POLICY "authenticated_full_access" ON cliente_pipeline_historico
            FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;
