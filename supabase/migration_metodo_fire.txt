-- Método Fire: procedimentos operacionais padronizados por tipo de
-- equipamento, editáveis pelo app (em vez de fixos no código).
--
-- Aditivo por design: se não existir um procedimento customizado pra um
-- tipo, o sistema continua usando o checklist padrão já existente em
-- lib/checklists.ts — nada quebra pra quem não mexer em nada aqui.

CREATE TABLE IF NOT EXISTS procedimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_equipamento TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    descricao TEXT,
    objetivo TEXT,
    responsavel_padrao TEXT,
    normas_relacionadas TEXT,
    documentos_necessarios TEXT,
    frequencia TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS procedimento_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedimento_id UUID NOT NULL REFERENCES procedimentos(id) ON DELETE CASCADE,
    chave TEXT NOT NULL,
    pergunta TEXT NOT NULL,
    norma_referencia TEXT,
    critico BOOLEAN NOT NULL DEFAULT false,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procedimento_itens_procedimento ON procedimento_itens (procedimento_id, ordem);

ALTER TABLE procedimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedimento_itens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'procedimentos' AND policyname = 'authenticated_full_access'
    ) THEN
        CREATE POLICY "authenticated_full_access" ON procedimentos
            FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'procedimento_itens' AND policyname = 'authenticated_full_access'
    ) THEN
        CREATE POLICY "authenticated_full_access" ON procedimento_itens
            FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;
