-- Módulo de Agenda: eventos agendados (visitas, inspeções, manutenções,
-- retornos, vistorias, reuniões). Aditivo — não mexe em nenhuma tabela
-- existente.

CREATE TABLE IF NOT EXISTS agenda_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    equipamento_id UUID REFERENCES equipamentos(id) ON DELETE SET NULL,
    tipo TEXT NOT NULL DEFAULT 'visita'
        CHECK (tipo IN ('visita', 'inspecao', 'manutencao', 'retorno', 'vistoria', 'reuniao', 'outro')),
    titulo TEXT NOT NULL,
    data DATE NOT NULL,
    horario TIME,
    responsavel TEXT,
    prioridade TEXT NOT NULL DEFAULT 'normal'
        CHECK (prioridade IN ('baixa', 'normal', 'alta')),
    status TEXT NOT NULL DEFAULT 'agendado'
        CHECK (status IN ('agendado', 'concluido', 'cancelado')),
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_eventos_data ON agenda_eventos (data);
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_cliente ON agenda_eventos (cliente_id);

ALTER TABLE agenda_eventos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'agenda_eventos' AND policyname = 'authenticated_full_access'
    ) THEN
        CREATE POLICY "authenticated_full_access" ON agenda_eventos
            FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;
