-- Phase 9 read-only Supabase schema/security checklist.
-- Run after migrations 1–6 and phase 8 in Supabase SQL Editor.
-- This query does not create, update, or delete data.
with expected_tables(name) as (
  values ('support_tickets'), ('support_messages'), ('support_attachments'),
         ('support_agents'), ('support_notifications'), ('support_categories'),
         ('support_subcategories'), ('support_category_catalog_state')
), table_checks as (
  select 'Table exists: ' || e.name as check_name,
         to_regclass('public.' || e.name) is not null as passed,
         case when to_regclass('public.' || e.name) is null then 'Missing table' else 'Present' end as details
  from expected_tables e
), rls_checks as (
  select 'RLS enabled: ' || e.name as check_name,
         coalesce(c.relrowsecurity, false) as passed,
         case when c.relrowsecurity then 'Enabled' else 'Disabled or table missing' end as details
  from expected_tables e
  left join pg_class c on c.oid = to_regclass('public.' || e.name)
), expected_triggers(name, relation_name) as (
  values ('support_tickets_created_notification_trg','support_tickets'),
         ('support_messages_notifications_trg','support_messages'),
         ('support_tickets_notifications_trg','support_tickets'),
         ('support_categories_catalog_bump_trg','support_categories'),
         ('support_subcategories_catalog_bump_trg','support_subcategories')
), trigger_checks as (
  select 'Trigger exists: ' || e.name as check_name,
         exists(select 1 from pg_trigger t where t.tgname=e.name and not t.tgisinternal
           and t.tgrelid=to_regclass('public.'||e.relation_name)) as passed,
         e.relation_name as details
  from expected_triggers e
), expected_policies(name, relation_name) as (
  values ('support_notifications_select','support_notifications'),
         ('support_notifications_update','support_notifications'),
         ('support_categories_read','support_categories'),
         ('support_categories_owner_write','support_categories'),
         ('support_subcategories_read','support_subcategories'),
         ('support_subcategories_owner_write','support_subcategories')
), policy_checks as (
  select 'Policy exists: ' || e.name as check_name,
         exists(select 1 from pg_policies p where p.schemaname='public'
           and p.tablename=e.relation_name and p.policyname=e.name) as passed,
         e.relation_name as details
  from expected_policies e
), realtime_checks as (
  select 'Realtime publication: ' || e.name as check_name,
         exists(select 1 from pg_publication_tables p where p.pubname='supabase_realtime'
           and p.schemaname='public' and p.tablename=e.name) as passed,
         'supabase_realtime' as details
  from (values ('support_notifications'),('support_tickets'),('support_messages'),('support_category_catalog_state')) e(name)
)
select * from table_checks
union all select * from rls_checks
union all select * from trigger_checks
union all select * from policy_checks
union all select * from realtime_checks
order by check_name;
