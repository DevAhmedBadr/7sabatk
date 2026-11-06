-- 7sabatk Support System — المرحلة 4 / حماية رفع وقراءة مرفقات العميل
-- شغّله مرة واحدة بعد ملفات المرحلة الثانية وقبل تفعيل رفع المرفقات.
-- يزيل سياسات التخزين القديمة المتساهلة التي قد تكشف ملفات الملاحظات الداخلية.
begin;

drop policy if exists support_objects_read on storage.objects;
drop policy if exists support_objects_insert on storage.objects;
drop policy if exists support_objects_delete on storage.objects;
drop policy if exists support_attachments_storage_read on storage.objects;
drop policy if exists support_attachments_storage_upload on storage.objects;

create policy support_attachments_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'support-attachments'
    and (
      (select public.support_is_staff())
      or exists (
        select 1
        from public.support_attachments a
        join public.support_tickets t on t.id = a.ticket_id
        join public.support_messages m on m.id = a.message_id
        where a.file_path = objects.name
          and t.user_id = (select auth.uid())
          and m.is_internal = false
      )
    )
  );

create policy support_attachments_storage_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'support-attachments'
    and (select public.support_user_ok())
    and exists (
      select 1 from public.support_tickets t
      where t.id::text = (storage.foldername(objects.name))[1]
        and (t.user_id = (select auth.uid()) or (select public.support_is_staff()))
    )
  );

notify pgrst, 'reload schema';
commit;
