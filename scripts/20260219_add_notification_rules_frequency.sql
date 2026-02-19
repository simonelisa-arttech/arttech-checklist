alter table public.notification_rules
  add column if not exists day_of_week smallint;

alter table public.notification_rules
  add column if not exists last_sent_on date;

alter table public.notification_rules
  drop constraint if exists notification_rules_frequency_check;

alter table public.notification_rules
  add constraint notification_rules_frequency_check
  check (
    frequency is null
    or upper(frequency) in ('DAILY', 'WEEKDAYS', 'WEEKLY')
  );

alter table public.notification_rules
  drop constraint if exists notification_rules_day_of_week_check;

alter table public.notification_rules
  add constraint notification_rules_day_of_week_check
  check (day_of_week is null or day_of_week between 0 and 6);
