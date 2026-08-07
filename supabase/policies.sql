-- FireControl OS — Políticas de acesso (rodar DEPOIS de criar o usuário de login)
-- Reativa o RLS e libera acesso total apenas para quem estiver autenticado.
-- Cole no SQL Editor do Supabase.

alter table clientes enable row level security;
alter table unidades enable row level security;
alter table equipamentos enable row level security;
alter table equipamento_historico enable row level security;
alter table documentos enable row level security;
alter table inspecoes enable row level security;
alter table contratos enable row level security;
alter table alertas enable row level security;

create policy "authenticated_full_access" on clientes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_full_access" on unidades
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_full_access" on equipamentos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_full_access" on equipamento_historico
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_full_access" on documentos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_full_access" on inspecoes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_full_access" on contratos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_full_access" on alertas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
