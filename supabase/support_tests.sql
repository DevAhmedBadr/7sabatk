-- =====================================================================
-- 7sabatk Support System — اختبار الصلاحيات (المرحلة 2)
--
-- يحاكي 4 حسابات حقيقية من قاعدتك: المدير الرئيسي، عميلين، وموظف دعم مرشّح.
-- كل شيء يتم داخل Transaction ويتم التراجع عنه تلقائيًا في النهاية،
-- فلا يبقى أي تذكرة أو موظف أو بيانات اختبار في القاعدة.
--
-- طريقة التشغيل: الصق الملف كاملًا في Supabase → SQL Editor واضغط Run.
-- النتيجة تظهر كرسالة "خطأ" تبدأ بـ SUPPORT_TESTS_RESULT — ده مقصود (هو اللي بيلغي التغييرات).
--   ✔ "SUPPORT_TESTS_RESULT: 30/30 passed"  = كل الاختبارات نجحت.
--   ✗ لو فيه اختبار فشل، هيظهر اسمه في الرسالة.
--
-- الـ UUIDs تحت مأخوذة من جدول profiles عندك (ahmed = المدير، test + حسابين user).
-- لو حبيت تغيّرها استخدم: select id, email, role from public.profiles;
-- =====================================================================
do $$
declare
  c_owner  constant uuid := 'be398df3-3918-46e1-abc4-59975ffe716b';  -- المدير الرئيسي
  c_cust_a constant uuid := 'b64e00f4-73f0-41e6-b06f-61cf8e9c06bc';  -- عميل A
  c_cust_b constant uuid := '9c9a11e3-7b95-431a-91c0-3ceb31ea8bf7';  -- عميل B
  c_agent  constant uuid := 'eb27ebc1-c48b-4e7b-9329-209746f9cf9d';  -- موظف دعم (مؤقتًا للاختبار)

  v_req        uuid := gen_random_uuid();
  v_cat        bigint;
  v_ticket     uuid;
  v_ticket2    uuid;
  v_msg        bigint;
  v_agent_msg  bigint;
  v_note       bigint;
  v_role       text;
  v_status     text;
  v_closed     timestamptz;
  n            bigint;
  failed       boolean;
  v_ok         int := 0;
  v_total      int := 0;
  v_log        text := '';
begin
  ---------------------------------------------------------------- تجهيز (بصلاحية المحرر)
  if (select count(*) from public.profiles where id in (c_owner, c_cust_a, c_cust_b, c_agent)) <> 4 then
    raise exception 'SETUP: واحد من الـ UUIDs غير موجود في profiles';
  end if;
  select id into v_cat from public.support_categories where slug = 'orders_human_support';
  if v_cat is null then
    raise exception 'SETUP: شغّل migration_support_3_seed_categories.sql الأول';
  end if;
  insert into public.support_agents (user_id, added_by) values (c_agent, c_owner)
    on conflict (user_id) do update set is_active = true;

  ---------------------------------------------------------------- العميل A
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c_cust_a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', c_cust_a::text, true);
  set local role authenticated;

  select r.out_ticket_id, r.out_message_id into v_ticket, v_msg
    from public.support_create_ticket(v_cat, null, 'TEST-ORDER-1', 'اختبار', 'رسالة اختبار', v_req) r;
  v_total := v_total + 1;
  if v_ticket is not null and v_msg is not null then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 01 إنشاء تذكرة + أول رسالة'; end if;

  select r.out_ticket_id into v_ticket2
    from public.support_create_ticket(v_cat, null, 'TEST-ORDER-1', 'اختبار', 'رسالة اختبار', v_req) r;
  select count(*) into n from public.support_tickets where client_request_id = v_req;
  v_total := v_total + 1;
  if v_ticket2 = v_ticket and n = 1 then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 02 منع الإرسال المكرر'; end if;

  select count(*) into n from public.support_messages where ticket_id = v_ticket;
  v_total := v_total + 1;
  if n = 1 then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 03 العميل يرى رسالته'; end if;

  failed := false;
  begin
    insert into public.support_messages (ticket_id, message, is_internal) values (v_ticket, 'x', true);
  exception when others then failed := true; end;
  v_total := v_total + 1;
  if failed then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 04 العميل لا يستطيع إرسال ملاحظة داخلية'; end if;

  update public.support_tickets set status = 'closed' where id = v_ticket;
  get diagnostics n = row_count;
  v_total := v_total + 1;
  if n = 0 then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 05 العميل لا يعدّل حالة التذكرة'; end if;

  failed := false;
  begin
    insert into public.support_tickets (user_id, category_id, subject) values (c_cust_a, v_cat, 'x');
  exception when others then failed := true; end;
  v_total := v_total + 1;
  if failed then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 06 العميل لا ينشئ تذكرة بإدخال مباشر'; end if;

  failed := false;
  begin
    insert into public.support_agents (user_id) values (c_cust_a);
  exception when others then failed := true; end;
  v_total := v_total + 1;
  if failed then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 07 العميل لا يضيف نفسه موظف دعم'; end if;

  select count(*) into n from public.support_agents;
  v_total := v_total + 1;
  if n = 0 then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 08 العميل لا يرى جدول الموظفين'; end if;

  select (select count(*) from public.support_ticket_events) + (select count(*) from public.support_email_log) into n;
  v_total := v_total + 1;
  if n = 0 then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 09 العميل لا يرى سجل التغييرات ولا سجل البريد'; end if;

  ---------------------------------------------------------------- العميل B (غريب عن التذكرة)
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c_cust_b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', c_cust_b::text, true);
  set local role authenticated;

  select (select count(*) from public.support_tickets where id = v_ticket)
       + (select count(*) from public.support_messages where ticket_id = v_ticket) into n;
  v_total := v_total + 1;
  if n = 0 then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 10 عميل آخر لا يرى تذكرة غيره'; end if;

  failed := false;
  begin
    insert into public.support_messages (ticket_id, message) values (v_ticket, 'تطفل');
  exception when others then failed := true; end;
  v_total := v_total + 1;
  if failed then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 11 عميل آخر لا يرد على تذكرة غيره'; end if;

  update public.support_tickets set status = 'resolved' where id = v_ticket;
  get diagnostics n = row_count;
  v_total := v_total + 1;
  if n = 0 then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 12 عميل آخر لا يعدّل تذكرة غيره'; end if;

  ---------------------------------------------------------------- موظف الدعم
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c_agent, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', c_agent::text, true);
  set local role authenticated;

  select count(*) into n from public.support_tickets where id = v_ticket;
  v_total := v_total + 1;
  if n = 1 then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 13 الموظف يرى التذكرة'; end if;

  failed := false;
  begin
    insert into public.support_messages (ticket_id, message, is_internal)
      values (v_ticket, 'ملاحظة داخلية', true) returning id into v_note;
  exception when others then failed := true; end;
  v_total := v_total + 1;
  if not failed then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 14 الموظف يضيف ملاحظة داخلية'; end if;

  failed := false;
  begin
    insert into public.support_messages (ticket_id, message, is_internal)
      values (v_ticket, 'رد الدعم', false) returning id into v_agent_msg;
  exception when others then failed := true; end;
  select status into v_status from public.support_tickets where id = v_ticket;
  select sender_role into v_role from public.support_messages where id = v_agent_msg;
  v_total := v_total + 1;
  if not failed and v_status = 'in_progress' and v_role = 'agent' then v_ok := v_ok + 1;
  else v_log := v_log || E'\n✗ 15 رد الموظف (الدور agent + الحالة in_progress تلقائيًا)'; end if;

  update public.support_tickets set priority = 'high' where id = v_ticket;
  get diagnostics n = row_count;
  v_total := v_total + 1;
  if n = 1 then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 16 الموظف يغيّر الأولوية'; end if;

  failed := false;
  begin
    insert into public.support_agents (user_id) values (c_cust_b);
  exception when others then failed := true; end;
  v_total := v_total + 1;
  if failed then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 17 الموظف لا يضيف موظفين'; end if;

  failed := false;
  begin
    insert into public.support_categories (slug, name_ar, name_en) values ('hack_test', 'x', 'x');
  exception when others then failed := true; end;
  v_total := v_total + 1;
  if failed then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 18 الموظف لا يعدّل الفئات'; end if;

  failed := false;
  begin
    insert into public.support_attachments (ticket_id, message_id, file_name, file_path, file_type, file_size)
      values (v_ticket, v_note, 'internal.png', v_ticket::text || '/internal.png', 'image/png', 1000);
  exception when others then failed := true; end;
  v_total := v_total + 1;
  if not failed then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 19 الموظف يرفق ملفًا بملاحظة داخلية'; end if;

  update public.support_tickets set status = 'closed' where id = v_ticket;
  get diagnostics n = row_count;
  select closed_at into v_closed from public.support_tickets where id = v_ticket;
  v_total := v_total + 1;
  if n = 1 and v_closed is not null then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 20 الموظف يغلق التذكرة (closed_at يتسجل)'; end if;

  ---------------------------------------------------------------- العميل A مرة أخرى
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c_cust_a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', c_cust_a::text, true);
  set local role authenticated;

  select count(*) into n from public.support_messages where ticket_id = v_ticket;
  v_total := v_total + 1;
  if n = 2 then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 21 العميل يرى رسالته + رد الدعم فقط (الملاحظة الداخلية مخفية)'; end if;

  failed := false;
  begin
    insert into public.support_messages (ticket_id, message) values (v_ticket, 'رد على تذكرة مغلقة');
  exception when others then failed := true; end;
  v_total := v_total + 1;
  if failed then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 22 العميل لا يرد على تذكرة مغلقة'; end if;

  ---------------------------------------------------------------- الموظف يعيد الفتح
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c_agent, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', c_agent::text, true);
  set local role authenticated;

  update public.support_tickets set status = 'open' where id = v_ticket;
  select closed_at into v_closed from public.support_tickets where id = v_ticket;
  v_total := v_total + 1;
  if v_closed is null then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 23 إعادة فتح التذكرة تمسح closed_at'; end if;

  ---------------------------------------------------------------- العميل A: رد + مرفقات
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c_cust_a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', c_cust_a::text, true);
  set local role authenticated;

  failed := false;
  begin
    insert into public.support_messages (ticket_id, message) values (v_ticket, 'رد بعد إعادة الفتح');
  exception when others then failed := true; end;
  v_total := v_total + 1;
  if not failed then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 24 العميل يرد بعد إعادة الفتح'; end if;

  failed := false;
  begin
    insert into public.support_attachments (ticket_id, message_id, file_name, file_path, file_type, file_size)
      values (v_ticket, v_msg, 'proof.png', v_ticket::text || '/proof.png', 'image/png', 2048);
  exception when others then failed := true; end;
  v_total := v_total + 1;
  if not failed then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 25 العميل يرفق صورة برسالته'; end if;

  failed := false;
  begin
    insert into public.support_attachments (ticket_id, message_id, file_name, file_path, file_type, file_size)
      values (v_ticket, v_agent_msg, 'steal.png', v_ticket::text || '/steal.png', 'image/png', 2048);
  exception when others then failed := true; end;
  v_total := v_total + 1;
  if failed then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 26 العميل لا يرفق بأسماء رسائل غيره'; end if;

  select count(*) into n from public.support_attachments where ticket_id = v_ticket;
  v_total := v_total + 1;
  if n = 1 then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 27 العميل لا يرى مرفقات الملاحظات الداخلية (يرى مرفقه فقط)'; end if;

  ---------------------------------------------------------------- المدير الرئيسي
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', c_owner::text, true);
  set local role authenticated;

  failed := false;
  begin
    insert into public.support_agents (user_id, added_by) values (c_cust_b, c_owner);
  exception when others then failed := true; end;
  v_total := v_total + 1;
  if not failed then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 28 المدير الرئيسي يضيف موظف دعم'; end if;

  failed := false;
  begin
    insert into public.support_messages (ticket_id, message) values (v_ticket, 'رد المدير') returning id into v_note;
  exception when others then failed := true; end;
  select sender_role into v_role from public.support_messages where id = v_note;
  v_total := v_total + 1;
  if not failed and v_role = 'admin' then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 29 رد المدير الرئيسي (الدور admin)'; end if;

  ---------------------------------------------------------------- سجل التغييرات (بصلاحية المحرر)
  reset role;
  select count(*) into n from public.support_ticket_events where ticket_id = v_ticket;
  v_total := v_total + 1;
  if n >= 5 then v_ok := v_ok + 1; else v_log := v_log || E'\n✗ 30 سجل التغييرات يسجّل الأحداث (found ' || n || ')'; end if;

  ---------------------------------------------------------------- النتيجة (الخطأ المقصود يلغي كل التغييرات)
  raise exception 'SUPPORT_TESTS_RESULT: %/% passed%  -- (تم التراجع عن كل بيانات الاختبار)',
    v_ok, v_total, case when v_log = '' then '' else v_log end;
end $$;

-- ملاحظة: الاختبار يستهلك بضعة أرقام تذاكر من العدّاد (الأرقام لا تُسترجع حتى مع Rollback).
-- ولو أردت أن تبدأ التذاكر الحقيقية من 1001 بعد الاختبار (وبشرط ألا توجد تذاكر حقيقية):
--   alter table public.support_tickets alter column ticket_number restart with 1001;
