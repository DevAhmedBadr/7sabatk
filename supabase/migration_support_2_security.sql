-- =====================================================================
-- 7sabatk Support System — المرحلة 2 / الملف 2 من 3
-- سياسات RLS + الصلاحيات + Storage خاص للمرفقات + Realtime
--
-- يعمل فقط على جداول support_* الجديدة وعلى bucket جديد اسمه support-attachments.
-- لا يلمس أي سياسة أو جدول أو bucket موجود (profiles / listings / avatars ...).
-- شغّله بعد الملف 1.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1) تفعيل RLS وسحب الصلاحيات الافتراضية (Supabase يمنح الصلاحيات تلقائيًا للجداول الجديدة)
-- ---------------------------------------------------------------------
alter table public.support_categories     enable row level security;
alter table public.support_subcategories  enable row level security;
alter table public.support_agents         enable row level security;
alter table public.support_tickets        enable row level security;
alter table public.support_messages       enable row level security;
alter table public.support_attachments    enable row level security;
alter table public.support_ticket_events  enable row level security;
alter table public.support_notifications  enable row level security;
alter table public.support_email_log      enable row level security;
alter table public.support_ticket_reads   enable row level security;

revoke all on public.support_categories     from public, anon, authenticated;
revoke all on public.support_subcategories  from public, anon, authenticated;
revoke all on public.support_agents         from public, anon, authenticated;
revoke all on public.support_tickets        from public, anon, authenticated;
revoke all on public.support_messages       from public, anon, authenticated;
revoke all on public.support_attachments    from public, anon, authenticated;
revoke all on public.support_ticket_events  from public, anon, authenticated;
revoke all on public.support_notifications  from public, anon, authenticated;
revoke all on public.support_email_log      from public, anon, authenticated;
revoke all on public.support_ticket_reads   from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) الفئات والفئات الفرعية
--    الجميع (مسجّل دخول) يرى النشط فقط، الموظفون يرون الكل، المدير الرئيسي وحده يعدّل.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.support_categories    to authenticated;
grant select, insert, update, delete on public.support_subcategories to authenticated;

drop policy if exists support_categories_read on public.support_categories;
create policy support_categories_read on public.support_categories
  for select to authenticated
  using (is_active or (select public.support_is_staff()));

drop policy if exists support_categories_owner_write on public.support_categories;
create policy support_categories_owner_write on public.support_categories
  for all to authenticated
  using ((select public.support_is_owner()))
  with check ((select public.support_is_owner()));

drop policy if exists support_subcategories_read on public.support_subcategories;
create policy support_subcategories_read on public.support_subcategories
  for select to authenticated
  using (is_active or (select public.support_is_staff()));

drop policy if exists support_subcategories_owner_write on public.support_subcategories;
create policy support_subcategories_owner_write on public.support_subcategories
  for all to authenticated
  using ((select public.support_is_owner()))
  with check ((select public.support_is_owner()));

-- ---------------------------------------------------------------------
-- 3) موظفو الدعم: المدير الرئيسي وحده يضيف/يعدّل/يحذف. الموظف يرى صفّه فقط.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.support_agents to authenticated;

drop policy if exists support_agents_read on public.support_agents;
create policy support_agents_read on public.support_agents
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.support_is_owner()));

drop policy if exists support_agents_owner_write on public.support_agents;
create policy support_agents_owner_write on public.support_agents
  for all to authenticated
  using ((select public.support_is_owner()))
  with check ((select public.support_is_owner()));

-- ---------------------------------------------------------------------
-- 4) التذاكر
--    العميل: يقرأ تذاكره فقط، ولا يعدّل ولا ينشئ مباشرة (الإنشاء عبر support_create_ticket).
--    الموظفون: يقرؤون الكل ويعدّلون (الحالة/الأولوية/التعيين/الفئة) فقط.
-- ---------------------------------------------------------------------
grant select on public.support_tickets to authenticated;
grant update (status, priority, assigned_agent_id, category_id, subcategory_id)
  on public.support_tickets to authenticated;

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.support_is_staff()));

drop policy if exists support_tickets_staff_update on public.support_tickets;
create policy support_tickets_staff_update on public.support_tickets
  for update to authenticated
  using ((select public.support_is_staff()))
  with check ((select public.support_is_staff()));

-- ---------------------------------------------------------------------
-- 4.b الرسائل: العميل يرى غير الداخلية في تذاكره فقط، ويرسل رسائل غير داخلية في تذاكره.
--      لا تعديل ولا حذف للرسائل من العميل أو الموظف.
-- ---------------------------------------------------------------------
grant select on public.support_messages to authenticated;
grant insert (ticket_id, message, is_internal, client_request_id) on public.support_messages to authenticated;

drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages
  for select to authenticated
  using (
    (select public.support_is_staff())
    or (
      is_internal = false
      and exists (
        select 1 from public.support_tickets t
        where t.id = support_messages.ticket_id
          and t.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert on public.support_messages
  for insert to authenticated
  with check (
    (select public.support_user_ok())
    and (
      (select public.support_is_staff())
      or (
        is_internal = false
        and exists (
          select 1 from public.support_tickets t
          where t.id = support_messages.ticket_id
            and t.user_id = (select auth.uid())
        )
      )
    )
  );

-- ---------------------------------------------------------------------
-- 4.c المرفقات: العميل يرى مرفقات رسائله/رسائل الموظفين العامة في تذاكره فقط.
--      مرفقات الملاحظات الداخلية لا تظهر له أبدًا (لأن رسالتها داخلية).
-- ---------------------------------------------------------------------
grant select on public.support_attachments to authenticated;
grant insert (ticket_id, message_id, file_name, file_path, file_type, file_size)
  on public.support_attachments to authenticated;

drop policy if exists support_attachments_select on public.support_attachments;
create policy support_attachments_select on public.support_attachments
  for select to authenticated
  using (
    (select public.support_is_staff())
    or (
      exists (
        select 1 from public.support_tickets t
        where t.id = support_attachments.ticket_id
          and t.user_id = (select auth.uid())
      )
      and exists (
        select 1 from public.support_messages m
        where m.id = support_attachments.message_id
          and m.is_internal = false
      )
    )
  );

drop policy if exists support_attachments_insert on public.support_attachments;
create policy support_attachments_insert on public.support_attachments
  for insert to authenticated
  with check (
    (select public.support_user_ok())
    and (
      (select public.support_is_staff())
      or exists (
        select 1 from public.support_tickets t
        where t.id = support_attachments.ticket_id
          and t.user_id = (select auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------
-- 5) سجل التغييرات: الموظفون فقط، قراءة فقط (يُكتب بالـ Triggers)
-- ---------------------------------------------------------------------
grant select on public.support_ticket_events to authenticated;

drop policy if exists support_events_staff_read on public.support_ticket_events;
create policy support_events_staff_read on public.support_ticket_events
  for select to authenticated
  using ((select public.support_is_staff()));

-- ---------------------------------------------------------------------
-- 6) الإشعارات الداخلية: كل مستخدم يقرأ ويعلّم إشعاراته فقط (الإنشاء من الخادم)
-- ---------------------------------------------------------------------
grant select on public.support_notifications to authenticated;
grant update (is_read, read_at) on public.support_notifications to authenticated;

drop policy if exists support_notifications_select on public.support_notifications;
create policy support_notifications_select on public.support_notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists support_notifications_update on public.support_notifications;
create policy support_notifications_update on public.support_notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 7) سجل البريد: المدير الرئيسي يقرأ فقط. الكتابة من Edge Function بمفتاح الخدمة.
-- ---------------------------------------------------------------------
grant select on public.support_email_log to authenticated;

drop policy if exists support_email_log_owner_read on public.support_email_log;
create policy support_email_log_owner_read on public.support_email_log
  for select to authenticated
  using ((select public.support_is_owner()));

-- ---------------------------------------------------------------------
-- 8) تتبع القراءة: كل مستخدم يدير صفوفه فقط وفي تذاكر يستطيع رؤيتها
-- ---------------------------------------------------------------------
grant select, insert, update on public.support_ticket_reads to authenticated;

drop policy if exists support_reads_own on public.support_ticket_reads;
create policy support_reads_own on public.support_ticket_reads
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.support_tickets t where t.id = support_ticket_reads.ticket_id)
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.support_tickets t where t.id = support_ticket_reads.ticket_id)
  );

-- ---------------------------------------------------------------------
-- 9) Storage: bucket خاص للمرفقات (5MB، JPG/PNG/PDF).
--    المسار: <ticket_id>/<اسم-الملف>. القراءة بـ Signed URL فقط.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-attachments', 'support-attachments', false, 5242880,
        array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'application/pdf'];

drop policy if exists support_attachments_storage_read on storage.objects;
create policy support_attachments_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'support-attachments'
    and (
      (select public.support_is_staff())
      or exists (
        select 1 from public.support_attachments a
        where a.file_path = objects.name
      )
    )
  );

drop policy if exists support_attachments_storage_upload on storage.objects;
create policy support_attachments_storage_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'support-attachments'
    and (select public.support_user_ok())
    and exists (
      select 1 from public.support_tickets t
      where t.id::text = (storage.foldername(objects.name))[1]
    )
  );

-- ---------------------------------------------------------------------
-- 10) Realtime: الرسائل والتذاكر والإشعارات (Realtime يحترم RLS لكل مشترك)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['support_messages', 'support_tickets', 'support_notifications'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

commit;
notify pgrst, 'reload schema';
