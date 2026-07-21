-- FireControl OS — Migração: histórico do Índice FireControl (IFC)
-- Cole no SQL Editor do Supabase e rode (uma vez só).

create table ifc_historico (
  id uuid primary key default uuid_generate_v4(),
  mes_referencia date not null unique, -- sempre o dia 1 do mês, ex: 2026-07-01
  score numeric not null,
  pct_equipamentos_ok numeric,
  pct_documentos_ok numeric,
  pct_sem_nao_conformidade numeric,
  created_at timestamptz default now()
);

alter table ifc_historico enable row level security;

create policy "authenticated_full_access" on ifc_historico
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
