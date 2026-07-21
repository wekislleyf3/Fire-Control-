-- FireControl OS — Schema Fase 1 (MVP interno)
-- Cole este script no SQL Editor do Supabase (Project > SQL Editor > New query)

create extension if not exists "uuid-ossp";

create table clientes (
  id uuid primary key default uuid_generate_v4(),
  razao_social text not null,
  nome_fantasia text,
  cnpj text,
  inscricao_estadual text,
  telefone text,
  whatsapp text,
  email text,
  responsavel text,
  cargo text,
  endereco text,
  cep text,
  cidade text,
  estado text,
  google_maps_url text,
  observacoes text,
  status text default 'ativo' check (status in ('ativo','inativo')),
  tipo_atividade text,
  qtd_funcionarios int,
  pavimentos int,
  area_construida numeric,
  risco_atividade text,
  proxima_visita date,
  ultima_visita date,
  created_at timestamptz default now()
);

create table unidades (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid references clientes(id) on delete cascade,
  nome text not null, -- Matriz, Filial 1, etc.
  endereco text,
  created_at timestamptz default now()
);

create table equipamentos (
  id uuid primary key default uuid_generate_v4(),
  codigo_interno text unique not null, -- ex FC-EXT-000001
  cliente_id uuid references clientes(id) on delete cascade,
  unidade_id uuid references unidades(id),
  numero_patrimonio text,
  tipo text not null, -- extintor, mangueira, hidrante, etc.
  classe text,
  capacidade text,
  fabricante text,
  modelo text,
  numero_serie text,
  ano_fabricacao int,
  data_instalacao date,
  localizacao text,
  setor text,
  pavimento text,
  foto_url text,
  qr_code_url text,
  observacoes text,
  status text default 'ok' check (status in ('ok','atencao','vencido')),
  ultima_inspecao date,
  proxima_inspecao date,
  ultima_manutencao date,
  proxima_manutencao date,
  ultima_recarga date,
  proxima_recarga date,
  ultimo_teste_hidrostatico date,
  proximo_teste_hidrostatico date,
  garantia_ate date,
  created_at timestamptz default now()
);

create table equipamento_historico (
  id uuid primary key default uuid_generate_v4(),
  equipamento_id uuid references equipamentos(id) on delete cascade,
  data date not null default current_date,
  evento text not null, -- "Inspeção realizada", "Troca do manômetro", etc.
  observacoes text,
  created_at timestamptz default now()
);

create table documentos (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid references clientes(id) on delete cascade,
  tipo text not null, -- AVCB, CLCB, ART, Projeto, Laudo, Contrato, Certificado, NF, OS
  nome_arquivo text not null,
  arquivo_url text not null,
  validade date,
  created_at timestamptz default now()
);

create table inspecoes (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid references clientes(id) on delete cascade,
  unidade_id uuid references unidades(id) on delete cascade,
  equipamento_id uuid references equipamentos(id) on delete cascade,
  funcionando boolean,
  lacre_integro boolean,
  manometro_correto boolean,
  corrosao boolean,
  acesso_livre boolean,
  sinalizacao_correta boolean,
  necessita_manutencao boolean,
  observacoes text,
  fotos jsonb, -- array de URLs
  assinatura_url text,
  created_at timestamptz default now()
);

create table contratos (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid references clientes(id) on delete cascade,
  valor_mensal numeric,
  data_vencimento date,
  situacao text default 'pendente' check (situacao in ('pago','pendente','atrasado')),
  created_at timestamptz default now()
);

create table alertas (
  id uuid primary key default uuid_generate_v4(),
  tipo text not null, -- equipamento_vencendo, avcb_vencendo, contrato_vencendo
  referencia_id uuid, -- id do equipamento/cliente/contrato relacionado
  mensagem text not null,
  dias_restantes int,
  resolvido boolean default false,
  created_at timestamptz default now()
);

-- Índices úteis para os alertas de vencimento (dashboard e cron de notificação)
create index idx_equip_prox_inspecao on equipamentos(proxima_inspecao);
create index idx_equip_prox_recarga on equipamentos(proxima_recarga);
create index idx_equip_prox_teste on equipamentos(proximo_teste_hidrostatico);
create index idx_equip_cliente on equipamentos(cliente_id);
create index idx_doc_cliente on documentos(cliente_id);
