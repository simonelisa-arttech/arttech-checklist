-- Add missing fields for licenses + catalog category
-- NOTE: table name is "licenses" in this project

alter table public.licenses
  add column if not exists fornitore text,
  add column if not exists intestato_a text;

alter table public.catalog_items
  add column if not exists categoria text;
