alter table if exists public.cronoprogramma_meta
  add column if not exists durata_prevista_minuti integer null;

-- opzionale: check base
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cronoprogramma_meta_durata_prevista_chk'
      and conrelid = 'public.cronoprogramma_meta'::regclass
  ) then
    alter table public.cronoprogramma_meta
      add constraint cronoprogramma_meta_durata_prevista_chk
      check (
        durata_prevista_minuti is null
        or durata_prevista_minuti >= 0
      );
  end if;
end
$$;

-- NOTA:
-- NON rimuovere durata_giorni (retrocompatibilità)
-- NON fare migrazione dati automatica
