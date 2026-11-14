-- IVORY37: instalación idempotente del proyecto Supabase compartido.
-- Control Laboral y Gestión Clientes usan el mismo inicio de sesión,
-- pero guardan sus datos en tablas distintas y privadas por usuario.
-- Ejecutar una vez (o volver a ejecutar sin borrar los datos existentes)
-- en Supabase → SQL Editor.

begin;

-- Control Laboral: conserva el esquema y los datos actuales.
create table if not exists public.ivory37_sync (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{"jornadas":[],"viajes":[],"pagos":[],"ajustes":[]}'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.ivory37_sync add column if not exists payload jsonb not null default '{"jornadas":[],"viajes":[],"pagos":[],"ajustes":[]}'::jsonb;
alter table public.ivory37_sync add column if not exists revision bigint not null default 1;
alter table public.ivory37_sync add column if not exists updated_at timestamptz not null default now();
alter table public.ivory37_sync enable row level security;
revoke all on table public.ivory37_sync from public, anon, authenticated;
grant select, insert, update on table public.ivory37_sync to authenticated;

drop policy if exists "Users can read their own IVORY37 data" on public.ivory37_sync;
drop policy if exists "Users can create their own IVORY37 data" on public.ivory37_sync;
drop policy if exists "Users can update their own IVORY37 data" on public.ivory37_sync;
create policy "Users can read their own IVORY37 data" on public.ivory37_sync
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own IVORY37 data" on public.ivory37_sync
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own IVORY37 data" on public.ivory37_sync
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.ivory37_sync_touch_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.revision := old.revision + 1;
  end if;
  return new;
end;
$$;
drop trigger if exists ivory37_sync_touch on public.ivory37_sync;
create trigger ivory37_sync_touch before insert or update on public.ivory37_sync
  for each row execute function public.ivory37_sync_touch_row();

-- Gestión Clientes: cartera, leads, obras, presupuestos y tareas.
create table if not exists public.gestion_clientes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.gestion_clientes add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.gestion_clientes add column if not exists updated_at timestamptz not null default now();
alter table public.gestion_clientes enable row level security;
revoke all on table public.gestion_clientes from public, anon, authenticated;
grant select, insert, update on table public.gestion_clientes to authenticated;

-- Retira también las políticas de la primera versión de Gestión Clientes,
-- para que no quede ninguna regla antigua más permisiva.
drop policy if exists "Users can read their own company data" on public.gestion_clientes;
drop policy if exists "Users can create their own company data" on public.gestion_clientes;
drop policy if exists "Users can update their own company data" on public.gestion_clientes;
drop policy if exists "Users can read their own Gestión Clientes data" on public.gestion_clientes;
drop policy if exists "Users can create their own Gestión Clientes data" on public.gestion_clientes;
drop policy if exists "Users can update their own Gestión Clientes data" on public.gestion_clientes;
create policy "Users can read their own Gestión Clientes data" on public.gestion_clientes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own Gestión Clientes data" on public.gestion_clientes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own Gestión Clientes data" on public.gestion_clientes
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Activa actualizaciones en tiempo real en ambas tablas si la publicación existe.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ivory37_sync') then
      alter publication supabase_realtime add table public.ivory37_sync;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gestion_clientes') then
      alter publication supabase_realtime add table public.gestion_clientes;
    end if;
  end if;
end;
$$;

commit;
