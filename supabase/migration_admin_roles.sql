-- 7sabatk: allow every explicitly promoted, active admin to use the admin dashboard.
-- The fixed owner account remains protected in the customer-management Edge Function.
-- Run this once in Supabase SQL Editor.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and coalesce(p.is_banned, false) = false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
