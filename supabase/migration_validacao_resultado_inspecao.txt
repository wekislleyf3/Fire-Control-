-- FireControl OS — Validação do resultado da inspeção no banco de dados
--
-- Contexto: até aqui, o resultado ("conforme"/"nao_conforme") de uma
-- inspeção era calculado no navegador (lib/checklists.ts) e simplesmente
-- gravado como veio. lib/services/inspecoesService.ts já foi corrigido
-- para recalcular esse valor antes de gravar (não confia mais no que a
-- página manda) — mas esse recálculo ainda roda no navegador, então uma
-- escrita feita direto na API do Supabase (fora do app, com um usuário
-- autenticado) ainda poderia gravar um resultado que não bate com o
-- checklist respondido. Esta migration fecha essa brecha no próprio banco:
-- não importa por onde a escrita chegue, o resultado gravado é sempre
-- recalculado a partir de itens_checklist.
--
-- IMPORTANTE — MANUTENÇÃO: os dados abaixo espelham lib/checklists.ts.
-- Se um item crítico for adicionado/removido, ou um novo tipo de
-- equipamento ganhar checklist próprio, esta tabela precisa ser
-- atualizada numa migration nova — não há sincronização automática entre
-- o TypeScript e o Postgres.

create table if not exists checklist_itens_criticos (
  tipo_equipamento text not null,
  item_key text not null,
  critico boolean not null default false,
  -- "inverso": item onde TRUE reprova a inspeção (ex.: "necessita
  -- manutenção?"), ao contrário do padrão onde é FALSE que reprova.
  inverso boolean not null default false,
  primary key (tipo_equipamento, item_key)
);

comment on table checklist_itens_criticos is
  'Espelho de lib/checklists.ts — usado só pela função fn_calcular_resultado_inspecao para validar/recalcular o resultado da inspeção no banco. Atualizar junto com o TypeScript.';

-- RLS: qualquer autenticado pode LER (é a mesma informação que já vai
-- pro navegador dentro do bundle da aplicação), mas ninguém escreve por
-- fora — só uma migration nova (rodada no SQL Editor) pode alterar esta
-- tabela. Sem isso, um usuário autenticado poderia editar os próprios
-- critérios e forjar o resultado de uma inspeção.
alter table checklist_itens_criticos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'checklist_itens_criticos' and policyname = 'checklist_itens_criticos_select'
  ) then
    create policy "checklist_itens_criticos_select" on checklist_itens_criticos
      for select using (auth.role() = 'authenticated');
  end if;
end $$;

-- Repopula do zero a cada rodada desta migration, pra nunca ficar com
-- linha órfã de um checklist antigo.
truncate table checklist_itens_criticos;

insert into checklist_itens_criticos (tipo_equipamento, item_key, critico, inverso) values
('__padrao__','funcionando',true,false),
('__padrao__','acesso_livre',true,false),
('__padrao__','sinalizacao_correta',false,false),
('__padrao__','identificacao_legivel',false,false),
('__padrao__','sem_corrosao',false,false),
('__padrao__','necessita_manutencao',true,true),
('Extintor','lacre_integro',true,false),
('Extintor','manometro_correto',true,false),
('Extintor','mangueira_bico_ok',false,false),
('Extintor','sem_corrosao_amassado',true,false),
('Extintor','sinalizacao_correta',false,false),
('Extintor','acesso_livre',true,false),
('Extintor','suporte_altura_correta',false,false),
('Extintor','prazo_validade_ok',true,false),
('Extintor','necessita_manutencao',true,true),
('Mangueira','estado_conservacao',true,false),
('Mangueira','esguicho_ok',false,false),
('Mangueira','acoplamentos_ok',true,false),
('Mangueira','abrigo_ok',false,false),
('Mangueira','acesso_livre',true,false),
('Mangueira','sinalizacao_correta',false,false),
('Mangueira','teste_hidrostatico_ok',true,false),
('Mangueira','necessita_manutencao',true,true),
('Hidrante','registro_ok',true,false),
('Hidrante','mangueira_acoplada_ok',true,false),
('Hidrante','pressao_ok',true,false),
('Hidrante','vazamentos',true,false),
('Hidrante','abrigo_ok',false,false),
('Hidrante','acesso_livre',true,false),
('Hidrante','necessita_manutencao',true,true),
('Mangotinho','estado_conservacao',true,false),
('Mangotinho','esguicho_ok',false,false),
('Mangotinho','registro_ok',true,false),
('Mangotinho','abrigo_ok',false,false),
('Mangotinho','acesso_livre',true,false),
('Mangotinho','necessita_manutencao',true,true),
('Porta corta-fogo','fechamento_automatico',true,false),
('Porta corta-fogo','veda_corretamente',true,false),
('Porta corta-fogo','barra_antipanico_ok',false,false),
('Porta corta-fogo','sem_travas_impedimento',true,false),
('Porta corta-fogo','sinalizacao_correta',false,false),
('Porta corta-fogo','acesso_livre',false,false),
('Porta corta-fogo','necessita_manutencao',true,true),
('Iluminação de emergência','acende_na_falta_luz',true,false),
('Iluminação de emergência','bateria_ok',true,false),
('Iluminação de emergência','led_lampada_ok',false,false),
('Iluminação de emergência','fixacao_ok',false,false),
('Iluminação de emergência','sem_danos_fisicos',false,false),
('Iluminação de emergência','necessita_manutencao',true,true),
('Placa','visivel_bem_posicionada',true,false),
('Placa','fotoluminescente_ok',false,false),
('Placa','legivel_sem_danos',false,false),
('Placa','fixacao_ok',false,false),
('Placa','necessita_manutencao',true,true),
('Alarme','central_ok',true,false),
('Alarme','acionadores_ok',true,false),
('Alarme','sirenes_ok',true,false),
('Alarme','bateria_backup_ok',false,false),
('Alarme','acesso_livre',false,false),
('Alarme','necessita_manutencao',true,true),
('Detector','led_indicador_ok',true,false),
('Detector','sem_sujeira_obstrucao',true,false),
('Detector','fixacao_ok',false,false),
('Detector','teste_funcional_ok',true,false),
('Detector','necessita_manutencao',true,true),
('Sprinkler','bulbo_ampola_ok',true,false),
('Sprinkler','sem_pintura_obstrucao',true,false),
('Sprinkler','pressao_rede_ok',true,false),
('Sprinkler','area_cobertura_livre',false,false),
('Sprinkler','necessita_manutencao',true,true),
('Bomba','liga_automatico',true,false),
('Bomba','sem_vazamentos',true,false),
('Bomba','pressao_manometros_ok',true,false),
('Bomba','nivel_combustivel_oleo',false,false),
('Bomba','painel_comando_ok',true,false),
('Bomba','necessita_manutencao',true,true),
('Central de incêndio','sem_avarias_sinalizadas',true,false),
('Central de incêndio','bateria_backup_ok',true,false),
('Central de incêndio','zonas_monitoradas_ok',true,false),
('Central de incêndio','log_eventos_ok',false,false),
('Central de incêndio','necessita_manutencao',true,true);

-- Calcula "conforme"/"nao_conforme" a partir das respostas do checklist,
-- usando o checklist do tipo de equipamento informado (ou o padrão
-- "__padrao__", se o tipo não tiver linhas cadastradas — mesma regra de
-- getChecklistParaTipo() no TypeScript).
create or replace function fn_calcular_resultado_inspecao(p_tipo text, p_itens jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo_lookup text;
  v_item record;
  v_valor boolean;
  v_reprovado boolean := false;
begin
  if exists (select 1 from checklist_itens_criticos where tipo_equipamento = p_tipo) then
    v_tipo_lookup := p_tipo;
  else
    v_tipo_lookup := '__padrao__';
  end if;

  for v_item in
    select item_key, critico, inverso
    from checklist_itens_criticos
    where tipo_equipamento = v_tipo_lookup
  loop
    -- item ausente nas respostas vira NULL aqui, e "NULL is true"/"NULL is
    -- false" são ambos FALSE — mesmo comportamento do `undefined` no
    -- TypeScript (nunca reprova por item não respondido).
    v_valor := (coalesce(p_itens, '{}'::jsonb) ->> v_item.item_key)::boolean;

    if v_item.inverso then
      if v_valor is true then
        v_reprovado := true;
      end if;
    else
      if v_item.critico and v_valor is false then
        v_reprovado := true;
      end if;
    end if;
  end loop;

  return case when v_reprovado then 'nao_conforme' else 'conforme' end;
end;
$$;

-- Sobrescreve SEMPRE o resultado enviado, em qualquer INSERT ou UPDATE —
-- não há como uma escrita (pelo app ou direto pela API) gravar um
-- resultado que não corresponda às respostas do checklist.
create or replace function trg_inspecoes_calcular_resultado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.resultado := fn_calcular_resultado_inspecao(new.tipo_equipamento_snapshot, new.itens_checklist);
  return new;
end;
$$;

drop trigger if exists trg_before_insert_update_inspecoes on inspecoes;
create trigger trg_before_insert_update_inspecoes
  before insert or update on inspecoes
  for each row execute function trg_inspecoes_calcular_resultado();

-- Backfill — inspeções antigas (migradas em migration_cadastro_avancado.sql,
-- antes de existir checklist dinâmico) ficaram com tipo_equipamento_snapshot
-- NULL. Sem isso, o trigger acima cairia no fallback "__padrao__" na
-- primeira edição dessas linhas — que não conhece itens críticos como
-- lacre_integro/manometro_correto — e poderia reclassificar silenciosamente
-- uma inspeção "nao_conforme" antiga como "conforme".
--
-- Roda DEPOIS do trigger ser criado de propósito: ao preencher
-- tipo_equipamento_snapshot, o UPDATE dispara o trigger e recalcula
-- resultado corretamente com o checklist certo do tipo — corrige as duas
-- coisas de uma vez.
update inspecoes
set tipo_equipamento_snapshot = equipamentos.tipo
from equipamentos
where inspecoes.equipamento_id = equipamentos.id
  and inspecoes.tipo_equipamento_snapshot is null;
