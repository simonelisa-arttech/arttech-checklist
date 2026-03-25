alter table if exists public.checklists
  add column if not exists po text null;
