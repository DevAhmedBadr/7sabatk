-- 7sabatk: product-type-specific custom fields and bilingual listing descriptions.
-- Safe to run on an existing project; does not delete or rewrite existing listings.
begin;

alter table public.listings
  add column if not exists description_ar text,
  add column if not exists description_en text;

-- Preserve legacy description as Arabic fallback for existing products.
update public.listings
set description_ar = description
where description_ar is null and description is not null;

alter table public.listing_fields
  add column if not exists product_type text not null default 'account';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'listing_fields_product_type_check'
      and conrelid = 'public.listing_fields'::regclass
  ) then
    alter table public.listing_fields
      add constraint listing_fields_product_type_check
      check (product_type in ('account', 'subscription'));
  end if;
end $$;

create index if not exists listing_fields_product_type_scope_sort_idx
  on public.listing_fields (product_type, platform_key, sort_order);

notify pgrst, 'reload schema';
commit;
