alter table public.personale_documenti
add column if not exists document_catalog_id uuid null;

alter table public.aziende_documenti
add column if not exists document_catalog_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'personale_documenti_document_catalog_id_fkey'
  ) then
    alter table public.personale_documenti
    add constraint personale_documenti_document_catalog_id_fkey
    foreign key (document_catalog_id)
    references public.document_catalog(id)
    on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'aziende_documenti_document_catalog_id_fkey'
  ) then
    alter table public.aziende_documenti
    add constraint aziende_documenti_document_catalog_id_fkey
    foreign key (document_catalog_id)
    references public.document_catalog(id)
    on delete set null;
  end if;
end
$$;
