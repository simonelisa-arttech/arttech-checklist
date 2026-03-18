alter table public.clienti_anagrafica
  add column if not exists scadenze_delivery_mode text;

update public.clienti_anagrafica
set scadenze_delivery_mode = 'AUTO_CLIENTE'
where scadenze_delivery_mode is null;

alter table public.clienti_anagrafica
  alter column scadenze_delivery_mode set default 'AUTO_CLIENTE';

alter table public.clienti_anagrafica
  drop constraint if exists clienti_anagrafica_scadenze_delivery_mode_check;

alter table public.clienti_anagrafica
  add constraint clienti_anagrafica_scadenze_delivery_mode_check
  check (scadenze_delivery_mode in ('AUTO_CLIENTE', 'MANUALE_INTERNO'));

alter table public.clienti_anagrafica
  alter column scadenze_delivery_mode set not null;
