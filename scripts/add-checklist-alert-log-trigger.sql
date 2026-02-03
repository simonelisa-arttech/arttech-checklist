-- Adds trigger column to checklist_alert_log for reminder dedupe
alter table public.checklist_alert_log
  add column if not exists trigger text;
