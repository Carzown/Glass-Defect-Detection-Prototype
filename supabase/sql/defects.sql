-- ===== Supabase setup for Dashboard & Device ingestion (idempotent) =====

-- 1) Extensions
create extension if not exists pgcrypto; -- for gen_random_uuid()

-- 2) Role enum (admin/employee) used by profiles
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin','employee');
  end if;
end$$;

-- 3) Profiles table (used by React auth helpers)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role public.user_role not null default 'employee',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Policies for profiles (drop then create to be re-runnable)
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_insert_own_employee on public.profiles;
create policy profiles_insert_own_employee
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid() and role = 'employee');

drop policy if exists profiles_update_own_no_role_escalation on public.profiles;
create policy profiles_update_own_no_role_escalation
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = 'employee');

-- Admin management helpers (allow admins to view/manage all profiles)
drop function if exists public.is_admin();
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all
  on public.profiles
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4) Defects table (fields Dashboard reads)
create table if not exists public.defects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  defect_type text not null default 'Defect',
  image_url text,
  time_text text,   -- optional human time label used by Dashboard if present
  device_id text    -- optional camera/device id
);

-- Index for session-based queries (created_at >= sessionStart)
create index if not exists defects_created_at_idx on public.defects (created_at desc);

alter table public.defects enable row level security;

-- Policies for defects (drop then create)
-- Allow reads for both anon and authenticated so Dashboard can display without login if desired.
drop policy if exists defects_authenticated_select on public.defects;
drop policy if exists defects_anon_select on public.defects;
create policy defects_authenticated_select
  on public.defects
  for select
  to authenticated
  using (true);
create policy defects_anon_select
  on public.defects
  for select
  to anon
  using (true);

-- (Optional) If you prefer auth-only reads, comment out the anon policy above.

-- Insert policy is not strictly required for service_role (it bypasses RLS),
-- but we include it for clarity when invoking with non-service keys.
drop policy if exists defects_insert_service_role on public.defects;
create policy defects_insert_service_role
  on public.defects
  for insert
  to authenticated
  with check (auth.role() = 'service_role');

-- 5) Enable Realtime on defects (Dashboard listens to INSERTs)
do $$
begin
  begin
    alter publication supabase_realtime add table public.defects;
  exception
    when duplicate_object then null;
  end;
end$$;

-- 6) Storage bucket for defect images
-- Choose one of the following depending on image URL strategy:
-- Public bucket (simplest; direct public URLs work in Dashboard):
insert into storage.buckets (id, name, public)
  values ('defects', 'defects', true)
  on conflict (id) do nothing;
-- Private bucket (requires signed URLs from Edge Function):
-- insert into storage.buckets (id, name, public)
--   values ('defects', 'defects', false)
--   on conflict (id) do nothing;

-- 7) Optional quick seed (uncomment to test Dashboard fetch/realtime)
-- insert into public.defects (defect_type, image_url, time_text, device_id)
-- values ('Crack', 'https://example.com/image.jpg', '[12:34:56]', 'cam-1');

-- ===== End of setup =====
