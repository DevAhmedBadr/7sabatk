-- 7sabatk: add a separate type for account listings and digital subscriptions.
-- Run once in Supabase SQL Editor before deploying the updated website.
begin;

alter table public.listings
  add column if not exists product_type text not null default 'account';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'listings_product_type_check'
      and conrelid = 'public.listings'::regclass
  ) then
    alter table public.listings
      add constraint listings_product_type_check
      check (product_type in ('account', 'subscription'));
  end if;
end $$;

update public.listings
set product_type = 'account'
where product_type is null or product_type = '';

create index if not exists listings_public_type_status_created_idx
  on public.listings (product_type, status, created_at desc);

notify pgrst, 'reload schema';
commit;
