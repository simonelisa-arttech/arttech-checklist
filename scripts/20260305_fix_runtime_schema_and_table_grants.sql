-- HOTFIX runtime grants for client-side authenticated queries.
-- Use when app pages fail with: "permission denied for schema public"
-- RLS policies still apply: this grants privileges, not row visibility.

begin;

grant usage on schema public to authenticated;

do $$
declare
  t text;
  runtime_tables text[] := array[
    'checklists',
    'checklist_items',
    'checklist_tasks',
    'checklist_documents',
    'catalog_items',
    'saas_interventi',
    'tagliandi',
    'asset_serials',
    'licenses',
    'clienti_anagrafica',
    'operatori'
  ];
begin
  foreach t in array runtime_tables loop
    if to_regclass('public.' || t) is not null then
      execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    end if;
  end loop;
end $$;

-- Needed for tables that still use sequences (if any).
grant usage, select on all sequences in schema public to authenticated;

commit;
