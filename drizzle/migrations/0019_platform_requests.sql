create table public.platform_requests (
  id uuid primary key default gen_random_uuid(),
  mfn_id text unique,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  submitted_by uuid not null,
  category text not null check (category in ('question','account_issue','technical_problem','trip_issue','payment_question','verification_question','feature_request','other')),
  subject text not null check (char_length(subject) between 3 and 200),
  message text not null check (char_length(message) between 1 and 4000),
  status text not null default 'open' check (status in ('open','in_progress','waiting_for_provider','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.platform_requests(id) on delete cascade,
  actor_user_id uuid,
  event_type text not null check (event_type in ('created','reply_provider','reply_admin','status_change')),
  body text check (body is null or char_length(body) <= 4000),
  from_status text,
  to_status text,
  created_at timestamptz not null default now()
);

grant select, insert on public.platform_requests to authenticated;
grant select, insert on public.platform_request_events to authenticated;
grant all on public.platform_requests to service_role;
grant all on public.platform_request_events to service_role;

alter table public.platform_requests enable row level security;
alter table public.platform_request_events enable row level security;

create sequence public.platform_request_mfn_seq start 1;
create or replace function public.assign_platform_request_mfn()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.mfn_id is null then
    new.mfn_id := 'MFN-Q-' || lpad(nextval('public.platform_request_mfn_seq')::text, 6, '0');
  end if;
  return new;
end $$;
create trigger platform_request_mfn before insert on public.platform_requests
  for each row execute function public.assign_platform_request_mfn();

create or replace function public.touch_platform_request()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger platform_request_touch before update on public.platform_requests
  for each row execute function public.touch_platform_request();

create policy platform_requests_workspace_read on public.platform_requests
  for select to authenticated
  using (exists (
    select 1 from public.workspace_members m
    where m.workspace_id = platform_requests.workspace_id
      and m.user_id = auth.uid()
      and m.removed_at is null
  ));

create policy platform_request_events_workspace_read on public.platform_request_events
  for select to authenticated
  using (exists (
    select 1 from public.platform_requests r
    join public.workspace_members m on m.workspace_id = r.workspace_id
    where r.id = platform_request_events.request_id
      and m.user_id = auth.uid()
      and m.removed_at is null
  ));