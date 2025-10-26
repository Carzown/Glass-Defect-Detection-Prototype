# Supabase Migration Guide

## What Changed

### Removed
- Firebase dependency (`firebase: ^12.4.0`)
- `src/firebase.js` file with Firebase configuration

### Added
- Supabase dependency (`@supabase/supabase-js: ^2.39.0`)
- `src/supabase.js` file with Supabase configuration and auth functions

## Setup Required

### 1. Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Get your project URL and anon key from Settings > API

### 2. Update Configuration
Edit `src/supabase.js` and replace:
```javascript
const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'
```

### 3. Create Database Schema
Run this SQL in your Supabase SQL Editor:

```sql
-- Create profiles table for user roles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  role TEXT DEFAULT 'employee',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  PRIMARY KEY (id)
);

-- Set up Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow service role to insert profiles
CREATE POLICY "Enable insert for service role" ON profiles
  FOR INSERT WITH CHECK (true);
```

### 4. Environment Variables (Optional)
Create `.env.local` file in react-glass folder:
```
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Then update `src/supabase.js`:
```javascript
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY
```

## Functions Available

All the same authentication functions are available:
- `signInAndGetRole(email, password)`
- `createUserWithRole(email, password, role)`
- `getRole(uid)`
- `signOutUser()`

The Login component will work the same way after configuration.

---

## Jetson → Supabase → Website: Defects ingestion setup

Follow these steps to store defects from your Jetson directly in Supabase and stream new rows live to the website.

### 1) Create tables and device tokens

Run in Supabase SQL Editor:

```sql
-- Enable required extensions
create extension if not exists pgcrypto; -- for gen_random_uuid()

-- Device API keys (one per Jetson)
create table if not exists public.device_api_keys (
  device_id text primary key,
  token text not null unique,        -- store a random secret per device
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- Defects table
create table if not exists public.defects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  device_id text not null,
  defect_type text not null,
  image_url text,                    -- data URL or public HTTP URL
  -- add more fields as needed: severity, bbox, notes, etc.
  constraint defects_device_id_fk foreign key (device_id) references public.device_api_keys(device_id)
);

alter table public.defects enable row level security;

-- Read policy: allow authenticated users to read defects (adjust to your needs)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='defects' and policyname='defects_read_auth') then
    create policy defects_read_auth on public.defects for select to authenticated using (true);
  end if;
end $$;
```

Create a token for your device (replace values):

```sql
insert into public.device_api_keys (device_id, token)
values ('cam-1', 'REPLACE_WITH_LONG_RANDOM_TOKEN');
```

### 2) Secure RPC for device ingestion

The device calls this RPC with header `X-Device-Token: <token>`, and the function inserts the row with SECURITY DEFINER so RLS stays enforced.

```sql
create or replace function public.ingest_defect(
  device_id text,
  defect_type text,
  image_url text
)
returns public.defects
language plpgsql
security definer
set search_path = public
as $$
declare
  provided_token text;
  inserted public.defects%rowtype;
begin
  -- Header names are lowercased in PostgREST; fetch our custom header
  provided_token := coalesce(
    current_setting('request.headers', true)::json->>'x-device-token',
    ''
  );
  if provided_token = '' then
    raise exception 'missing device token' using errcode='28000';
  end if;

  if not exists (
    select 1 from public.device_api_keys k
    where k.device_id = ingest_defect.device_id
      and k.token = provided_token
      and k.enabled
  ) then
    raise exception 'invalid device token' using errcode='28000';
  end if;

  insert into public.defects (device_id, defect_type, image_url)
  values (ingest_defect.device_id, ingest_defect.defect_type, ingest_defect.image_url)
  returning * into inserted;

  return inserted;
end $$;

-- Allow anon to execute the RPC (the function itself checks the device token)
grant execute on function public.ingest_defect(text, text, text) to anon;
```

### 3) Enable Realtime on the defects table

```sql
alter publication supabase_realtime add table public.defects;
```

### 4) Website wiring (environment)

In `react-glass/.env.local` (create if missing):

```
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_ENABLE_SUPABASE_REALTIME=true
```

The Dashboard will fetch the latest defects and subscribe to new inserts automatically when `REACT_APP_ENABLE_SUPABASE_REALTIME=true`.

### 5) Device wiring

On the Jetson, set environment variables and call the sample script:

```
# Windows PowerShell example
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_ANON_KEY = "ey...<anon>"
$env:DEVICE_TOKEN = "REPLACE_WITH_LONG_RANDOM_TOKEN"
python backend/jetson_supabase_ingest.py --device-id cam-1 --defect-type Scratch --image C:\path\to\image.jpg
```

If successful, the website (when logged in and with Realtime enabled) will show the new defect in the list immediately.
