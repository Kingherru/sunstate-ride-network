-- NEMT public intake tables (Phase 1)

create table if not exists public.ride_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'new',
  -- Patient
  patient_first_name text not null,
  patient_last_name text not null,
  patient_phone text not null,
  patient_email text,
  -- Pickup
  pickup_address text not null,
  pickup_city text not null,
  pickup_date date not null,
  pickup_time time not null,
  -- Dropoff
  dropoff_address text not null,
  dropoff_city text not null,
  -- Trip details
  transport_type text not null check (transport_type in ('ambulatory','wheelchair','gurney')),
  round_trip boolean not null default false,
  mobility_notes text,
  special_instructions text,
  -- Internal
  ip_address text,
  user_agent text
);

create index if not exists ride_requests_created_at_idx on public.ride_requests (created_at desc);
create index if not exists ride_requests_status_idx on public.ride_requests (status);

alter table public.ride_requests enable row level security;

-- Public can insert (anonymous ride request form). Reads are admin-only — no select policy.
create policy "Anyone can submit a ride request"
  on public.ride_requests
  for insert
  to anon, authenticated
  with check (true);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  ip_address text,
  user_agent text
);

create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;

create policy "Anyone can send a contact message"
  on public.contact_messages
  for insert
  to anon, authenticated
  with check (true);

create table if not exists public.provider_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'new',
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  city text not null,
  service_types text[] not null default '{}',
  fleet_size int,
  notes text
);

alter table public.provider_applications enable row level security;

create policy "Anyone can apply to be a provider"
  on public.provider_applications
  for insert
  to anon, authenticated
  with check (true);