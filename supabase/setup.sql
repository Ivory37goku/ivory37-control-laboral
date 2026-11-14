-- IVORY37 Control Laboral: isolated cloud snapshot for each signed-in user.
-- Run this once in the Supabase SQL Editor for the project used by the app.

create table if not exists public.ivory37_sync (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{"jornadas":[],"viajes":[],"pagos":[],"ajustes":[]}'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.ivory37_sync enable row level security;

revoke all on table public.ivory37_sync from anon, authenticated;
grant select, insert, update on table public.ivory37_sync to authenticated;

create policy "Users can read their own IVORY37 data"
  on public.ivory37_sync for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own IVORY37 data"
  on public.ivory37_sync for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own IVORY37 data"
  on public.ivory37_sync for update to authenticated
  using ((select auth.uid()) = user_id)
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

create trigger ivory37_sync_touch
  before insert or update on public.ivory37_sync
  for each row execute function public.ivory37_sync_touch_row();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'ivory37_sync'
     ) then
    alter publication supabase_realtime add table public.ivory37_sync;
  end if;
end;
$$;
