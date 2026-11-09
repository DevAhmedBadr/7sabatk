-- 7sabatk Support System — phase 8: in-app notifications and live category catalog
-- Additive and re-runnable. Uses the support_notifications and category tables
-- created in phases 2–6; preserves existing tickets, messages, and categories.
begin;

-- A single public-to-authenticated revision row lets customer forms refresh on
-- every catalog change without exposing inactive category rows through RLS.
create table if not exists public.support_category_catalog_state (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
insert into public.support_category_catalog_state (singleton) values (true)
on conflict (singleton) do nothing;
alter table public.support_category_catalog_state enable row level security;
revoke all on public.support_category_catalog_state from public, anon, authenticated;
grant select on public.support_category_catalog_state to authenticated;
drop policy if exists support_category_catalog_state_read on public.support_category_catalog_state;
create policy support_category_catalog_state_read on public.support_category_catalog_state
  for select to authenticated using (singleton);

create or replace function public.support_bump_category_catalog()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.support_category_catalog_state (singleton, revision, updated_at)
  values (true, 2, now())
  on conflict (singleton) do update
    set revision = public.support_category_catalog_state.revision + 1,
        updated_at = now();
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.support_bump_category_catalog() from public, anon, authenticated;

drop trigger if exists support_categories_catalog_bump_trg on public.support_categories;
create trigger support_categories_catalog_bump_trg
  after insert or update or delete on public.support_categories
  for each row execute function public.support_bump_category_catalog();
drop trigger if exists support_subcategories_catalog_bump_trg on public.support_subcategories;
create trigger support_subcategories_catalog_bump_trg
  after insert or update or delete on public.support_subcategories
  for each row execute function public.support_bump_category_catalog();

-- Notify opted-in support staff when a ticket is created; notify the customer
-- and relevant staff when public messages, status, or assignment change.
create or replace function public.support_create_ticket_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.support_notifications (user_id, ticket_id, type)
  select a.user_id, new.id, 'ticket_created'
  from public.support_agents a
  join public.profiles p on p.id = a.user_id and coalesce(p.is_banned, false) = false
  where a.is_active and a.receive_inapp_notifications;
  return new;
end;
$$;
revoke all on function public.support_create_ticket_notifications() from public, anon, authenticated;
drop trigger if exists support_tickets_created_notification_trg on public.support_tickets;
create trigger support_tickets_created_notification_trg
  after insert on public.support_tickets
  for each row execute function public.support_create_ticket_notifications();

create or replace function public.support_message_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.support_tickets%rowtype;
  v_first_customer_message boolean;
  v_agent_user uuid;
begin
  if new.is_internal or new.sender_role = 'system' then return new; end if;
  select * into v_ticket from public.support_tickets t where t.id = new.ticket_id;
  if not found then return new; end if;

  if new.sender_role = 'customer' then
    select not exists (
      select 1 from public.support_messages m
      where m.ticket_id = new.ticket_id and m.id < new.id and not m.is_internal
    ) into v_first_customer_message;
    if v_first_customer_message then return new; end if;

    v_agent_user := null;
    if v_ticket.assigned_agent_id is not null then
      select a.user_id into v_agent_user
      from public.support_agents a
      join public.profiles p on p.id = a.user_id and coalesce(p.is_banned, false) = false
      where a.user_id = v_ticket.assigned_agent_id
        and a.is_active and a.receive_inapp_notifications;
    end if;

    if v_agent_user is not null then
      insert into public.support_notifications (user_id, ticket_id, message_id, type)
      values (v_agent_user, new.ticket_id, new.id, 'customer_reply');
    else
      insert into public.support_notifications (user_id, ticket_id, message_id, type)
      select a.user_id, new.ticket_id, new.id, 'customer_reply'
      from public.support_agents a
      join public.profiles p on p.id = a.user_id and coalesce(p.is_banned, false) = false
      where a.is_active and a.receive_inapp_notifications;
    end if;
  elsif new.sender_role in ('agent','admin') then
    insert into public.support_notifications (user_id, ticket_id, message_id, type)
    values (v_ticket.user_id, new.ticket_id, new.id, 'new_reply');
  end if;
  return new;
end;
$$;
revoke all on function public.support_message_notifications() from public, anon, authenticated;
drop trigger if exists support_messages_notifications_trg on public.support_messages;
create trigger support_messages_notifications_trg
  after insert on public.support_messages
  for each row execute function public.support_message_notifications();

create or replace function public.support_ticket_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agent_user uuid;
begin
  if new.status is distinct from old.status then
    insert into public.support_notifications (user_id, ticket_id, type)
    values (new.user_id, new.id, 'status_changed');

    if new.assigned_agent_id is not null then
      select a.user_id into v_agent_user
      from public.support_agents a
      join public.profiles p on p.id = a.user_id and coalesce(p.is_banned, false) = false
      where a.user_id = new.assigned_agent_id
        and a.is_active and a.receive_inapp_notifications;
      if v_agent_user is not null then
        insert into public.support_notifications (user_id, ticket_id, type)
        values (v_agent_user, new.id, 'status_changed');
      end if;
    end if;
  end if;

  if new.assigned_agent_id is distinct from old.assigned_agent_id
     and new.assigned_agent_id is not null then
    select a.user_id into v_agent_user
    from public.support_agents a
    join public.profiles p on p.id = a.user_id and coalesce(p.is_banned, false) = false
    where a.user_id = new.assigned_agent_id
      and a.is_active and a.receive_inapp_notifications;
    if v_agent_user is not null then
      insert into public.support_notifications (user_id, ticket_id, type)
      values (v_agent_user, new.id, 'assigned');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.support_ticket_notifications() from public, anon, authenticated;
drop trigger if exists support_tickets_notifications_trg on public.support_tickets;
create trigger support_tickets_notifications_trg
  after update of status, assigned_agent_id on public.support_tickets
  for each row execute function public.support_ticket_notifications();

-- Publish only rows needed for authenticated live updates; RLS remains active.
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['support_category_catalog_state'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
