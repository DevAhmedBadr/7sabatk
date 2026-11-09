-- 7sabatk Support System — phase 6: staff dashboard data API
-- Additive and re-runnable. Exposes only the dashboard fields needed by
-- active support staff and the site owner; customer access is denied.
begin;

create or replace function public.support_staff_dashboard(
  p_search text default null,
  p_status text default null,
  p_priority text default null,
  p_category bigint default null,
  p_scope text default 'all',
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_status text := nullif(p_status, 'all');
  v_priority text := nullif(p_priority, 'all');
  v_scope text := coalesce(nullif(p_scope, ''), 'all');
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_total bigint;
  v_stats jsonb;
  v_tickets jsonb;
begin
  if v_uid is null or not public.support_is_staff() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if v_status is not null and v_status not in ('open','in_progress','waiting_customer','resolved','closed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if v_priority is not null and v_priority not in ('low','normal','high','urgent') then
    raise exception 'invalid_priority' using errcode = '22023';
  end if;
  if v_scope not in ('all','mine','unassigned') then
    raise exception 'invalid_scope' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'total', count(*),
    'new', count(*) filter (where t.status = 'open' and t.last_message_role = 'customer'),
    'open', count(*) filter (where t.status = 'open'),
    'in_progress', count(*) filter (where t.status = 'in_progress'),
    'waiting_customer', count(*) filter (where t.status = 'waiting_customer'),
    'resolved', count(*) filter (where t.status = 'resolved'),
    'closed', count(*) filter (where t.status = 'closed'),
    'assigned_to_me', count(*) filter (where t.assigned_agent_id = v_uid),
    'unassigned', count(*) filter (where t.assigned_agent_id is null)
  ) into v_stats
  from public.support_tickets t;

  select count(*) into v_total
  from public.support_tickets t
  join public.profiles customer on customer.id = t.user_id
  left join auth.users customer_auth on customer_auth.id = t.user_id
  where (v_status is null or t.status = v_status)
    and (v_priority is null or t.priority = v_priority)
    and (p_category is null or t.category_id = p_category)
    and (v_scope = 'all' or (v_scope = 'mine' and t.assigned_agent_id = v_uid)
         or (v_scope = 'unassigned' and t.assigned_agent_id is null))
    and (v_search is null
      or t.ticket_number::text ilike '%' || v_search || '%'
      or coalesce(customer.full_name, '') ilike '%' || v_search || '%'
      or coalesce(customer.username, '') ilike '%' || v_search || '%'
      or coalesce(customer_auth.email, '') ilike '%' || v_search || '%'
      or coalesce(t.order_id, '') ilike '%' || v_search || '%');

  select coalesce(jsonb_agg(row_data order by updated_at desc, ticket_number desc), '[]'::jsonb)
    into v_tickets
  from (
    select
      t.updated_at,
      t.ticket_number,
      jsonb_build_object(
        'id', t.id,
        'ticket_number', t.ticket_number,
        'subject', t.subject,
        'status', t.status,
        'priority', t.priority,
        'order_id', t.order_id,
        'category_id', t.category_id,
        'category_ar', c.name_ar,
        'category_en', c.name_en,
        'subcategory_ar', sc.name_ar,
        'subcategory_en', sc.name_en,
        'customer_id', t.user_id,
        'customer_name', coalesce(nullif(btrim(customer.full_name), ''), nullif(btrim(customer.username), ''), '—'),
        'customer_username', customer.username,
        'customer_email', customer_auth.email,
        'assigned_agent_id', t.assigned_agent_id,
        'assigned_agent_name', coalesce(nullif(btrim(agent.full_name), ''), nullif(btrim(agent.username), '')),
        'last_message_role', t.last_message_role,
        'created_at', t.created_at,
        'updated_at', t.updated_at
      ) as row_data
    from public.support_tickets t
    join public.profiles customer on customer.id = t.user_id
    left join auth.users customer_auth on customer_auth.id = t.user_id
    left join public.support_categories c on c.id = t.category_id
    left join public.support_subcategories sc on sc.id = t.subcategory_id
    left join public.profiles agent on agent.id = t.assigned_agent_id
    where (v_status is null or t.status = v_status)
      and (v_priority is null or t.priority = v_priority)
      and (p_category is null or t.category_id = p_category)
      and (v_scope = 'all' or (v_scope = 'mine' and t.assigned_agent_id = v_uid)
           or (v_scope = 'unassigned' and t.assigned_agent_id is null))
      and (v_search is null
        or t.ticket_number::text ilike '%' || v_search || '%'
        or coalesce(customer.full_name, '') ilike '%' || v_search || '%'
        or coalesce(customer.username, '') ilike '%' || v_search || '%'
        or coalesce(customer_auth.email, '') ilike '%' || v_search || '%'
        or coalesce(t.order_id, '') ilike '%' || v_search || '%')
    order by t.updated_at desc, t.ticket_number desc
    limit v_page_size offset ((v_page - 1) * v_page_size)
  ) page_rows;

  return jsonb_build_object(
    'stats', v_stats,
    'tickets', v_tickets,
    'total_filtered', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
end;
$$;

revoke all on function public.support_staff_dashboard(text,text,text,bigint,text,integer,integer) from public, anon;
grant execute on function public.support_staff_dashboard(text,text,text,bigint,text,integer,integer) to authenticated;

notify pgrst, 'reload schema';
commit;
