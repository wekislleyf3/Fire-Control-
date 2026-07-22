-- FireControl OS — Migração: cadastro avançado de clientes + checklist dinâmico
-- Cole no SQL Editor do Supabase e rode (uma vez só).
--
-- O que essa migração faz:
-- 1. Clientes passam a ter tipo de pessoa (física/jurídica), CPF, endereço
--    completo (logradouro/número/complemento/bairro) e uma matrícula única
--    gerada automaticamente pelo banco (ex: FC-00001).
-- 2. Inspeções passam a guardar um checklist dinâmico (jsonb), que varia
--    conforme o tipo do equipamento, em vez de colunas fixas.

-- 1) Clientes -----------------------------------------------------------

alter table clientes
  add column if not exists tipo_pessoa text not null default 'juridica'
    check (tipo_pessoa in ('fisica', 'juridica')),
  add column if not exists cpf text,
  add column if not exists matricula text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text;

-- Sequência que alimenta a matrícula de cada cliente.
create sequence if not exists clientes_matricula_seq;

-- Gera a matrícula automaticamente no formato FC-00001, FC-00002, ...
create or replace function set_cliente_matricula()
returns trigger as $$
begin
  if new.matricula is null or new.matricula = '' then
    new.matricula := 'FC-' || lpad(nextval('clientes_matricula_seq')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_cliente_matricula on clientes;
create trigger trg_set_cliente_matricula
  before insert on clientes
  for each row execute function set_cliente_matricula();

-- Backfill: gera matrícula para clientes já cadastrados antes desta migração,
-- respeitando a ordem de cadastro (o mais antigo recebe o menor número).
do $$
declare
  r record;
begin
  for r in select id from clientes where matricula is null order by created_at asc loop
    update clientes
      set matricula = 'FC-' || lpad(nextval('clientes_matricula_seq')::text, 5, '0')
      where id = r.id;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clientes_matricula_key'
  ) then
    alter table clientes add constraint clientes_matricula_key unique (matricula);
  end if;
end $$;

-- 2) Inspeções: checklist dinâmico --------------------------------------

alter table inspecoes
  add column if not exists tipo_equipamento_snapshot text,
  add column if not exists itens_checklist jsonb,
  add column if not exists resultado text check (resultado in ('conforme', 'nao_conforme'));

-- Migra o checklist fixo antigo (se existir) para o novo formato jsonb,
-- só para as inspeções que ainda não têm itens_checklist preenchido.
update inspecoes
set
  itens_checklist = jsonb_build_object(
    'funcionando', coalesce(funcionando, true),
    'lacre_integro', coalesce(lacre_integro, true),
    'manometro_correto', coalesce(manometro_correto, true),
    'acesso_livre', coalesce(acesso_livre, true),
    'sinalizacao_correta', coalesce(sinalizacao_correta, true),
    'corrosao', coalesce(corrosao, false),
    'necessita_manutencao', coalesce(necessita_manutencao, false)
  ),
  resultado = case
    when necessita_manutencao or corrosao or funcionando = false then 'nao_conforme'
    else 'conforme'
  end
where itens_checklist is null;

-- Nota: as colunas antigas (funcionando, lacre_integro, etc.) são mantidas
-- na tabela por compatibilidade com dados históricos, mas o app passa a
-- ler/gravar apenas em itens_checklist + resultado a partir de agora.
