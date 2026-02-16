-- add dimensioni per riga in checklist_items
alter table public.checklist_items
  add column if not exists dimensioni text null;
