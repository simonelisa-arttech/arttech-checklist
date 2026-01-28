-- Add minimal columns for license actions/status/alerts
-- Run ONLY in non-production or with a proper backup/approval.

begin;

alter table if exists licenses
  add column if not exists status text;

alter table if exists licenses
  add column if not exists alert_sent_at timestamptz,
  add column if not exists alert_to text,
  add column if not exists alert_note text,
  add column if not exists updated_by_operatore uuid;

-- Optional: initialize status for existing rows
update licenses
set status = coalesce(status, case
  when stato is not null then upper(stato)
  else 'ATTIVA'
end)
where status is null;

commit;
