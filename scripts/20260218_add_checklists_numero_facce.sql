-- Add support for bifacciale / multi-face plants.
alter table public.checklists
  add column if not exists numero_facce integer not null default 1,
  add column if not exists m2_calcolati numeric null;

-- Backfill m2_calcolati from legacy value when available.
update public.checklists
set m2_calcolati = m2_inclusi
where m2_calcolati is null
  and m2_inclusi is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'checklists_numero_facce_check'
      and conrelid = 'public.checklists'::regclass
  ) then
    alter table public.checklists
      add constraint checklists_numero_facce_check check (numero_facce >= 1);
  end if;
end $$;
