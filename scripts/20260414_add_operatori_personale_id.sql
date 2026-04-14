alter table if exists public.operatori
  add column if not exists personale_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'operatori_personale_id_fkey'
      and conrelid = 'public.operatori'::regclass
  ) then
    alter table public.operatori
      add constraint operatori_personale_id_fkey
      foreign key (personale_id)
      references public.personale(id)
      on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'operatori_personale_id_key'
      and conrelid = 'public.operatori'::regclass
  ) then
    alter table public.operatori
      add constraint operatori_personale_id_key
      unique (personale_id);
  end if;
end
$$;

-- Update manuale opzionale per rollout graduale.
-- Esempio: collega operatori esistenti a personale per email uguale (solo se serve, da rivedere prima di eseguirlo).
--
-- update public.operatori o
-- set personale_id = p.id
-- from public.personale p
-- where o.personale_id is null
--   and p.id is not null
--   and lower(coalesce(o.email, '')) <> ''
--   and lower(coalesce(o.email, '')) = lower(coalesce(p.email, ''));
