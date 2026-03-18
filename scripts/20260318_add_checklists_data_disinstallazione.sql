alter table if exists public.checklists
  add column if not exists data_disinstallazione date null;
