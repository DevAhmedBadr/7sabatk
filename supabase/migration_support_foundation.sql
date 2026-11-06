-- Additive, re-runnable support ticket foundation. Back up the live project first.
-- order_id is intentionally nullable without a foreign key: the supplied project
-- contains no orders schema, so the target must be confirmed against live Supabase.
begin;

create sequence if not exists public.support_ticket_number_seq;
create or replace function public.next_support_ticket_number()
returns text language sql volatile set search_path = '' as $$
  select '7S-' || lpad(nextval('public.support_ticket_number_seq'::regclass)::text, 8, '0');
$$;
revoke all on function public.next_support_ticket_number() from public, anon, authenticated;
grant execute on function public.next_support_ticket_number() to authenticated;

create or replace function public.is_support_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin', 'support_agent')
      and coalesce(p.is_banned, false) = false
  );
$$;
revoke all on function public.is_support_staff() from public;
grant execute on function public.is_support_staff() to authenticated;

create table if not exists public.support_categories (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null check (length(btrim(name_ar)) > 0),
  name_en text not null check (length(btrim(name_en)) > 0),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.support_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.support_categories(id) on delete restrict,
  name_ar text not null check (length(btrim(name_ar)) > 0),
  name_en text not null check (length(btrim(name_en)) > 0),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique (category_id, name_ar), unique (category_id, name_en)
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default public.next_support_ticket_number(),
  user_id uuid not null references auth.users(id) on delete restrict,
  order_id uuid,
  category_id uuid references public.support_categories(id) on delete set null,
  subcategory_id uuid references public.support_subcategories(id) on delete set null,
  subject text not null check (length(btrim(subject)) > 0),
  status text not null default 'open' check (status in ('open','answered','waiting_customer','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_agent_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  sender_role text not null check (sender_role in ('customer','support_agent','admin')),
  message text not null check (length(btrim(message)) > 0),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  message_id uuid references public.support_messages(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  file_name text not null check (length(btrim(file_name)) > 0),
  file_path text not null unique,
  file_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_user_created_idx on public.support_tickets(user_id, created_at desc);
create index if not exists support_tickets_status_updated_idx on public.support_tickets(status, updated_at desc);
create index if not exists support_tickets_assignee_status_idx on public.support_tickets(assigned_agent_id, status, updated_at desc);
create index if not exists support_messages_ticket_created_idx on public.support_messages(ticket_id, created_at);
create index if not exists support_attachments_ticket_idx on public.support_attachments(ticket_id, created_at);
create index if not exists support_subcategories_category_order_idx on public.support_subcategories(category_id, sort_order);

alter table public.support_categories enable row level security;
alter table public.support_subcategories enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_attachments enable row level security;

revoke all on public.support_categories, public.support_subcategories, public.support_tickets,
  public.support_messages, public.support_attachments from public, anon;
grant select on public.support_categories, public.support_subcategories to authenticated;
grant insert, update, delete on public.support_categories, public.support_subcategories to authenticated;
grant insert, select, update on public.support_tickets to authenticated;
grant insert, select on public.support_messages, public.support_attachments to authenticated;
grant usage, select on sequence public.support_ticket_number_seq to authenticated;

drop policy if exists support_categories_read on public.support_categories;
create policy support_categories_read on public.support_categories for select to authenticated
  using (is_active or (select public.is_support_staff()));
drop policy if exists support_categories_staff_manage on public.support_categories;
create policy support_categories_staff_manage on public.support_categories for all to authenticated
  using ((select public.is_support_staff())) with check ((select public.is_support_staff()));
drop policy if exists support_subcategories_read on public.support_subcategories;
create policy support_subcategories_read on public.support_subcategories for select to authenticated
  using (is_active or (select public.is_support_staff()));
drop policy if exists support_subcategories_staff_manage on public.support_subcategories;
create policy support_subcategories_staff_manage on public.support_subcategories for all to authenticated
  using ((select public.is_support_staff())) with check ((select public.is_support_staff()));

drop policy if exists support_tickets_customer_or_staff_read on public.support_tickets;
create policy support_tickets_customer_or_staff_read on public.support_tickets for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_support_staff()));
drop policy if exists support_tickets_customer_create on public.support_tickets;
create policy support_tickets_customer_create on public.support_tickets for insert to authenticated
  with check (
    user_id = (select auth.uid()) and assigned_agent_id is null and status = 'open' and priority = 'normal'
    and (category_id is null or exists (select 1 from public.support_categories c
      where c.id = category_id and c.is_active))
    and (subcategory_id is null or exists (select 1 from public.support_subcategories s
      where s.id = subcategory_id and s.is_active and s.category_id = category_id))
  );
drop policy if exists support_tickets_staff_update on public.support_tickets;
create policy support_tickets_staff_update on public.support_tickets for update to authenticated
  using ((select public.is_support_staff())) with check ((select public.is_support_staff()));

drop policy if exists support_messages_read on public.support_messages;
create policy support_messages_read on public.support_messages for select to authenticated using (
  (not is_internal and exists (select 1 from public.support_tickets t
    where t.id = ticket_id and t.user_id = (select auth.uid())))
  or (select public.is_support_staff())
);
drop policy if exists support_messages_customer_insert on public.support_messages;
create policy support_messages_customer_insert on public.support_messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and sender_role = 'customer' and not is_internal
  and exists (select 1 from public.support_tickets t
    where t.id = ticket_id and t.user_id = (select auth.uid()) and t.status <> 'closed')
);
drop policy if exists support_messages_staff_insert on public.support_messages;
create policy support_messages_staff_insert on public.support_messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and (select public.is_support_staff())
  and sender_role in ('support_agent','admin')
);

drop policy if exists support_attachments_read on public.support_attachments;
create policy support_attachments_read on public.support_attachments for select to authenticated using (
  (select public.is_support_staff()) or exists (select 1 from public.support_tickets t
    where t.id = ticket_id and t.user_id = (select auth.uid()))
);
drop policy if exists support_attachments_insert on public.support_attachments;
create policy support_attachments_insert on public.support_attachments for insert to authenticated with check (
  uploaded_by = (select auth.uid()) and exists (select 1 from public.support_tickets t
    where t.id = ticket_id and (t.user_id = (select auth.uid()) or (select public.is_support_staff())))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-attachments','support-attachments',false,10485760,
  array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists support_objects_read on storage.objects;
create policy support_objects_read on storage.objects for select to authenticated using (
  bucket_id = 'support-attachments' and ((select public.is_support_staff()) or exists (
    select 1 from public.support_tickets t where t.id::text = (storage.foldername(name))[1]
      and t.user_id = (select auth.uid())))
);
drop policy if exists support_objects_insert on storage.objects;
create policy support_objects_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'support-attachments' and exists (select 1 from public.support_tickets t
    where t.id::text = (storage.foldername(name))[1]
      and (t.user_id = (select auth.uid()) or (select public.is_support_staff())))
);
drop policy if exists support_objects_delete on storage.objects;
create policy support_objects_delete on storage.objects for delete to authenticated using (
  bucket_id = 'support-attachments' and ((select public.is_support_staff()) or exists (
    select 1 from public.support_tickets t where t.id::text = (storage.foldername(name))[1]
      and t.user_id = (select auth.uid())))
);

notify pgrst, 'reload schema';
commit;
