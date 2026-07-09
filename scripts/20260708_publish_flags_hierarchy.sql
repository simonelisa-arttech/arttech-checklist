-- Publish flags hierarchy on checklist_impianti
-- Già applicato in produzione.
-- Script versionato nel repo solo come traccia.
-- Additivo e idempotente: aggiunge 4 CHECK constraint se mancanti.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'checklist_impianti_publish_channel_requires_network_chk'
      and conrelid = 'public.checklist_impianti'::regclass
  ) then
    alter table public.checklist_impianti
      add constraint checklist_impianti_publish_channel_requires_network_chk
      check (not publish_channel or publish_network);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'checklist_impianti_channel_booking_requires_channel_chk'
      and conrelid = 'public.checklist_impianti'::regclass
  ) then
    alter table public.checklist_impianti
      add constraint checklist_impianti_channel_booking_requires_channel_chk
      check (not channel_booking or publish_channel);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'checklist_impianti_channel_engagement_requires_channel_chk'
      and conrelid = 'public.checklist_impianti'::regclass
  ) then
    alter table public.checklist_impianti
      add constraint checklist_impianti_channel_engagement_requires_channel_chk
      check (not channel_engagement or publish_channel);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'checklist_impianti_channel_voucher_requires_channel_chk'
      and conrelid = 'public.checklist_impianti'::regclass
  ) then
    alter table public.checklist_impianti
      add constraint checklist_impianti_channel_voucher_requires_channel_chk
      check (not channel_voucher or publish_channel);
  end if;
end $$;
