-- 7sabatk: migration for the EXISTING schema created in the guided setup.
-- Run this once in Supabase SQL Editor. Do NOT run the old template setup.sql.

-- The admin dashboard displays email addresses; store a copy in profiles.
alter table public.profiles add column if not exists email text;
alter table public.listings add column if not exists engagement text;

-- Backfill the existing account (including the first admin) from Supabase Auth.
update public.profiles p
set email = u.email,
    full_name = coalesce(nullif(p.full_name, ''), u.raw_user_meta_data ->> 'full_name')
from auth.users u
where p.id = u.id;

-- Keep profile email/name populated for future signups without changing their role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'full_name',
    new.email
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

-- Public settings used by the website. Values are JSON, not secrets.
insert into public.site_settings (key, value) values
  ('site_name', '"7sabatk"'::jsonb),
  ('default_currency', '"KWD"'::jsonb),
  ('whatsapp_number', '""'::jsonb),
  ('contact_email', '""'::jsonb),
  ('announcement_text', '""'::jsonb),
  ('announcement_enabled', 'false'::jsonb),
  ('maintenance_mode', 'false'::jsonb),
  ('show_unavailable', 'true'::jsonb)
on conflict (key) do nothing;

-- Existing policies from the guided setup remain in force:
-- profiles: users see/update their own safe profile fields; admins see all.
-- listings: public can read published rows; admins can write.
-- site_settings: public can read; admins can write.
-- Storage bucket listing-images: public read; admin-only upload/update/delete.
