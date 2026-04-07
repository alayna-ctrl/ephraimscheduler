-- Run this in Supabase SQL editor.
create extension if not exists "pgcrypto";

create table if not exists sleeping_spots (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  capacity integer not null check (capacity > 0),
  sort_order integer not null,
  active boolean not null default true
);

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  start_date date not null,
  end_date date not null,
  guest_count integer not null check (guest_count > 0),
  notes text,
  created_at timestamptz not null default now(),
  check (start_date < end_date)
);

create table if not exists reservation_spots (
  reservation_id uuid not null references reservations(id) on delete cascade,
  sleeping_spot_id uuid not null references sleeping_spots(id) on delete restrict,
  primary key (reservation_id, sleeping_spot_id)
);

create table if not exists app_settings (
  id integer primary key default 1,
  family_passcode_hash text not null,
  max_total_guests integer not null default 10 check (max_total_guests > 0),
  season_start date,
  season_end date,
  check (id = 1)
);

insert into sleeping_spots (name, capacity, sort_order)
values
  ('Bedroom 1', 2, 1),
  ('Bedroom 2', 2, 2),
  ('Bedroom 3', 2, 3),
  ('Porch Couch', 1, 4)
on conflict (name) do nothing;

insert into app_settings (id, family_passcode_hash, max_total_guests, season_start, season_end)
values (1, 'replace_with_sha256_hash', 9, '2026-05-15', '2026-09-15')
on conflict (id) do nothing;

-- Recommended policies if you later switch from service-role API access to anon+RLS:
alter table sleeping_spots enable row level security;
alter table reservations enable row level security;
alter table reservation_spots enable row level security;
alter table app_settings enable row level security;

