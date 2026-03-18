do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'cronoprogramma_meta'
      and constraint_type = 'CHECK'
      and constraint_name = 'cronoprogramma_meta_row_kind_check'
  ) then
    alter table public.cronoprogramma_meta
      drop constraint cronoprogramma_meta_row_kind_check;
  end if;
end $$;

alter table public.cronoprogramma_meta
  add constraint cronoprogramma_meta_row_kind_check
  check (row_kind in ('INSTALLAZIONE', 'DISINSTALLAZIONE', 'INTERVENTO'));

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'cronoprogramma_comments'
      and constraint_type = 'CHECK'
      and constraint_name = 'cronoprogramma_comments_row_kind_check'
  ) then
    alter table public.cronoprogramma_comments
      drop constraint cronoprogramma_comments_row_kind_check;
  end if;
end $$;

alter table public.cronoprogramma_comments
  add constraint cronoprogramma_comments_row_kind_check
  check (row_kind in ('INSTALLAZIONE', 'DISINSTALLAZIONE', 'INTERVENTO', 'CHECKLIST_TASK'));
