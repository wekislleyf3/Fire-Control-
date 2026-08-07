-- Módulo de Ordens de Serviço (OS): documento gerado para uma visita
-- técnica (periódica ou avulsa), listando os equipamentos a vistoriar em
-- cada localização e coletando a assinatura do cliente no local — serve
-- como comprovante de que a inspeção/manutenção periódica foi realizada.
-- Aditivo — não mexe em nenhuma tabela existente.

CREATE TABLE IF NOT EXISTS ordens_servico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero INTEGER GENERATED ALWAYS AS IDENTITY,
    tipo TEXT NOT NULL DEFAULT 'vistoria'
        CHECK (tipo IN ('vistoria', 'levantamento')),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    evento_agenda_id UUID REFERENCES agenda_eventos(id) ON DELETE SET NULL,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    responsavel_tecnico TEXT,
    status TEXT NOT NULL DEFAULT 'aberta'
        CHECK (status IN ('aberta', 'concluida', 'cancelada')),
    observacoes TEXT,
    assinatura_cliente_url TEXT,
    assinatura_nome TEXT,
    assinatura_data TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Um item por equipamento incluído na OS. Os campos "_snapshot" guardam
-- código/tipo/localização no momento da geração — a localização de um
-- equipamento pode mudar depois, mas a OS deve continuar mostrando onde
-- ele estava quando a visita foi registrada.
CREATE TABLE IF NOT EXISTS ordens_servico_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ordem_servico_id UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
    equipamento_id UUID REFERENCES equipamentos(id) ON DELETE SET NULL,
    codigo_interno_snapshot TEXT,
    tipo_equipamento_snapshot TEXT,
    localizacao_snapshot TEXT,
    verificado BOOLEAN NOT NULL DEFAULT false,
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ordens_servico_cliente ON ordens_servico (cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_evento ON ordens_servico (evento_agenda_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_itens_os ON ordens_servico_itens (ordem_servico_id);

ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_servico_itens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'ordens_servico' AND policyname = 'authenticated_full_access'
    ) THEN
        CREATE POLICY "authenticated_full_access" ON ordens_servico
            FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'ordens_servico_itens' AND policyname = 'authenticated_full_access'
    ) THEN
        CREATE POLICY "authenticated_full_access" ON ordens_servico_itens
            FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;
