-- Owner-written in-app announcements, for all active accounts or chosen usernames.
-- Additive: leaves support ticket notifications unchanged.
begin;

create table if not exists public.site_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  sent_by uuid not null references public.profiles(id) on delete restrict,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists site_notifications_user_unread_idx
  on public.site_notifications (user_id, is_read, created_at desc);

alter table public.site_notifications enable row level security;
revoke all on public.site_notifications from public, anon, authenticated;
grant select on public.site_notifications to authenticated;
grant update (is_read, read_at) on public.site_notifications to authenticated;
drop policy if exists site_notifications_read_own on public.site_notifications;
create policy site_notifications_read_own on public.site_notifications
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists site_notifications_update_own on public.site_notifications;
create policy site_notifications_update_own on public.site_notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.list_site_notification_targets()
returns table(id uuid, username text, full_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.support_is_owner() then
    raise exception 'Only the active site owner can list notification targets' using errcode = '42501';
  end if;
  return query
    select p.id, p.username, p.full_name
    from public.profiles p
    where p.username is not null and coalesce(p.is_banned, false) = false
      and p.id <> (select auth.uid())
    order by lower(p.username);
end;
$$;
revoke all on function public.list_site_notification_targets() from public, anon, authenticated;
grant execute on function public.list_site_notification_targets() to authenticated;

create or replace function public.send_site_notification(
  p_title text,
  p_message text,
  p_usernames text[] default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_names text[];
  v_requested integer;
  v_matched integer;
  v_sent integer;
begin
  if (select auth.uid()) is null or not public.support_is_owner() then
    raise exception 'Only the active site owner can send notifications' using errcode = '42501';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 120 then
    raise exception 'Notification title must be between 1 and 120 characters';
  end if;
  if p_message is null or char_length(btrim(p_message)) not between 1 and 2000 then
    raise exception 'Notification message must be between 1 and 2000 characters';
  end if;

  if p_usernames is null then
    insert into public.site_notifications (user_id, title, message, sent_by)
    select p.id, btrim(p_title), btrim(p_message), (select auth.uid())
    from public.profiles p
    where coalesce(p.is_banned, false) = false
      and p.id <> (select auth.uid());
    get diagnostics v_sent = row_count;
    return v_sent;
  end if;

  select array_agg(distinct lower(trim(both '@' from btrim(x))))
    filter (where btrim(x) <> '')
    into v_names
  from unnest(p_usernames) as input_names(x);
  v_requested := coalesce(cardinality(v_names), 0);
  if v_requested = 0 then
    raise exception 'Choose at least one username, or select all users';
  end if;

  select count(distinct lower(p.username))::integer into v_matched
  from public.profiles p
  where lower(p.username) = any(v_names)
    and coalesce(p.is_banned, false) = false;
  if v_matched <> v_requested then
    raise exception 'One or more usernames do not match an active account';
  end if;

  insert into public.site_notifications (user_id, title, message, sent_by)
  select p.id, btrim(p_title), btrim(p_message), (select auth.uid())
  from public.profiles p
  where lower(p.username) = any(v_names)
    and coalesce(p.is_banned, false) = false
    and p.id <> (select auth.uid());
  get diagnostics v_sent = row_count;
  return v_sent;
end;
$$;
revoke all on function public.send_site_notification(text, text, text[]) from public, anon, authenticated;
grant execute on function public.send_site_notification(text, text, text[]) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'site_notifications') then
    alter publication supabase_realtime add table public.site_notifications;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
