-- =====================================================================
-- 7sabatk Support System — المرحلة 2 / الملف 3 من 3
-- الفئات والفئات الفرعية الافتراضية (إعدادات النظام وليست بيانات تجريبية).
-- المدير الرئيسي يستطيع تعديلها لاحقًا (المرحلة 8). آمن لإعادة التشغيل.
-- شغّله بعد الملفين 1 و2.
-- =====================================================================
begin;

insert into public.support_categories (slug, name_ar, name_en, sort_order) values
  ('orders_human_support', 'الدعم البشري / الطلبات',  'Human Support / Orders',   10),
  ('payments_deposits',    'المدفوعات والإيداعات',    'Payments & Deposits',      20),
  ('account_issues',       'مشاكل الحساب',            'Account Issues',           30),
  ('technical_issues',     'المشاكل التقنية',         'Technical Issues',         40),
  ('other_inquiries',      'استفسارات أخرى',          'Other Inquiries',          50)
on conflict (slug) do nothing;

insert into public.support_subcategories (category_id, slug, name_ar, name_en, sort_order)
select c.id, s.slug, s.name_ar, s.name_en, s.sort_order
from (values
  ('orders_human_support', 'compensation',        'التعويض',               'Compensation',            10),
  ('orders_human_support', 'order_not_executed',  'عدم تنفيذ الطلب',       'Order not executed',      20),
  ('orders_human_support', 'order_delayed',       'تأخر تنفيذ الطلب',      'Order delayed',           30),
  ('orders_human_support', 'order_cancel',        'إلغاء الطلب',           'Cancel order',            40),
  ('orders_human_support', 'wrong_quantity',      'تنفيذ كمية غير صحيحة',  'Incorrect quantity',      50),
  ('orders_human_support', 'other',               'مشكلة أخرى',            'Other issue',             90),
  ('payments_deposits',    'payment_issue',       'مشكلة في الدفع',        'Payment issue',           10),
  ('payments_deposits',    'deposit_not_received','عدم وصول الإيداع',      'Deposit not received',    20),
  ('payments_deposits',    'other',               'مشكلة أخرى',            'Other issue',             90),
  ('account_issues',       'account_issue',       'مشكلة في الحساب',       'Account issue',           10),
  ('account_issues',       'other',               'مشكلة أخرى',            'Other issue',             90),
  ('technical_issues',     'other',               'مشكلة أخرى',            'Other issue',             90)
) as s(category_slug, slug, name_ar, name_en, sort_order)
join public.support_categories c on c.slug = s.category_slug
on conflict (category_id, slug) do nothing;

commit;
