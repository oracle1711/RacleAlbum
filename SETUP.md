# Racle Album — Cloud Setup (Free)

Follow these steps once. After that, login and photos work on any device.

## 1. Create a free Supabase project

1. Open [https://supabase.com](https://supabase.com) → **Start your project**
2. Sign up (GitHub login is easiest)
3. **New project** → name it `racle-album` (or anything)
4. Set a database password (save it somewhere)
5. Choose a region close to you → **Create project**
6. Wait 1–2 minutes until it is ready

## 2. Get your API keys

1. In the left menu: **Project Settings** (gear) → **API**
2. Copy:
   - **Project URL**
   - **anon public** key
3. Open `config.js` in this repo and paste them:

```js
const SUPABASE_URL = 'https://xxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

## 3. Create the database table

1. Left menu → **SQL Editor** → **New query**
2. Paste this and click **Run**:

```sql
-- Pins table
create table if not exists public.pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'Untitled',
  note text default '',
  image_url text,
  created_at timestamptz default now()
);

-- Only the owner can see/edit their pins
alter table public.pins enable row level security;

create policy "Users can view own pins"
  on public.pins for select
  using (auth.uid() = user_id);

create policy "Users can insert own pins"
  on public.pins for insert
  with check (auth.uid() = user_id);

create policy "Users can update own pins"
  on public.pins for update
  using (auth.uid() = user_id);

create policy "Users can delete own pins"
  on public.pins for delete
  using (auth.uid() = user_id);
```

## 4. Create the storage bucket

1. Left menu → **Storage** → **New bucket**
2. Name: `album-images`
3. Turn **Public bucket** ON (so images can display on the site)
4. Create bucket

Then go to **SQL Editor** again and run:

```sql
-- Allow logged-in users to upload into their own folder
create policy "Users can upload own images"
  on storage.objects for insert
  with check (
    bucket_id = 'album-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own images"
  on storage.objects for update
  using (
    bucket_id = 'album-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own images"
  on storage.objects for delete
  using (
    bucket_id = 'album-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public read (bucket is public)
create policy "Public can view album images"
  on storage.objects for select
  using (bucket_id = 'album-images');
```

## 5. Enable Email auth

1. Left menu → **Authentication** → **Providers**
2. **Email** should be enabled (default)
3. Optional: turn off "Confirm email" under Auth → Providers → Email if you want instant login without clicking a link

## 6. Done

Refresh your site: https://oracle1711.github.io/RacleAlbum/

Register a new account → upload photos → they are stored in the cloud.

Log in from another device with the same email — your album is there.
