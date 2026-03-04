-- Ensure baseline SELECT access for dashboard-related tables when RLS is enabled.
-- This is a defensive fallback for authenticated users if policies are missing.
-- Review in production before applying if you need stricter tenant-scoped rules.

begin;

grant usage on schema public to authenticated;

do $$
declare
  t text;
  policy_name text;
  core_tables text[] := array[
    'checklists',
    'clienti_anagrafica',
    'saas_interventi',
    'operatori'
  ];
begin
  foreach t in array core_tables loop
    if to_regclass('public.' || t) is not null then
      execute format('grant select on table public.%I to authenticated', t);
      execute format('alter table public.%I enable row level security', t);

      if not exists (
        select 1
        from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = t
          and p.cmd = 'SELECT'
          and (
            'authenticated' = any (p.roles)
            or 'public' = any (p.roles)
          )
      ) then
        policy_name := format('authenticated_select_all_%s', t);
        execute format(
          'create policy %I on public.%I for select to authenticated using (true)',
          policy_name,
          t
        );
      end if;
    end if;
  end loop;
end $$;

commit;
