-- Safety audit for core tables:
-- - RLS enabled / forced
-- - SELECT policy presence for authenticated
-- - Any policy exposure to anon/public

with core_tables as (
  select *
  from (
    values
      ('checklists'),
      ('clienti_anagrafica'),
      ('saas_interventi'),
      ('operatori'),
      ('checklists_backup')
  ) as t(table_name)
),
meta as (
  select
    ct.table_name,
    c.oid as relid,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
  from core_tables ct
  left join pg_class c on c.relname = ct.table_name
  left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
)
select
  m.table_name,
  case when m.relid is null then 'MISSING' else 'OK' end as table_status,
  coalesce(m.rls_enabled, false) as rls_enabled,
  coalesce(m.rls_forced, false) as rls_forced,
  has_table_privilege('authenticated', format('public.%I', m.table_name), 'SELECT') as grant_select_authenticated,
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = m.table_name
      and p.cmd = 'SELECT'
      and ('authenticated' = any(p.roles) or 'public' = any(p.roles))
  ) as has_authenticated_select_policy,
  coalesce((
    select string_agg(p.policyname, ', ' order by p.policyname)
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = m.table_name
      and p.cmd = 'SELECT'
      and ('authenticated' = any(p.roles) or 'public' = any(p.roles))
  ), '') as authenticated_select_policies,
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = m.table_name
      and ('anon' = any(p.roles) or 'public' = any(p.roles))
  ) as has_anon_or_public_policy,
  coalesce((
    select string_agg(format('%s[%s]', p.policyname, p.cmd), ', ' order by p.policyname, p.cmd)
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = m.table_name
      and ('anon' = any(p.roles) or 'public' = any(p.roles))
  ), '') as anon_or_public_policies
from meta m
order by m.table_name;
