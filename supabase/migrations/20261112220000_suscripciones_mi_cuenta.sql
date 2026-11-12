-- Frío Austral: suscripción mensual (Flow) + panel "Mi cuenta" + chat con el equipo.
-- Proyecto Supabase dedicado a Frío Austral. Migración aditiva: solo crea objetos nuevos.
-- Escrituras: solo desde las funciones de /api con la service role (que aplican cupos y reglas).
-- Lecturas directas desde el navegador: cada usuario ve solo lo suyo (RLS).

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.subscribers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nombre text not null default '',
  plan text check (plan in ('basico', 'pro', 'premium')),
  pending_plan text check (pending_plan in ('basico', 'pro', 'premium')),
  status text not null default 'sin_suscripcion' check (status in (
    'sin_suscripcion', 'pendiente_tarjeta', 'pendiente', 'pago_pendiente',
    'activa', 'morosa', 'cancelada_fin_periodo', 'cancelada'
  )),
  flow_customer_id text unique,
  flow_subscription_id text unique,
  flow_plan_id text,
  card_brand text,
  card_last4 text,
  period_start timestamptz,
  period_end timestamptz,
  next_charge_at timestamptz,
  cancel_at_period_end boolean not null default false,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscribers_email_idx on public.subscribers (lower(email));
create index if not exists subscribers_status_idx on public.subscribers (status);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.subscribers (user_id) on delete cascade,
  sender text not null check (sender in ('cliente', 'equipo')),
  body text not null check (char_length(body) between 1 and 4000),
  author_id uuid references auth.users (id) on delete set null,
  read_by_team boolean not null default false,
  read_by_client boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_user_created_idx on public.messages (user_id, created_at);
create index if not exists messages_unread_team_idx on public.messages (read_by_team) where sender = 'cliente' and read_by_team = false;

create table if not exists public.payments (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.subscribers (user_id) on delete cascade,
  flow_subscription_id text,
  flow_invoice_id bigint not null unique,
  amount integer not null default 0,
  status text not null check (status in ('pagado', 'impago', 'anulado')),
  subject text,
  period_start timestamptz,
  period_end timestamptz,
  due_date timestamptz,
  paid_at timestamptz,
  payment_link text,
  error text,
  created_at timestamptz
);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);

alter table public.admins enable row level security;
alter table public.subscribers enable row level security;
alter table public.messages enable row level security;
alter table public.payments enable row level security;

drop policy if exists "admins_select_self" on public.admins;
create policy "admins_select_self" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "subscribers_select_own" on public.subscribers;
create policy "subscribers_select_own" on public.subscribers
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own" on public.messages
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select to authenticated using (user_id = (select auth.uid()));

-- Sin políticas de insert/update/delete: anon y authenticated no pueden escribir.
revoke insert, update, delete, truncate on public.admins, public.subscribers, public.messages, public.payments from anon, authenticated;
revoke all on public.admins, public.subscribers, public.messages, public.payments from anon;
