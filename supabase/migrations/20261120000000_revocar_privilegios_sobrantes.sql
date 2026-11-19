-- PROPUESTA DE LA AUDITORÍA (nov-2026). NO APLICADA: requiere el OK de Mathias antes de correrla en producción.
-- Los roles públicos (anon = visitante, authenticated = cualquier cuenta) aún tienen TRUNCATE, REFERENCES y TRIGGER
-- en varias tablas (privilegios por defecto de Supabase que las migraciones anteriores no quitaron).
-- TRUNCATE no pasa por RLS. Hoy no se puede usar desde la API pública (PostgREST no expone TRUNCATE),
-- pero es una defensa en profundidad: nada del sitio los necesita (el servidor usa service_role).
-- No toca datos ni políticas; solo quita permisos que nadie usa.

revoke truncate, references, trigger on
  public.plan_materials, public.site_media, public.admins, public.subscribers, public.messages,
  public.payments, public.videocalls, public.plan_access, public.hotmart_events, public.free_resources
from anon, authenticated;
