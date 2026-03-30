alter table public.rinnovi_servizi
add column if not exists sim_id uuid null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'rinnovi_servizi_item_tipo_check'
      and conrelid = 'public.rinnovi_servizi'::regclass
  ) then
    alter table public.rinnovi_servizi
    drop constraint rinnovi_servizi_item_tipo_check;
  end if;
end
$$;

alter table public.rinnovi_servizi
add constraint rinnovi_servizi_item_tipo_check
check (item_tipo in ('LICENZA', 'TAGLIANDO', 'SAAS', 'RINNOVO', 'GARANZIA', 'SIM'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rinnovi_servizi_sim_id_fkey'
      and conrelid = 'public.rinnovi_servizi'::regclass
  ) then
    alter table public.rinnovi_servizi
    add constraint rinnovi_servizi_sim_id_fkey
    foreign key (sim_id)
    references public.sim_cards(id)
    on delete set null;
  end if;
end
$$;

create index if not exists idx_rinnovi_servizi_sim_id
on public.rinnovi_servizi (sim_id);
