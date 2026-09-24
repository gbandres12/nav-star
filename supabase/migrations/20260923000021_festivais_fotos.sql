-- Fotos dos festivais: enviadas pelo painel (ADMIN/GERENTE) e mostradas no site.
-- Re-executável. Arquivos no bucket público "festivais", no caminho <festival_id>/<arquivo>.
-- A primeira foto (menor "ordem") é a capa do card e da página do festival.

create table if not exists public.festival_fotos (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivais on delete cascade,
  caminho text not null unique,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_festival_fotos_festival on public.festival_fotos (festival_id, ordem);
alter table public.festival_fotos enable row level security;

-- Site: só fotos de festivais publicados e ainda não encerrados (mesma regra de public.festivais)
drop policy if exists "ffoto_anon" on public.festival_fotos;
create policy "ffoto_anon" on public.festival_fotos for select to anon using (
  exists (select 1 from public.festivais f where f.id = festival_id and f.publicado = true and f.fim >= current_date)
);
drop policy if exists "ffoto_auth" on public.festival_fotos;
create policy "ffoto_auth" on public.festival_fotos for select to authenticated using (
  exists (select 1 from public.festivais f where f.id = festival_id and f.empresa_id = (select private.empresa_atual()))
);
drop policy if exists "ffoto_insert" on public.festival_fotos;
create policy "ffoto_insert" on public.festival_fotos for insert to authenticated with check (
  (select private.tem_papel('ADMIN'::public.papel_usuario, 'GERENTE'::public.papel_usuario))
  and exists (select 1 from public.festivais f where f.id = festival_id and f.empresa_id = (select private.empresa_atual()))
);
drop policy if exists "ffoto_update" on public.festival_fotos;
create policy "ffoto_update" on public.festival_fotos for update to authenticated using (
  (select private.tem_papel('ADMIN'::public.papel_usuario, 'GERENTE'::public.papel_usuario))
  and exists (select 1 from public.festivais f where f.id = festival_id and f.empresa_id = (select private.empresa_atual()))
);
drop policy if exists "ffoto_delete" on public.festival_fotos;
create policy "ffoto_delete" on public.festival_fotos for delete to authenticated using (
  (select private.tem_papel('ADMIN'::public.papel_usuario, 'GERENTE'::public.papel_usuario))
  and exists (select 1 from public.festivais f where f.id = festival_id and f.empresa_id = (select private.empresa_atual()))
);

-- Bucket público (leitura por URL), até 5 MB por arquivo, só imagens
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('festivais', 'festivais', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Envio e remoção: ADMIN/GERENTE, só dentro da pasta de um festival da própria empresa
drop policy if exists "festivais_fotos_insert" on storage.objects;
create policy "festivais_fotos_insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'festivais'
  and (select private.tem_papel('ADMIN'::public.papel_usuario, 'GERENTE'::public.papel_usuario))
  and exists (
    select 1 from public.festivais f
    where f.id::text = (storage.foldername(name))[1] and f.empresa_id = (select private.empresa_atual())
  )
);
drop policy if exists "festivais_fotos_delete" on storage.objects;
create policy "festivais_fotos_delete" on storage.objects for delete to authenticated using (
  bucket_id = 'festivais'
  and (select private.tem_papel('ADMIN'::public.papel_usuario, 'GERENTE'::public.papel_usuario))
  and exists (
    select 1 from public.festivais f
    where f.id::text = (storage.foldername(name))[1] and f.empresa_id = (select private.empresa_atual())
  )
);
