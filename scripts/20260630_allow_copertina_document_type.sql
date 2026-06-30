-- EPIC ATSYSTEM -> Inventory Publish
-- STEP 1C - consenti document_type COPERTINA per cover impianto
-- NON applicare senza approvazione esplicita

alter table public.attachments
drop constraint if exists attachments_document_type_check;

alter table public.attachments
add constraint attachments_document_type_check
check (
document_type is null
or document_type = any (
array[
'GENERICO',
'CLIENTE',
'DRIVE',
'ODA_FORNITORE',
'COPERTINA'
]
)
);
