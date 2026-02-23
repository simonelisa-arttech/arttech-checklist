-- Rinomina codici SAS-* -> SAAS-* su DB (safe/idempotente)

begin;

-- catalog_items.codice
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'catalog_items'
      and column_name = 'codice'
  ) then
    update public.catalog_items
    set codice = regexp_replace(codice, '^SAS-', 'SAAS-')
    where codice ~ '^SAS-';
  end if;
end $$;

-- checklists.saas_piano
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'checklists'
      and column_name = 'saas_piano'
  ) then
    update public.checklists
    set saas_piano = regexp_replace(saas_piano, '^SAS-', 'SAAS-')
    where saas_piano ~ '^SAS-';
  end if;
end $$;

-- checklists.saas_tipo
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'checklists'
      and column_name = 'saas_tipo'
  ) then
    update public.checklists
    set saas_tipo = regexp_replace(saas_tipo, '^SAS-', 'SAAS-')
    where saas_tipo ~ '^SAS-';
  end if;
end $$;

-- saas_contratti.piano_codice (se presente)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'saas_contratti'
      and column_name = 'piano_codice'
  ) then
    update public.saas_contratti
    set piano_codice = regexp_replace(piano_codice, '^SAS-', 'SAAS-')
    where piano_codice ~ '^SAS-';
  end if;
end $$;

commit;
