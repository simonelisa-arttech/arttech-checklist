-- Rinomina codici SAS-* -> SAAS-* su DB (safe/idempotente)
-- Nota: gestisce FK saas_contratti.piano_codice -> saas_piani.codice

begin;

-- 0) Garantisce che in saas_piani esistano i codici SAAS-* corrispondenti ai SAS-*
--    (clona le righe SAS-* con codice rinominato, senza toccare subito le vecchie).
do $$
declare
  col_list text;
  sel_list text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'saas_piani'
      and column_name = 'codice'
  ) then
    select
      string_agg(quote_ident(column_name), ', ' order by ordinal_position),
      string_agg(
        case
          when column_name = 'codice'
            then 'regexp_replace(p.codice, ''^SAS-'', ''SAAS-'') as codice'
          else 'p.' || quote_ident(column_name)
        end,
        ', ' order by ordinal_position
      )
    into col_list, sel_list
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'saas_piani';

    execute format($f$
      insert into public.saas_piani (%s)
      select %s
      from public.saas_piani p
      where p.codice ~ '^SAS-'
        and not exists (
          select 1
          from public.saas_piani n
          where n.codice = regexp_replace(p.codice, '^SAS-', 'SAAS-')
        )
    $f$, col_list, sel_list);
  end if;
end $$;

-- 1) catalog_items.codice
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

-- 2) checklists.saas_piano
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

-- 3) checklists.saas_tipo
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

-- 4) saas_contratti.piano_codice (FK verso saas_piani.codice)
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
