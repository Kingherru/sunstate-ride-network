alter table public.workspace_members add column if not exists can_message_for_workspace boolean not null default false;

create table if not exists public.workspace_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_a_id uuid not null references public.workspaces(id),
  workspace_b_id uuid not null references public.workspaces(id),
  created_by_user_id uuid not null,
  creation_source text not null check (creation_source in ('network_profile','admin')),
  is_test boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  constraint workspace_conversations_distinct check (workspace_a_id <> workspace_b_id),
  constraint workspace_conversations_ordered check (workspace_a_id < workspace_b_id)
);
create unique index if not exists workspace_conversations_active_pair_idx on public.workspace_conversations (workspace_a_id, workspace_b_id) where archived_at is null;
create index if not exists workspace_conversations_a_idx on public.workspace_conversations(workspace_a_id);
create index if not exists workspace_conversations_b_idx on public.workspace_conversations(workspace_b_id);

create table if not exists public.workspace_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.workspace_conversations(id) on delete cascade,
  sender_workspace_id uuid not null references public.workspaces(id),
  recipient_workspace_id uuid not null references public.workspaces(id),
  sent_by_user_id uuid not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  is_test boolean not null default false
);
create index if not exists workspace_messages_conv_idx on public.workspace_messages(conversation_id, created_at);

create or replace function public.workspace_conversations_before_insert() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_a uuid; v_b uuid; v_test_a boolean; v_test_b boolean;
begin
  if new.workspace_a_id > new.workspace_b_id then
    v_a := new.workspace_b_id; v_b := new.workspace_a_id;
    new.workspace_a_id := v_a; new.workspace_b_id := v_b;
  end if;
  select is_test_account into v_test_a from public.workspaces where id = new.workspace_a_id;
  select is_test_account into v_test_b from public.workspaces where id = new.workspace_b_id;
  new.is_test := coalesce(v_test_a, false) or coalesce(v_test_b, false);
  new.updated_at := now();
  return new;
end; $$;
create trigger workspace_conversations_before_insert_trg before insert on public.workspace_conversations for each row execute function public.workspace_conversations_before_insert();

create or replace function public.workspace_messages_before_insert() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_test boolean;
begin
  select is_test into v_test from public.workspace_conversations where id = new.conversation_id;
  new.is_test := coalesce(v_test, false);
  return new;
end; $$;
create trigger workspace_messages_before_insert_trg before insert on public.workspace_messages for each row execute function public.workspace_messages_before_insert();

create or replace function public.workspace_messages_after_insert() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  update public.workspace_conversations set last_message_at = new.created_at, updated_at = now() where id = new.conversation_id;
  return new;
end; $$;
create trigger workspace_messages_after_insert_trg after insert on public.workspace_messages for each row execute function public.workspace_messages_after_insert();

create or replace function public.can_access_workspace_messages(ws uuid) returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
    where m.workspace_id = ws and m.user_id = auth.uid() and w.status = 'active'
      and (m.role in ('owner','admin') or m.can_message_for_workspace = true)
  );
$$;
grant execute on function public.can_access_workspace_messages(uuid) to authenticated;

grant select on public.workspace_conversations to authenticated;
grant all on public.workspace_conversations to service_role;
grant select on public.workspace_messages to authenticated;
grant all on public.workspace_messages to service_role;
alter table public.workspace_conversations enable row level security;
alter table public.workspace_messages enable row level security;

create policy workspace_conversations_select on public.workspace_conversations for select to authenticated using (
  public.can_access_workspace_messages(workspace_a_id) or public.can_access_workspace_messages(workspace_b_id)
  or (public.admin_can('messaging','read') and (public.admin_can_account(workspace_a_id) or public.admin_can_account(workspace_b_id)))
);
create policy workspace_messages_select on public.workspace_messages for select to authenticated using (
  public.can_access_workspace_messages(sender_workspace_id) or public.can_access_workspace_messages(recipient_workspace_id)
  or (public.admin_can('messaging','read') and (public.admin_can_account(sender_workspace_id) or public.admin_can_account(recipient_workspace_id)))
);

create or replace function public.find_or_create_workspace_conversation(_sender_ws uuid, _target_ws uuid, _created_by uuid, _source text) returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_a uuid; v_b uuid; v_id uuid;
begin
  if _sender_ws = _target_ws then raise exception 'A workspace cannot message itself'; end if;
  v_a := least(_sender_ws, _target_ws); v_b := greatest(_sender_ws, _target_ws);
  select id into v_id from public.workspace_conversations where workspace_a_id = v_a and workspace_b_id = v_b and archived_at is null;
  if v_id is not null then return v_id; end if;
  insert into public.workspace_conversations (workspace_a_id, workspace_b_id, created_by_user_id, creation_source) values (v_a, v_b, _created_by, _source) returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.find_or_create_workspace_conversation(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.find_or_create_workspace_conversation(uuid,uuid,uuid,text) to service_role;