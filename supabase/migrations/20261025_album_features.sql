-- Racle Album feature migration
-- Run in Supabase Dashboard -> SQL Editor using the project owner account.
-- This adds cloud favorites, recoverable deletes, and secure share-link storage.
-- Existing pins and storage files are not deleted by this migration.

alter table public.pins
  add column if not exists deleted_at timestamptz null;

create index if not exists pins_owner_deleted_at_idx
  on public.pins (user_id, deleted_at);

create table if not exists public.pin_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  pin_id uuid not null references public.pins(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, pin_id)
);

alter table public.pin_favorites enable row level security;

drop policy if exists "Users manage own pin favorites" on public.pin_favorites;
create policy "Users manage own pin favorites"
  on public.pin_favorites
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.album_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  share_token uuid not null unique default gen_random_uuid(),
  title text not null default 'Shared memories',
  pin_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  revoked_at timestamptz null
);

alter table public.album_shares enable row level security;

drop policy if exists "Owners manage their album shares" on public.album_shares;
create policy "Owners manage their album shares"
  on public.album_shares
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Public share links are read-only. This RPC returns only non-deleted pins
-- explicitly selected by the owner for a valid, non-revoked share token.
create or replace function public.get_shared_album(p_share_token uuid)
returns table (
  id uuid,
  title text,
  note text,
  image_url text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.title, p.note, p.image_url, p.created_at
  from public.album_shares s
  join public.pins p on p.id = any(s.pin_ids)
  where s.share_token = p_share_token
    and s.revoked_at is null
    and p.deleted_at is null;
$$;

revoke all on function public.get_shared_album(uuid) from public;
grant execute on function public.get_shared_album(uuid) to anon, authenticated;

-- Keep the share table itself private; visitors can only use the RPC above.
