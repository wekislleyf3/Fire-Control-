-- FireControl OS — Correção: exclusão de equipamento/cliente falhava quando
-- já existia histórico de inspeções.
--
-- Por quê: a tabela "inspecoes" referencia clientes/unidades/equipamentos SEM
-- "on delete cascade". O Postgres bloqueia (foreign key violation) qualquer
-- tentativa de excluir um equipamento ou cliente que já tenha inspeções
-- registradas — mesmo que a tela de Equipamentos pergunte "Excluir + histórico?".
-- Isso também quebrava a exclusão em cascata de um cliente (cliente -> exclui
-- equipamentos -> bloqueado pelas inspeções desses equipamentos).
--
-- Cole no SQL Editor do Supabase e rode (uma vez só).

alter table inspecoes drop constraint if exists inspecoes_cliente_id_fkey;
alter table inspecoes drop constraint if exists inspecoes_unidade_id_fkey;
alter table inspecoes drop constraint if exists inspecoes_equipamento_id_fkey;

alter table inspecoes
  add constraint inspecoes_cliente_id_fkey
  foreign key (cliente_id) references clientes(id) on delete cascade;

alter table inspecoes
  add constraint inspecoes_unidade_id_fkey
  foreign key (unidade_id) references unidades(id) on delete cascade;

alter table inspecoes
  add constraint inspecoes_equipamento_id_fkey
  foreign key (equipamento_id) references equipamentos(id) on delete cascade;
