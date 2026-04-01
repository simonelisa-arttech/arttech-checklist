do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'saas_interventi_esito_fatturazione_chk'
      and conrelid = 'public.saas_interventi'::regclass
  ) then
    alter table public.saas_interventi
    drop constraint saas_interventi_esito_fatturazione_chk;
  end if;
end
$$;

alter table public.saas_interventi
add constraint saas_interventi_esito_fatturazione_chk
check (
  esito_fatturazione is null
  or esito_fatturazione in ('DA_FATTURARE', 'INCLUSO', 'NON_FATTURARE', 'FATTURATO')
);
