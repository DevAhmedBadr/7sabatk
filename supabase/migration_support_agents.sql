-- Support Agent role and manager-controlled employee settings.
-- Run after migration_support_foundation.sql. The website role field stays
-- unchanged; support membership is isolated in its own privileged table.
begin;

create table if not exists public.support_agents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  receive_support_notifications boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_agents enable row level security;
revoke all on public.support_agents from public, anon, authenticated;
grant all on public.support_agents to service_role;

create or replace function public.is_support_staff_member(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id and coalesce(p.is_banned, false) = false
      and (
        p_user_id = (select auth.uid())
        or exists (
          select 1 from public.profiles caller
          where caller.id = (select auth.uid()) and coalesce(caller.is_banned, false) = false
            and (caller.role = 'admin' or exists (
              select 1 from public.support_agents caller_agent
              where caller_agent.user_id = caller.id and caller_agent.is_active
            ))
        )
      )
      and (p.role = 'admin' or exists (
        select 1 from public.support_agents a
        where a.user_id = p.id and a.is_active
      ))
  );
$$;
revoke all on function public.is_support_staff_member(uuid) from public;
grant execute on function public.is_support_staff_member(uuid) to authenticated;

create or replace function public.is_site_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p_user_id = (select auth.uid())
      and p.role = 'admin' and coalesce(p.is_banned, false) = false
  );
$$;
revoke all on function public.is_site_admin(uuid) from public;
grant execute on function public.is_site_admin(uuid) to authenticated;

-- Only an active, non-banned support agent or an active site administrator may
-- use support RLS policies. Service-role management is performed by Edge Function.
create or replace function public.is_support_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and coalesce(p.is_banned, false) = false
      and (
        p.role = 'admin'
        or exists (
          select 1 from public.support_agents a
          where a.user_id = p.id and a.is_active
        )
      )
  );
$$;
revoke all on function public.is_support_staff() from public;
grant execute on function public.is_support_staff() to authenticated;

-- Staff may assign tickets only to active agents or administrators. Keep the
-- message sender label consistent with the caller's actual role.
drop policy if exists support_tickets_staff_update on public.support_tickets;
create policy support_tickets_staff_update on public.support_tickets for update to authenticated
  using ((select public.is_support_staff()))
  with check (
    (select public.is_support_staff())
    and (assigned_agent_id is null or (select public.is_support_staff_member(assigned_agent_id)))
  );

drop policy if exists support_messages_staff_insert on public.support_messages;
create policy support_messages_staff_insert on public.support_messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and (select public.is_support_staff())
  and (
    (sender_role = 'admin' and (select public.is_site_admin((select auth.uid()))))
    or (sender_role = 'support_agent' and (select public.is_support_staff_member((select auth.uid())))
      and not (select public.is_site_admin((select auth.uid()))))
  )
);

-- Category setup belongs to site administrators; agents handle conversations only.
drop policy if exists support_categories_staff_manage on public.support_categories;
drop policy if exists support_categories_admin_manage on public.support_categories;
create policy support_categories_admin_manage on public.support_categories for all to authenticated
  using ((select public.is_site_admin((select auth.uid()))))
  with check ((select public.is_site_admin((select auth.uid()))));
drop policy if exists support_subcategories_staff_manage on public.support_subcategories;
drop policy if exists support_subcategories_admin_manage on public.support_subcategories;
create policy support_subcategories_admin_manage on public.support_subcategories for all to authenticated
  using ((select public.is_site_admin((select auth.uid()))))
  with check ((select public.is_site_admin((select auth.uid()))));

notify pgrst, 'reload schema';
commit;
