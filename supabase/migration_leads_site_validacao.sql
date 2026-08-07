-- Reforço na tabela `leads_site` (ver migration_leads_site.sql).
--
-- O formulário público (firecontrolgestao.site/agendamento.html) não fala
-- direto com o Supabase: ele posta pro Google Apps Script, e é o Apps
-- Script quem grava aqui usando a anon key. Isso significa que qualquer
-- validação feita só em JavaScript no navegador (ex: honeypot, tempo
-- mínimo de preenchimento) protege contra bot que roda a página, mas não
-- contra alguém que descobre a URL do Apps Script (ela aparece no
-- código-fonte da página) e manda requisições direto pra ela.
--
-- Como não dá pra colocar trava de frequência (rate limit) numa CHECK
-- constraint — não existe "IP de quem chamou" disponível aqui —, o que
-- este migration faz é garantir que, mesmo se alguém spammar a tabela
-- direto, cada linha pelo menos tem a forma de um lead de verdade: campos
-- obrigatórios não vazios e um teto de tamanho (evita alguém mandar um
-- texto de megabytes num campo só, por exemplo).
--
-- Rate limit de verdade (quantidade de envios por período) só dá pra
-- fazer no código do Apps Script — fora do alcance deste repositório.

ALTER TABLE leads_site
    DROP CONSTRAINT IF EXISTS leads_site_nome_valido,
    DROP CONSTRAINT IF EXISTS leads_site_whatsapp_valido,
    DROP CONSTRAINT IF EXISTS leads_site_estabelecimento_tamanho,
    DROP CONSTRAINT IF EXISTS leads_site_bairro_tamanho,
    DROP CONSTRAINT IF EXISTS leads_site_turno_tamanho,
    DROP CONSTRAINT IF EXISTS leads_site_interesse_tamanho;

ALTER TABLE leads_site
    -- nome: não vazio (nem só espaço) e até 200 caracteres.
    ADD CONSTRAINT leads_site_nome_valido
        CHECK (length(btrim(nome)) BETWEEN 1 AND 200),
    -- whatsapp: não vazio e precisa ter pelo menos 8 dígitos numéricos
    -- em algum lugar da string (aceita formatação livre: "(27) 90000-0000",
    -- "+55 27 90000-0000" etc.), até 30 caracteres no total.
    ADD CONSTRAINT leads_site_whatsapp_valido
        CHECK (
            length(whatsapp) BETWEEN 1 AND 30
            AND length(regexp_replace(whatsapp, '\D', '', 'g')) >= 8
        ),
    ADD CONSTRAINT leads_site_estabelecimento_tamanho
        CHECK (estabelecimento IS NULL OR length(estabelecimento) <= 200),
    ADD CONSTRAINT leads_site_bairro_tamanho
        CHECK (bairro IS NULL OR length(bairro) <= 200),
    ADD CONSTRAINT leads_site_turno_tamanho
        CHECK (turno_preferido IS NULL OR length(turno_preferido) <= 50),
    ADD CONSTRAINT leads_site_interesse_tamanho
        CHECK (interesse IS NULL OR length(interesse) <= 200);
