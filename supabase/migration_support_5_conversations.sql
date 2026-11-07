-- 7sabatk Support System — المرحلة 5: المحادثات داخل التذكرة
-- يشغّل مرة واحدة بعد migration_support_1_schema.sql وmigration_support_2_security.sql.
-- لا يحذف بيانات. القراءة تمر عبر دوال تتحقق من ملكية التذكرة وتخفي الملاحظات الداخلية عن العميل.
begin;

create or replace function public.support_get_conversation(p_ticket_id uuid)
returns table (
  out_ticket_id uuid,
  out_ticket_number bigint,
  out_customer_id uuid,
  out_subject text,
  out_status text,
  out_priority text,
  out_assigned_agent_id uuid,
  out_assigned_agent_name text,
  out_updated_at timestamptz,
  out_message_id bigint,
  out_sender_id uuid,
  out_sender_role text,
  out_sender_name text,
  out_message text,
  out_is_internal boolean,
  out_message_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ticket public.support_tickets%rowtype;
begin
  if v_uid is null or not public.support_user_ok() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_ticket from public.support_tickets t where t.id = p_ticket_id;
  if not found or (v_ticket.user_id <> v_uid and not public.support_is_staff()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return query
  select v_ticket.id, v_ticket.ticket_number, v_ticket.user_id, v_ticket.subject,
         v_ticket.status, v_ticket.priority, v_ticket.assigned_agent_id,
         coalesce(nullif(trim(ap.full_name), ''), nullif(trim(ap.username), '')),
         v_ticket.updated_at,
         m.id, m.sender_id, m.sender_role,
         coalesce(nullif(trim(sp.full_name), ''), nullif(trim(sp.username), ''),
           case m.sender_role when 'customer' then 'Customer' when 'agent' then 'Support' when 'admin' then 'Admin' else 'System' end),
         m.message, m.is_internal, m.created_at
  from public.support_messages m
  left join public.profiles sp on sp.id = m.sender_id
  left join public.profiles ap on ap.id = v_ticket.assigned_agent_id
  where m.ticket_id = v_ticket.id
    and (public.support_is_staff() or m.is_internal = false)
  order by m.id;
end;
$$;

revoke all on function public.support_get_conversation(uuid) from public, anon;
grant execute on function public.support_get_conversation(uuid) to authenticated;

create or replace function public.support_mark_ticket_read(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not public.support_user_ok() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.support_tickets t
    where t.id = p_ticket_id and (t.user_id = v_uid or public.support_is_staff())
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  insert into public.support_ticket_reads(ticket_id, user_id)
  values (p_ticket_id, v_uid)
  on conflict (ticket_id, user_id) do update set last_read_at = now();
end;
$$;

revoke all on function public.support_mark_ticket_read(uuid) from public, anon;
grant execute on function public.support_mark_ticket_read(uuid) to authenticated;

create or replace function public.support_list_active_agents()
returns table (agent_id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.support_is_staff() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  select p.id, coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'Support agent')
  from public.support_agents a
  join public.profiles p on p.id = a.user_id
  where a.is_active
  order by display_name;
end;
$$;

revoke all on function public.support_list_active_agents() from public, anon;
grant execute on function public.support_list_active_agents() to authenticated;

notify pgrst, 'reload schema';
commit;
