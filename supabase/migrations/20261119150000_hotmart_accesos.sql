-- Frío Austral: activación automática de planes por el webhook de Hotmart.
-- Migración ADITIVA (solo crea tablas nuevas; no toca ni borra nada existente, incluida la tabla payments).
-- Lectura y escritura SOLO desde /api con la service role: RLS activado y sin políticas para anon/authenticated.

-- Acceso por plan, por EMAIL (existe aunque la persona todavía no tenga cuenta en el sitio).
-- Se vincula al usuario cuando se registra o inicia sesión con ese correo (subscribers.email).
create table if not exists public.plan_access (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  plan text not null check (plan in ('basico', 'pro', 'premium')),
  status text not null default 'activa' check (status in ('activa', 'cancelada_fin_periodo', 'cancelada')),
  period_start timestamptz,
  period_end timestamptz,
  source text not null default 'hotmart' check (source in ('hotmart', 'manual')),
  buyer_name text,
  hotmart_transaction text,
  hotmart_subscriber_code text,
  hotmart_product_id text,
  hotmart_offer_code text,
  last_event text,
  last_event_id text,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email, plan)
);
create index if not exists plan_access_email_idx on public.plan_access (email);
create index if not exists plan_access_status_idx on public.plan_access (status);

-- Registro de eventos recibidos de Hotmart (idempotencia y auditoría). Guarda solo los campos necesarios, no el payload completo.
create table if not exists public.hotmart_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event text not null,
  event_created_at timestamptz,
  email text,
  plan text,
  product_id text,
  offer_code text,
  transaction text,
  outcome text not null check (outcome in ('applied', 'ignored', 'unmapped', 'stale', 'no_email')),
  detail text,
  received_at timestamptz not null default now()
);
create index if not exists hotmart_events_received_idx on public.hotmart_events (received_at desc);
create index if not exists hotmart_events_email_idx on public.hotmart_events (email);

alter table public.plan_access enable row level security;
alter table public.hotmart_events enable row level security;

grant select, insert, update, delete on public.plan_access to service_role;
grant select, insert, update, delete on public.hotmart_events to service_role;
