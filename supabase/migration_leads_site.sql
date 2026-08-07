-- Leads recebidos pelo formulário público de agendamento
-- (firecontrolgestao.site/agendamento.html). Tabela separada de
-- `clientes` de propósito: o formulário é público (qualquer pessoa na
-- internet pode enviar), então só pode ESCREVER aqui, nunca ler nem
-- tocar nas tabelas operacionais. A equipe revisa e converte manualmente
-- em cliente de verdade pela tela /leads do FireControl OS.

CREATE TABLE IF NOT EXISTS leads_site (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    estabelecimento TEXT,
    bairro TEXT,
    data_preferida DATE,
    turno_preferido TEXT,
    interesse TEXT,
    status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'convertido', 'descartado')),
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_site_status ON leads_site (status);

ALTER TABLE leads_site ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa (anônima) pode ENVIAR um lead — é o formulário público.
-- Não existe policy de SELECT/UPDATE/DELETE pra "anon", então mesmo tendo
-- a anon key, ninguém de fora consegue ler ou alterar os leads já enviados.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'leads_site' AND policyname = 'anon_pode_inserir'
    ) THEN
        CREATE POLICY "anon_pode_inserir" ON leads_site
            FOR INSERT TO anon WITH CHECK (true);
    END IF;
END $$;

-- Equipe logada no FireControl OS pode ver/gerenciar tudo.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'leads_site' AND policyname = 'authenticated_full_access'
    ) THEN
        CREATE POLICY "authenticated_full_access" ON leads_site
            FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;
