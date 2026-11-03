-- 7sabatk visitor analytics
-- Run once in Supabase Dashboard > SQL Editor.
-- Stores a SHA-256 pseudonymous device identifier once per UTC hour.
begin;

create table if not exists public.site_visitor_hourly (
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  visited_hour timestamptz not null,
  primary key (visitor_hash, visited_hour)
);

alter table public.site_visitor_hourly enable row level security;
revoke all on public.site_visitor_hourly from anon, authenticated;
grant usage on schema public to anon, authenticated;

create or replace function public.record_site_visit(p_visitor_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_visitor_hash is null or p_visitor_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid visitor identifier';
  end if;

  insert into public.site_visitor_hourly(visitor_hash, visited_hour)
  values (p_visitor_hash, date_trunc('hour', now()))
  on conflict (visitor_hash, visited_hour) do nothing;
end;
$$;

revoke all on function public.record_site_visit(text) from public;
grant execute on function public.record_site_visit(text) to anon, authenticated;

create or replace function public.admin_visitor_stats(p_period text)
returns table(bucket_start timestamptz, visitors bigint, period_total bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_start timestamptz;
  v_step interval;
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  if p_period = 'today' then
    v_start := date_trunc('day', v_now);
    v_step := interval '1 hour';
    v_count := 24;
  elsif p_period = 'week' then
    v_start := date_trunc('day', v_now) - interval '6 days';
    v_step := interval '1 day';
    v_count := 7;
  elsif p_period = 'month' then
    v_start := date_trunc('day', v_now) - interval '29 days';
    v_step := interval '1 day';
    v_count := 30;
  elsif p_period = 'year' then
    v_start := date_trunc('month', v_now) - interval '11 months';
    v_step := interval '1 month';
    v_count := 12;
  else
    raise exception 'Invalid period';
  end if;

  return query
  with buckets as (
    select v_start + (g.i * v_step) as bucket_start
    from generate_series(0, v_count - 1) as g(i)
  ),
  grouped as (
    select
      case
        when p_period = 'today' then date_trunc('hour', d.visited_hour)
        when p_period = 'year' then date_trunc('month', d.visited_hour)
        else date_trunc('day', d.visited_hour)
      end as bucket_start,
      count(distinct d.visitor_hash)::bigint as visitors
    from public.site_visitor_hourly d
    where d.visited_hour >= v_start
      and d.visited_hour < (v_now + interval '1 hour')
    group by 1
  ),
  total as (
    select count(distinct d.visitor_hash)::bigint as n
    from public.site_visitor_hourly d
    where d.visited_hour >= v_start
      and d.visited_hour < (v_now + interval '1 hour')
  )
  select b.bucket_start, coalesce(g.visitors, 0)::bigint, total.n
  from buckets b
  left join grouped g on g.bucket_start = b.bucket_start
  cross join total
  order by b.bucket_start;
end;
$$;

revoke all on function public.admin_visitor_stats(text) from public;
grant execute on function public.admin_visitor_stats(text) to authenticated;

commit;
