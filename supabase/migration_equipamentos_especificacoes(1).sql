-- Adiciona a coluna "especificacoes" (JSONB) na tabela equipamentos, sem
-- alterar nenhuma coluna existente e sem perder dados já cadastrados.
-- Uso: guardar campos técnicos específicos de cada tipo de equipamento
-- (ex: pressão do extintor, diâmetro da mangueira, vazão do hidrante...)
-- que hoje não têm coluna própria.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'equipamentos'
        AND column_name = 'especificacoes'
    ) THEN
        ALTER TABLE equipamentos ADD COLUMN especificacoes JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Índice GIN para permitir buscas/filtros performáticos dentro do JSONB,
-- caso no futuro seja necessário filtrar equipamentos por alguma
-- especificação técnica (ex: todos com "classe_incendio" = "ABC").
CREATE INDEX IF NOT EXISTS idx_equipamentos_especificacoes
    ON equipamentos USING gin (especificacoes);
