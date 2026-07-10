-- Digital Solutions Platform — classificazione 12 dimensioni (direttiva CEO 10/07).
-- ATSystem = SoT del catalogo soluzioni. ADDITIVA: nuova tabella, nessuna modifica all'esistente.
-- Le 12 dimensioni sono array (un prodotto compare in N percorsi senza duplicare contenuti).
-- Supabase prod aaiuyaiwdrecyqjgnjxp.

create table if not exists public.prodotti_catalogo (
  id uuid primary key default gen_random_uuid(),
  codice text unique not null,
  nome_soluzione text not null,          -- linguaggio cliente (non nome tecnico)
  slug text,
  -- 12 DIMENSIONI
  tipologia text[]        not null default '{}',  -- 1
  settore text[]          not null default '{}',  -- 2
  applicazione text[]     not null default '{}',  -- 3
  servizio text[]         not null default '{}',  -- 4
  tecnologia text[]       not null default '{}',  -- 5
  installazione text[]    not null default '{}',  -- 6
  indoor_outdoor text[]   not null default '{}',  -- 7
  area_geografica text[]  not null default '{}',  -- 8
  fascia_prezzo text,                              -- 9 (Entry|Professional|Premium|Enterprise)
  ecosistema text[]       not null default '{}',  -- 10 (ESP|CARE|Channel|Network|MyDOOH|DoohBook)
  keyword_seo text[]      not null default '{}',  -- 11
  intenti_ricerca text[]  not null default '{}',  -- 12 (informativo|commerciale|transazionale|urgenza)
  specifiche jsonb,                                -- pitch/formati/uso da installato reale
  strategico boolean not null default true,
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_prodcat_settore   on public.prodotti_catalogo using gin (settore);
create index if not exists idx_prodcat_tipologia on public.prodotti_catalogo using gin (tipologia);
create index if not exists idx_prodcat_servizio  on public.prodotti_catalogo using gin (servizio);
create index if not exists idx_prodcat_keyword   on public.prodotti_catalogo using gin (keyword_seo);

insert into public.prodotti_catalogo
 (codice,nome_soluzione,slug,tipologia,settore,applicazione,servizio,tecnologia,installazione,indoor_outdoor,area_geografica,fascia_prezzo,ecosistema,keyword_seo,intenti_ricerca,specifiche)
values
 ('SOL-OUTDOOR','Maxischermo LED Outdoor','soluzioni/led-outdoor/maxischermo-led-outdoor',
  '{LED Wall}','{Sport,DOOH,Retail,Eventi,Hospitality}','{Stadio,Facciata,Affissione urbana,Centro commerciale,Piazza}',
  '{Vendita,Noleggio,Noleggio operativo,Leasing}','{SMD}','{Fisso,Facciata,Truck}','{Outdoor}','{Nord,Centro,Sud}','Professional',
  '{ESP,CARE,Channel,Network,MyDOOH,DoohBook}',
  '{maxischermo led,ledwall outdoor,maxischermo pubblicitario,maxischermo stadio,billboard led,schermo led esterno}',
  '{commerciale,transazionale}',
  '{"pitch":["P3.9","P5","P6.6","P10"],"formati_m":["3x2","4x3","6x3.5"],"protezione":"IP65","installato":82,"note":"categoria n.1"}'),
 ('SOL-INDOOR-FP','Ledwall Indoor Fine-Pitch','soluzioni/led-indoor/ledwall-indoor-fine-pitch',
  '{LED Wall}','{Corporate,Retail,Hospitality,Broadcast}','{Sala riunioni,Reception,Showroom,Studio TV,Lobby}',
  '{Vendita,Noleggio}','{SMD,COB}','{Fisso}','{Indoor}','{Nord,Centro,Sud}','Professional',
  '{ESP,CARE,Channel}',
  '{ledwall indoor,videowall sala riunioni,schermo led interno,fine pitch,display led corporate}',
  '{commerciale,informativo}',
  '{"pitch":["P2.5","P2.6","P2.9"],"luminosita_nit":"800-1200","installato":46,"note":"categoria n.2"}'),
 ('SOL-VETRINA','Schermo LED Vetrina / Semi-Outdoor','soluzioni/led-indoor/schermo-led-vetrina',
  '{LED Wall}','{Retail,Hospitality}','{Vetrina,Insegna,Ingresso negozio}',
  '{Vendita,Noleggio}','{SMD}','{Fisso,Sospeso}','{Semi-outdoor,Vetrina}','{Nord,Centro,Sud}','Professional',
  '{ESP,CARE,Channel}',
  '{schermo per vetrina,insegna led,monitor da vetrina,schermo per negozio,display led negozio}',
  '{commerciale,transazionale}',
  '{"formati_m":["1.76x0.64","2x1","3x2"],"installato":21}'),
 ('SOL-PERIMETRALE','LED Perimetrale Sport (Bordocampo)','soluzioni/led-outdoor/led-perimetrale-sport',
  '{Perimetrale}','{Sport}','{Stadio,Palazzetto,Bordocampo}',
  '{Vendita,Noleggio}','{SMD}','{Fisso,Mobile}','{Indoor,Outdoor}','{Nord,Centro,Sud}','Professional',
  '{ESP,CARE,Channel,Network}',
  '{bordocampo led,led perimetrale,perimetrale stadio,tabellone segnapunti led,led palazzetto}',
  '{commerciale}',
  '{"formati_m":["15x0.5","18x0.5","24x0.5"],"pitch":["P6","P10"],"note":"rotazione sponsor"}'),
 ('SOL-TOTEM','Totem LED','soluzioni/totem-led/totem-led',
  '{Totem}','{Retail,Automotive,DOOH}','{Concessionaria,Reception,Wayfinding,Vetrina}',
  '{Vendita,Noleggio,Noleggio operativo}','{SMD}','{Fisso,Mobile}','{Indoor,Semi-outdoor,Outdoor}','{Nord,Centro,Sud}','Professional',
  '{ESP,CARE,Channel,MyDOOH}',
  '{totem led,totem digitale,totem pubblicitario,totem concessionaria}',
  '{commerciale,transazionale}',
  '{"formato_m":"1.76x0.64 (verticale)","pitch":["P2.5","P3.9"]}'),
 ('SOL-PREMIUM-FP','Fine-Pitch Premium Indoor','soluzioni/led-indoor/fine-pitch-premium',
  '{LED Wall}','{Corporate,Broadcast}','{Control room,Boardroom,Studio TV,Showroom luxury}',
  '{Vendita}','{COB,Micro LED}','{Fisso}','{Indoor}','{Nord,Centro,Sud}','Enterprise',
  '{ESP,CARE}',
  '{fine pitch,micro led,cob led,videowall control room,virtual production led}',
  '{commerciale,informativo}',
  '{"pitch":["P1.5","P1.9"],"note":"alta densita, seamless"}'),
 ('SOL-TRASPARENTE','LED Trasparente','soluzioni/led-trasparente/led-trasparente',
  '{Trasparente}','{Retail,Hospitality,Automotive}','{Vetrina,Facciata,Showroom}',
  '{Vendita,Noleggio}','{Trasparente,Mesh}','{Vetrina,Facciata,Sospeso}','{Vetrina,Indoor}','{Nord,Centro,Sud}','Premium',
  '{ESP,CARE,Channel}',
  '{led trasparente,ledwall trasparente,vetrina led trasparente,glass led}',
  '{commerciale,informativo}',
  '{"note":"emergente, luxury/retail; specifiche da schede fornitore"}'),
 ('SOL-FLOOR','LED Pavimento / Floor','soluzioni/led-pavimento/led-floor',
  '{Floor}','{Eventi,Retail,Broadcast}','{Pavimento,Eventi,Nightclub,Studio TV}',
  '{Noleggio,Vendita}','{SMD}','{Pavimento}','{Indoor}','{Nord,Centro,Sud}','Premium',
  '{ESP,CARE}',
  '{led pavimento,led floor,led calpestabile,pavimento led eventi}',
  '{commerciale}',
  '{"note":"emergente, eventi/TV; calpestabile"}')
on conflict (codice) do update set
  nome_soluzione=excluded.nome_soluzione, slug=excluded.slug, tipologia=excluded.tipologia,
  settore=excluded.settore, applicazione=excluded.applicazione, servizio=excluded.servizio,
  tecnologia=excluded.tecnologia, installazione=excluded.installazione, indoor_outdoor=excluded.indoor_outdoor,
  area_geografica=excluded.area_geografica, fascia_prezzo=excluded.fascia_prezzo, ecosistema=excluded.ecosistema,
  keyword_seo=excluded.keyword_seo, intenti_ricerca=excluded.intenti_ricerca, specifiche=excluded.specifiche,
  updated_at=now();
