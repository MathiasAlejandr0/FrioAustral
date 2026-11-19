-- Frío Austral: "Recursos gratis" administrables desde el panel del equipo (contenido.html).
-- Migración ADITIVA: solo crea objetos nuevos (1 tabla, 1 bucket público y sus políticas). No toca datos ni objetos existentes.
-- Escrituras: solo desde las funciones de /api con la service role (el equipo sube, el servidor valida), igual que
-- plan_materials y site_media. Lectura pública: únicamente los recursos publicados y los archivos del bucket público.

-- ---------------------------------------------------------------------------
-- 1) Tabla free_resources
--    kind = 'archivo'        -> file_path obligatorio (PDF u otro documento para descargar)
--    kind = 'video_externo'  -> video_url obligatorio (YouTube u otro link https). La foto es opcional solo si es YouTube
--                               (el sitio usa la miniatura de YouTube); en el resto la foto es obligatoria.
--    kind = 'video_corto'    -> file_path obligatorio (mp4/webm, máx. 50 MB)
--    La foto de referencia (cover_path) es obligatoria en 'archivo' y 'video_corto'.
-- ---------------------------------------------------------------------------
create table if not exists public.free_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1000),
  kind text not null check (kind in ('archivo', 'video_externo', 'video_corto')),
  cover_path text check (cover_path is null or char_length(cover_path) between 3 and 200),
  file_path text check (file_path is null or char_length(file_path) between 3 and 200),
  file_name text check (file_name is null or char_length(file_name) <= 120),
  content_type text,
  size_bytes bigint check (size_bytes is null or (size_bytes >= 0 and size_bytes <= 52428800)),
  video_url text check (video_url is null or (video_url ~ '^https://' and char_length(video_url) <= 500)),
  published boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint free_resources_archivo_ck check (kind <> 'archivo' or (file_path is not null and cover_path is not null and video_url is null)),
  constraint free_resources_video_externo_ck check (kind <> 'video_externo' or (video_url is not null and file_path is null)),
  constraint free_resources_video_corto_ck check (kind <> 'video_corto' or (file_path is not null and cover_path is not null and video_url is null))
);
create index if not exists free_resources_created_idx on public.free_resources (created_at desc);

alter table public.free_resources enable row level security;

drop policy if exists "free_resources_select_publicados" on public.free_resources;
create policy "free_resources_select_publicados" on public.free_resources
  for select to anon, authenticated using (published);
-- Sin políticas de insert/update/delete: solo la service role (las funciones de /api) puede escribir.

-- ---------------------------------------------------------------------------
-- 2) Bucket público free-resources (tope de Supabase Free: 50 MB por archivo)
--    Documentos, imágenes de referencia y videos cortos mp4/webm.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'free-resources', 'free-resources', true, 52428800,
  array[
    'application/pdf', 'application/epub+zip', 'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm'
  ]
)
on conflict (id) do nothing;
-- Sin políticas sobre storage.objects: los archivos se sirven por su URL pública (bucket público) y solo la service role escribe.

-- ---------------------------------------------------------------------------
-- 3) Permisos de tabla (este proyecto no los da por defecto; mismo criterio que site_media).
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.free_resources to service_role;
grant select on public.free_resources to anon, authenticated;
