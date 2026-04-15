alter table if exists public.checklist_documents
  add column if not exists visibile_al_cliente boolean not null default false;

alter table if exists public.attachments
  add column if not exists visibile_al_cliente boolean not null default false;

create index if not exists checklist_documents_visibile_al_cliente_idx
  on public.checklist_documents (visibile_al_cliente);

create index if not exists attachments_visibile_al_cliente_idx
  on public.attachments (visibile_al_cliente);
