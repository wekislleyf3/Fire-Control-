-- FireControl OS — Multiempresa & Permissões (passo 1/2)
-- Cria as tabelas base de empresa e perfil de usuário. Ainda NÃO adiciona
-- empresa_id nas tabelas existentes (clientes, equipamentos, etc.) — isso
-- fica para uma migration separada depois que o time decidir a estratégia
-- (empresa única por enquanto, ou já indo multi-tenant completo).

create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  empresa_id uuid references empresas(id) on delete set null,
  nome text,
  role text not null default 'tecnico' check (role in ('admin', 'supervisor', 'tecnico', 'cliente')),
  created_at timestamptz not null default now()
);

create index if not exists profiles_empresa_id_idx on profiles(empresa_id);

alter table empresas enable row level security;
alter table profiles enable row level security;

-- Usuário só enxerga/edita o próprio perfil.
create policy "profiles_self_select" on profiles
  for select using (auth.uid() = user_id);

create policy "profiles_self_update" on profiles
  for update using (auth.uid() = user_id);

-- Qualquer autenticado pode ver as empresas cadastradas (ajuste conforme a
-- regra de negócio real, ex.: só a própria empresa).
create policy "empresas_authenticated_select" on empresas
  for select using (auth.role() = 'authenticated');

-- Cria automaticamente um profile (role "tecnico") quando um usuário se
-- cadastra, para nunca ficar sem linha em profiles.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, nome)
  values (new.id, new.raw_user_meta_data->>'nome');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
