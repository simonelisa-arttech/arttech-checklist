update public.personale_documenti as pd
set document_catalog_id = dc.id
from public.document_catalog as dc
where pd.document_catalog_id is null
  and nullif(btrim(pd.tipo_documento), '') is not null
  and lower(btrim(pd.tipo_documento)) = lower(btrim(dc.nome))
  and dc.target in ('PERSONALE', 'ENTRAMBI');

update public.aziende_documenti as ad
set document_catalog_id = dc.id
from public.document_catalog as dc
where ad.document_catalog_id is null
  and nullif(btrim(ad.tipo_documento), '') is not null
  and lower(btrim(ad.tipo_documento)) = lower(btrim(dc.nome))
  and dc.target in ('AZIENDA', 'ENTRAMBI');
