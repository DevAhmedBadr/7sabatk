-- =====================================================================
-- 7sabatk Support System — Rollback (يحذف نظام الدعم الجديد فقط)
--
-- تحذير: هذا الملف يحذف كل التذاكر والرسائل والموظفين المضافين لنظام الدعم.
-- لا يلمس أي جدول أو دالة أو سياسة تخص الموقع الحالي
-- (profiles / listings / listing_fields / site_settings / is_admin ...).
-- شغّله فقط لو عايز ترجّع الموقع لحالته قبل نظام الدعم.
--
-- بعد تشغيله: احذف الـ bucket اسمه support-attachments من
-- Supabase → Storage يدويًا (Supabase يمنع حذفه بـ SQL).
-- =====================================================================
begin;

-- سياسات Storage الخاصة بالدعم
drop policy if exists support_attachments_storage_read   on storage.objects;
drop policy if exists support_attachments_storage_upload on storage.objects;

-- الجداول (الـ Triggers والسياسات والفهارس تُحذف معها)
drop table if exists public.support_ticket_reads   cascade;
drop table if exists public.support_email_log      cascade;
drop table if exists public.support_notifications  cascade;
drop table if exists public.support_ticket_events  cascade;
drop table if exists public.support_attachments    cascade;
drop table if exists public.support_messages       cascade;
drop table if exists public.support_tickets        cascade;
drop table if exists public.support_agents         cascade;
drop table if exists public.support_subcategories  cascade;
drop table if exists public.support_categories     cascade;

-- الدوال
drop function if exists public.support_create_ticket(bigint, bigint, text, text, text, uuid);
drop function if exists public.support_tickets_guard();
drop function if exists public.support_tickets_log_changes();
drop function if exists public.support_messages_prepare();
drop function if exists public.support_messages_after_insert();
drop function if exists public.support_attachments_prepare();
drop function if exists public.support_reads_touch();
drop function if exists public.support_touch_updated_at();
drop function if exists public.support_is_staff();
drop function if exists public.support_is_agent();
drop function if exists public.support_is_owner();
drop function if exists public.support_user_ok();
drop function if exists public.support_owner_id();

commit;
notify pgrst, 'reload schema';
