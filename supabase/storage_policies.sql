-- FireControl OS — Políticas do Storage
-- PRÉ-REQUISITO: antes de rodar isso, crie o bucket pelo painel do Supabase:
-- Storage > New bucket > nome: "firecontrol-files" > marque "Public bucket" > Save

-- Libera leitura pública (necessário pra exibir fotos/baixar documentos pelo link direto)
create policy "leitura_publica_firecontrol_files"
on storage.objects for select
using (bucket_id = 'firecontrol-files');

-- Libera upload apenas para usuários autenticados (logados no sistema)
create policy "upload_autenticado_firecontrol_files"
on storage.objects for insert
with check (bucket_id = 'firecontrol-files' and auth.role() = 'authenticated');

-- Libera exclusão apenas para usuários autenticados
create policy "exclusao_autenticada_firecontrol_files"
on storage.objects for delete
using (bucket_id = 'firecontrol-files' and auth.role() = 'authenticated');
