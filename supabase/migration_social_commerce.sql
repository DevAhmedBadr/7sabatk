-- Social services catalog, wallet ledger, cart checkout and owner administration.
-- Run once in the Supabase SQL Editor after the existing project migrations.
begin;

create or replace function public.is_social_store_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) = 'be398df3-3918-46e1-abc4-59975ffe716b'::uuid
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and coalesce(p.is_banned,false) = false);
$$;
revoke all on function public.is_social_store_owner() from public;
grant execute on function public.is_social_store_owner() to anon,authenticated;

create table if not exists public.social_service_categories (
  id uuid primary key default gen_random_uuid(), slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  name_ar text not null, name_en text not null, description_ar text not null default '', description_en text not null default '',
  brand text not null default 'generic' check (brand in ('tiktok','instagram','generic')),
  sort_order integer not null default 100, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.social_services (
  id uuid primary key default gen_random_uuid(), category_id uuid not null references public.social_service_categories(id) on delete cascade,
  name_ar text not null, name_en text not null, description_ar text not null default '', description_en text not null default '',
  price_per_1000_kwd numeric(12,3) not null default 0 check (price_per_1000_kwd >= 0),
  min_quantity integer not null default 100 check (min_quantity > 0), max_quantity integer not null default 10000,
  quantity_step integer not null default 1 check (quantity_step > 0), sort_order integer not null default 100,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (max_quantity >= min_quantity)
);
create index if not exists social_services_catalog_idx on public.social_services(category_id,is_active,sort_order);

create table if not exists public.wallet_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_kwd numeric(14,3) not null default 0 check (balance_kwd >= 0), updated_at timestamptz not null default now()
);
create table if not exists public.social_service_orders (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete restrict,
  total_kwd numeric(14,3) not null check (total_kwd > 0), status text not null default 'pending' check(status in ('pending','processing','completed','cancelled','refunded')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists social_service_orders_user_idx on public.social_service_orders(user_id,created_at desc);
create table if not exists public.social_service_order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.social_service_orders(id) on delete cascade,
  service_id uuid references public.social_services(id) on delete set null,
  service_name_ar text not null, service_name_en text not null, quantity integer not null check(quantity > 0),
  target_url text not null, unit_price_per_1000_kwd numeric(12,3) not null, line_total_kwd numeric(14,3) not null
);
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete restrict,
  amount_kwd numeric(14,3) not null check(amount_kwd <> 0), balance_after_kwd numeric(14,3) not null check(balance_after_kwd >= 0),
  transaction_type text not null check(transaction_type in ('topup','purchase','refund','admin_credit')),
  note text not null default '', order_id uuid references public.social_service_orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists wallet_transactions_user_idx on public.wallet_transactions(user_id,created_at desc);

alter table public.social_service_categories enable row level security;
alter table public.social_services enable row level security;
alter table public.wallet_balances enable row level security;
alter table public.social_service_orders enable row level security;
alter table public.social_service_order_items enable row level security;
alter table public.wallet_transactions enable row level security;

drop policy if exists social_categories_public_read on public.social_service_categories;
create policy social_categories_public_read on public.social_service_categories for select to anon,authenticated using (is_active or public.is_social_store_owner());
drop policy if exists social_categories_owner_manage on public.social_service_categories;
create policy social_categories_owner_manage on public.social_service_categories for all to authenticated using (public.is_social_store_owner()) with check (public.is_social_store_owner());
drop policy if exists social_services_public_read on public.social_services;
create policy social_services_public_read on public.social_services for select to anon,authenticated using (
  (is_active and exists(select 1 from public.social_service_categories c where c.id=category_id and c.is_active)) or public.is_social_store_owner()
);
drop policy if exists social_services_owner_manage on public.social_services;
create policy social_services_owner_manage on public.social_services for all to authenticated using (public.is_social_store_owner()) with check (public.is_social_store_owner());
drop policy if exists wallet_balances_read on public.wallet_balances;
create policy wallet_balances_read on public.wallet_balances for select to authenticated using (user_id=(select auth.uid()) or public.is_social_store_owner());
drop policy if exists social_orders_read on public.social_service_orders;
create policy social_orders_read on public.social_service_orders for select to authenticated using (user_id=(select auth.uid()) or public.is_social_store_owner());
drop policy if exists social_orders_owner_update on public.social_service_orders;
create policy social_orders_owner_update on public.social_service_orders for update to authenticated using (public.is_social_store_owner()) with check (public.is_social_store_owner());
drop policy if exists social_order_items_read on public.social_service_order_items;
create policy social_order_items_read on public.social_service_order_items for select to authenticated using (
  public.is_social_store_owner() or exists(select 1 from public.social_service_orders o where o.id=order_id and o.user_id=(select auth.uid()))
);
drop policy if exists wallet_transactions_read on public.wallet_transactions;
create policy wallet_transactions_read on public.wallet_transactions for select to authenticated using (user_id=(select auth.uid()) or public.is_social_store_owner());

create or replace function public.get_my_wallet_balance()
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_balance numeric(14,3);
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  insert into public.wallet_balances(user_id,balance_kwd) values ((select auth.uid()),0) on conflict(user_id) do nothing;
  select balance_kwd into v_balance from public.wallet_balances where user_id=(select auth.uid());
  return v_balance;
end; $$;
revoke all on function public.get_my_wallet_balance() from public;
grant execute on function public.get_my_wallet_balance() to authenticated;

create or replace function public.purchase_social_services(p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_item jsonb; v_service public.social_services%rowtype; v_category public.social_service_categories%rowtype;
  v_qty integer; v_target text; v_total numeric(14,3):=0; v_line numeric(14,3); v_order uuid; v_balance numeric(14,3);
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Cart must be a JSON array'; end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items)>25 then raise exception 'Cart must contain 1 to 25 items'; end if;
  insert into public.wallet_balances(user_id,balance_kwd) values(v_user,0) on conflict(user_id) do nothing;
  -- Lock wallet first; each product price and availability is read from trusted database rows.
  select balance_kwd into v_balance from public.wallet_balances where user_id=v_user for update;
  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_service from public.social_services where id=(v_item->>'service_id')::uuid and is_active for share;
    if not found then raise exception 'One of the selected services is unavailable'; end if;
    select * into v_category from public.social_service_categories where id=v_service.category_id and is_active for share;
    if not found then raise exception 'One of the selected categories is unavailable'; end if;
    v_qty := (v_item->>'quantity')::integer; v_target := trim(v_item->>'target_url');
    if v_service.price_per_1000_kwd <= 0 then raise exception 'This service is not priced yet'; end if;
    if v_qty < v_service.min_quantity or v_qty > v_service.max_quantity or mod(v_qty-v_service.min_quantity,v_service.quantity_step)<>0 then raise exception 'Quantity is outside the allowed range'; end if;
    if v_target is null or length(v_target)>2048 or v_target !~* '^https?://' then raise exception 'Enter a valid public URL'; end if;
    v_line := round(v_service.price_per_1000_kwd*v_qty/1000,3);
    if v_line <= 0 then raise exception 'This service total is below the supported currency precision'; end if;
    v_total := v_total + v_line;
  end loop;
  v_total := round(v_total,3);
  if v_balance < v_total then raise exception 'Insufficient wallet balance. Required: %, available: %',v_total,v_balance; end if;
  insert into public.social_service_orders(user_id,total_kwd) values(v_user,v_total) returning id into v_order;
  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_service from public.social_services where id=(v_item->>'service_id')::uuid;
    v_qty := (v_item->>'quantity')::integer; v_line := round(v_service.price_per_1000_kwd*v_qty/1000,3);
    insert into public.social_service_order_items(order_id,service_id,service_name_ar,service_name_en,quantity,target_url,unit_price_per_1000_kwd,line_total_kwd)
      values(v_order,v_service.id,v_service.name_ar,v_service.name_en,v_qty,trim(v_item->>'target_url'),v_service.price_per_1000_kwd,v_line);
  end loop;
  update public.wallet_balances set balance_kwd=balance_kwd-v_total,updated_at=now() where user_id=v_user returning balance_kwd into v_balance;
  insert into public.wallet_transactions(user_id,amount_kwd,balance_after_kwd,transaction_type,note,order_id)
    values(v_user,-v_total,v_balance,'purchase','Social services order',v_order);
  return jsonb_build_object('order_id',v_order,'total_kwd',v_total,'balance_kwd',v_balance);
end; $$;
revoke all on function public.purchase_social_services(jsonb) from public;
grant execute on function public.purchase_social_services(jsonb) to authenticated;

create or replace function public.admin_credit_wallet(p_user_id uuid,p_amount numeric,p_note text default '')
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_balance numeric(14,3);
begin
  if not public.is_social_store_owner() then raise exception 'Owner access required'; end if;
  if p_user_id is null or p_amount is null or p_amount <= 0 or p_amount > 10000 then raise exception 'Enter a valid credit amount'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'User not found'; end if;
  insert into public.wallet_balances(user_id,balance_kwd) values(p_user_id,0) on conflict(user_id) do nothing;
  update public.wallet_balances set balance_kwd=balance_kwd+round(p_amount,3),updated_at=now() where user_id=p_user_id returning balance_kwd into v_balance;
  insert into public.wallet_transactions(user_id,amount_kwd,balance_after_kwd,transaction_type,note)
    values(p_user_id,round(p_amount,3),v_balance,'admin_credit',coalesce(nullif(trim(p_note),''),'Owner wallet credit'));
  return v_balance;
end; $$;
revoke all on function public.admin_credit_wallet(uuid,numeric,text) from public;
grant execute on function public.admin_credit_wallet(uuid,numeric,text) to authenticated;

insert into public.social_service_categories(slug,name_ar,name_en,description_ar,description_en,brand,sort_order)
values
 ('tiktok','خدمات تيك توك','TikTok services','خدمات نمو وتفاعل لحسابات ومقاطع تيك توك.','Growth and engagement services for TikTok accounts and videos.','tiktok',10),
 ('instagram','خدمات إنستجرام','Instagram services','خدمات نمو وتفاعل لحسابات ومنشورات إنستجرام.','Growth and engagement services for Instagram accounts and posts.','instagram',20)
on conflict(slug) do nothing;
insert into public.social_services(category_id,name_ar,name_en,description_ar,description_en,sort_order)
select c.id,v.name_ar,v.name_en,v.description_ar,v.description_en,v.sort_order
from (values
 ('tiktok','زيادة المتابعين','Followers','زيادة عدد المتابعين لحساب تيك توك.','Grow a TikTok account audience.',10),
 ('tiktok','زيادة لايكات الفيديو','Video likes','زيادة الإعجابات على مقاطع تيك توك.','Increase likes on TikTok videos.',20),
 ('tiktok','زيادة مشاهدات الفيديو','Video views','زيادة مشاهدات مقاطع تيك توك.','Increase views on TikTok videos.',30),
 ('tiktok','زيادة مشاركات الفيديو','Video shares','زيادة مشاركات مقاطع تيك توك.','Increase shares on TikTok videos.',40),
 ('instagram','زيادة المتابعين','Followers','زيادة عدد المتابعين لحساب إنستجرام.','Grow an Instagram account audience.',10),
 ('instagram','زيادة لايكات المنشورات والريلز','Post & Reel likes','زيادة الإعجابات على منشورات وريلز إنستجرام.','Increase likes on Instagram posts and Reels.',20),
 ('instagram','زيادة مشاهدات الفيديو','Video views','زيادة مشاهدات فيديوهات وريلز إنستجرام.','Increase views on Instagram videos and Reels.',30),
 ('instagram','زيادة مشاركات الفيديو','Video shares','زيادة مشاركات فيديوهات إنستجرام.','Increase shares on Instagram videos.',40)
) as v(slug,name_ar,name_en,description_ar,description_en,sort_order)
join public.social_service_categories c on c.slug=v.slug
where not exists(select 1 from public.social_services s where s.category_id=c.id and s.name_en=v.name_en);

grant select on public.social_service_categories,public.social_services to anon,authenticated;
grant insert,update,delete on public.social_service_categories,public.social_services to authenticated;
grant select on public.wallet_balances,public.social_service_orders,public.social_service_order_items,public.wallet_transactions to authenticated;
grant update (status) on table public.social_service_orders to authenticated;
commit;
