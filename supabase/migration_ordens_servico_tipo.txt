-- Incremental: adiciona o campo "tipo" em ordens_servico, para diferenciar
-- a OS de vistoria periódica (que lista equipamentos já cadastrados) da OS
-- de levantamento/cadastro (visita inicial num cliente que ainda não tem
-- equipamentos no sistema — não exige selecionar equipamento nenhum).
-- Só precisa rodar se você já aplicou migration_ordens_servico.sql antes
-- dessa coluna existir; se estiver rodando do zero, ignore este arquivo.

ALTER TABLE ordens_servico
    ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'vistoria';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ordens_servico_tipo_check'
    ) THEN
        ALTER TABLE ordens_servico
            ADD CONSTRAINT ordens_servico_tipo_check CHECK (tipo IN ('vistoria', 'levantamento'));
    END IF;
END $$;
