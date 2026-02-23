-- Helper operativo: verifica/sistema only_future e reset dedupe giornaliero per test cron

-- 1) Verifica regole notifiche (focus only_future)
select
  id,
  target,
  task_title,
  mode,
  enabled,
  only_future,
  send_time,
  timezone,
  updated_at
from public.notification_rules
order by upper(coalesce(target, '')), task_title;

-- 2) (Opzionale) Allinea only_future=true per regole AUTOMATICA MAGAZZINO/TECNICO_SW
--    Esegui solo se vuoi forzare comportamento "solo checklist future".
update public.notification_rules
set only_future = true,
    updated_at = now()
where upper(coalesce(target, '')) in ('MAGAZZINO', 'TECNICO_SW')
  and upper(coalesce(mode, '')) = 'AUTOMATICA'
  and coalesce(only_future, false) = false;

-- 3) (TEST) Pulisci dedupe di OGGI in Europe/Rome per specifica regola
--    Sostituisci target/task_title e riesegui il cron.
-- delete from public.notification_log
-- where sent_on = (now() at time zone 'Europe/Rome')::date
--   and upper(coalesce(target, '')) = 'MAGAZZINO'
--   and task_title = 'Preparazione / riserva disponibilità / ordine merce';

-- 4) (TEST) Pulisci dedupe di OGGI per entrambe le regole principali
-- delete from public.notification_log
-- where sent_on = (now() at time zone 'Europe/Rome')::date
--   and (
--     (upper(coalesce(target, '')) = 'MAGAZZINO' and task_title = 'Preparazione / riserva disponibilità / ordine merce')
--     or
--     (upper(coalesce(target, '')) = 'TECNICO_SW' and task_title = 'Elettronica di controllo: schemi dati ed elettrici')
--   );

-- 5) Check rapido post-cleanup
select
  sent_on,
  target,
  task_title,
  count(*) as rows_count
from public.notification_log
where sent_on = (now() at time zone 'Europe/Rome')::date
group by sent_on, target, task_title
order by target, task_title;
