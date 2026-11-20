-- Frío Austral: textos visibles del sitio editables desde el panel del equipo (equipo.html).
-- Migración ADITIVA y NUEVA. No está aplicada: la corre Mathias con permiso, en el proyecto kgxwjywupnnvceyziymj.
-- No borra ni modifica tablas, políticas ni datos existentes.
-- Mismo criterio que site_media: el HTML original es el valor por defecto (si no hay fila, el sitio no cambia).
-- Lectura pública: solo filas publicadas. Escritura directa: solo quien está en public.admins
-- (la misma tabla que usa /api al comprobar isAdmin). /api/admin igual escribe con la service role
-- después de esa comprobación.

create or replace function public.fa_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admins a
    where a.user_id = (select auth.uid())
  );
$$;

revoke all on function public.fa_is_admin() from public, anon;
grant execute on function public.fa_is_admin() to authenticated;

create table if not exists public.site_texts (
  id text primary key check (id ~ '^[a-z][a-z0-9]{0,24}\.[a-z][a-z0-9]{0,24}\.[0-9]{1,4}$'),
  body text not null check (char_length(body) between 1 and 2000),
  previous text check (previous is null or char_length(previous) between 1 and 2000),
  published boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_texts enable row level security;

drop policy if exists "site_texts_select_publicado" on public.site_texts;
create policy "site_texts_select_publicado" on public.site_texts
  for select to anon, authenticated
  using (published);

drop policy if exists "site_texts_insert_admin" on public.site_texts;
create policy "site_texts_insert_admin" on public.site_texts
  for insert to authenticated
  with check (public.fa_is_admin());

drop policy if exists "site_texts_update_admin" on public.site_texts;
create policy "site_texts_update_admin" on public.site_texts
  for update to authenticated
  using (public.fa_is_admin())
  with check (public.fa_is_admin());

drop policy if exists "site_texts_delete_admin" on public.site_texts;
create policy "site_texts_delete_admin" on public.site_texts
  for delete to authenticated
  using (public.fa_is_admin());

revoke all on public.site_texts from anon, authenticated;
grant select on public.site_texts to anon, authenticated;
grant insert, update, delete on public.site_texts to authenticated;
grant select, insert, update, delete on public.site_texts to service_role;

revoke truncate, references, trigger on public.site_texts from anon, authenticated;
