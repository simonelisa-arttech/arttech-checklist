alter table public.checklists
  add column if not exists impianto_quantita integer not null default 1;

update public.checklists
set impianto_quantita = 1
where impianto_quantita is null or impianto_quantita < 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'checklists_impianto_quantita_check'
      and conrelid = 'public.checklists'::regclass
  ) then
    alter table public.checklists
      add constraint checklists_impianto_quantita_check check (impianto_quantita >= 1);
  end if;
end $$;
