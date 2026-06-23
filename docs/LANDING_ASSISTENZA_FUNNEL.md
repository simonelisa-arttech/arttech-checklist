# Landing "Assistenza Art Tech" — Funnel e percorsi utente

> Estende `docs/LANDING_ASSISTENZA_STRATEGY.md`. Definisce funnel, profili utente, KPI, tracciamento
> e architettura finale (homepage unica vs landing dedicate). Solo nomenclatura ufficiale; CARE
> PREMIUM compare solo come stato legacy interno (mai come piano offerto). Niente codice/mockup.

Versione: 2026-06-15

---

## 1. Profili utente e percorsi

Legenda destinazioni: **AC** = Area Cliente (`atsystem.arttechworld.com`), **ATS** = AT SYSTEM
(tier/contratti), **HS** = HubSpot (CRM/lead).

### P1 — Cliente esistente con impianto Art Tech (con accesso)
- **Ingresso:** link diretto / email / menu sito / `/assistenza`.
- **Cosa vede:** focus Area Cliente; dopo login, i suoi impianti e copertura.
- **CTA principale:** "Accedi all'Area Cliente". **CTA secondaria:** "Apri un ticket".
- **Conversione desiderata:** login + utilizzo (ticket/consultazione).
- **Dati raccolti:** email (già nota).
- **Destinazione:** AC (`/login`) · ATS (tier per progetto).

### P2 — Cliente esistente senza accesso Area Cliente
- **Ingresso:** email/campagna/menu.
- **Cosa vede:** hero + "Registrati con l'email aziendale comunicata in fase d'ordine".
- **CTA principale:** "Registrati". **CTA secondaria:** "Problemi di accesso? Contattaci".
- **Conversione:** registrazione/verifica anagrafica.
- **Dati raccolti:** email aziendale, nome, azienda.
- **Destinazione:** AC (`/registrazione`, verifica match anagrafica) · HS (contatto).

### P3 — Cliente con garanzia in scadenza
- **Ingresso:** email alert / UTM rinnovo.
- **Cosa vede:** sezione "La tua garanzia sta per scadere" + opzioni di continuità.
- **CTA principale:** "Rinnova / passa a CARE PLUS o CARE ULTRA". **CTA secondaria:** "Parla con un commerciale".
- **Conversione:** lead rinnovo/upgrade.
- **Dati raccolti:** identificazione impianto/contratto, email.
- **Destinazione:** HS (deal rinnovo) · AC (scadenze) · ATS (tier).

### P4 — Cliente CARE PLUS
- **Ingresso:** Area Cliente / email upsell.
- **Cosa vede:** vantaggi PLUS + upsell verso CARE ULTRA e PREMIUM CLIENT.
- **CTA principale:** "Passa a CARE ULTRA" / "Attiva PREMIUM CLIENT". **CTA secondaria:** "Apri ticket".
- **Conversione:** upsell (lead).
- **Dati raccolti:** progetto/impianto.
- **Destinazione:** HS (opportunità upsell) · AC.

### P5 — Cliente CARE ULTRA
- **Ingresso:** Area Cliente / email.
- **Cosa vede:** conferma priorità + PREMIUM CLIENT incluso + canale diretto.
- **CTA principale:** "Apri ticket prioritario" / "WhatsApp dedicato". **CTA secondaria:** "Gestisci i tuoi impianti".
- **Conversione:** utilizzo/retention.
- **Dati raccolti:** nessuno nuovo.
- **Destinazione:** AC (ticket) · canale referente (WhatsApp).

### P6 — Cliente ART TECH EVENT
- **Ingresso:** accesso urgente durante l'evento (link/QR).
- **Cosa vede:** "Assistenza evento" + canale diretto, presa in carico immediata.
- **CTA principale:** "Richiedi assistenza evento" / "WhatsApp". **CTA secondaria:** "Apri ticket".
- **Conversione:** presa in carico immediata.
- **Dati raccolti:** evento/impianto, telefono.
- **Destinazione:** AC (ticket priorità massima) · canale diretto.

### P7 — Cliente con vecchio CARE PREMIUM da riallineare
- **Ingresso:** come cliente esistente.
- **Cosa vede:** Area Cliente standard. **CARE PREMIUM non è mai mostrato come piano**; internamente flag legacy.
- **CTA principale:** "Accedi all'Area Cliente". **CTA secondaria:** "Aggiorna il tuo piano con noi".
- **Conversione:** contatto per riallineamento manuale (nessuna promessa automatica).
- **Dati raccolti:** identificazione.
- **Destinazione:** AC (tier non espone CARE PREMIUM) · HS (task interno "riallineare", vedi `MIGRAZIONE_CARE_PREMIUM.md`).

### P8 — Nuovo cliente che non conosce Art Tech
- **Ingresso:** Google/Meta ads, SEO.
- **Cosa vede:** hero + "perché è diverso" + piani + prove (numeri/referenze).
- **CTA principale:** "Richiedi informazioni / preventivo". **CTA secondaria:** "Scopri i piani".
- **Conversione:** lead nuovo.
- **Dati raccolti:** nome, azienda, email, telefono, esigenza, consenso privacy.
- **Destinazione:** HS (lead nuovo, pipeline commerciale).

### P9 — Agenzia / partner / società sportiva
- **Ingresso:** campagne B2B/partner, contatto diretto.
- **Cosa vede:** sezione partner + PREMIUM CLIENT + modelli commerciali (comodato, revenue sharing).
- **CTA principale:** "Diventa partner / Richiedi proposta". **CTA secondaria:** "Scarica materiale".
- **Conversione:** lead partnership.
- **Dati raccolti:** azienda, referente, email, tipo collaborazione.
- **Destinazione:** HS (pipeline partner dedicata).

### P10 — Cliente arrivato da QR su impianto
- **Ingresso:** `ledcareservice.com` (vanity) → `/assistenza?utm_source=qr&impianto=<id>`.
- **Cosa vede:** "Assistenza per questo impianto" già contestualizzata.
- **CTA principale:** "Apri assistenza per questo impianto". **CTA secondaria:** "Accedi / Registrati".
- **Conversione:** ticket/registrazione contestuale.
- **Dati raccolti:** impianto (da QR), email.
- **Destinazione:** AC (ticket precompilato con impianto) · ATS (tier per progetto).

---

## 2. KPI della landing

- **Conversioni primarie:** registrazioni Area Cliente; lead commerciali (form); ticket aperti dalla landing.
- **Conversioni secondarie:** click WhatsApp/telefono; click "Scopri i piani"; download materiale; scroll profondo; FAQ aperte.
- **KPI di sintesi:** tasso di registrazione, lead rate, % ticket-da-landing, conversion rate per profilo/UTM, costo per lead (campagne), % rinnovi/upgrade originati dalla landing, bounce rate, tempo alla conversione.

---

## 3. Eventi da tracciare

`page_view`, `cta_click` (con sezione+label), `form_start`, `form_submit` (con tipo: lead/rinnovo/partner),
`registration_start`, `registration_complete`, `ticket_open`, `whatsapp_click`, `phone_click`,
`plan_view` (quale piano), `faq_open`, `scroll_50`, `scroll_90`, `qr_landing` (con `impianto`).

---

## 4. Parametri UTM standard

- `utm_source`: google · meta · qr · email · site · partner
- `utm_medium`: cpc · social · qr · email · referral · menu
- `utm_campaign`: assistenza_2026 · rinnovi · upgrade · event · partner · qr_<impianto>
- `utm_content`: variante/CTA (es. hero_cta, piano_ultra_cta)
- `utm_term`: keyword (per search)
- Parametro custom: `impianto=<id>` (per QR e deep-link Area Cliente)

---

## 5. Campi minimi dei form (massimizzare conversione)

- **Lead nuovo (P8):** nome, azienda, email, telefono, esigenza, consenso privacy.
- **Registrazione (P2/P10):** email aziendale (+ verifica), nome, azienda.
- **Rinnovo/upgrade (P3/P4):** email/azienda + identificazione impianto/contratto + consenso.
- **Partner (P9):** azienda, referente, email, tipo collaborazione.
- Principio: meno campi possibile per lo step iniziale; il resto si arricchisce in Area Cliente / HubSpot.

---

## 6. Architettura finale consigliata: ibrida

**Homepage unica canonica + landing dedicate derivate** (non solo una pagina, non tante pagine slegate).

- **`maxischermiled.it/assistenza`** = homepage completa (tutte le sezioni, SEO, evergreen) → profili P1, P2, P8, P9.
- **Landing dedicate** = varianti della **stessa base modulare**, ottimizzate per intento alto e campagne:
  - `/assistenza/rinnovi` → P3 (UTM `rinnovi`).
  - `/assistenza/upgrade` → P4 (UTM `upgrade`).
  - `/assistenza/eventi` → P6 (UTM `event`).
  - QR/vanity `ledcareservice.com` → `/assistenza?utm_source=qr&impianto=<id>` → P10 (hero contestuale).

**Motivazione:** una sola pagina generalista converte meno sui percorsi ad alta intenzione (rinnovo,
upgrade, evento, QR), che richiedono hero/CTA mirati e messaggi specifici; troppe pagine slegate
disperdono SEO e manutenzione. La soluzione ibrida tiene **una URL canonica forte** (autorità SEO +
evergreen) e genera **varianti riusabili** dai blocchi comuni, massimizzando rilevanza, Quality Score
e conversione senza duplicare il lavoro.

---

## 7. Punti da validare

1. Struttura URL delle landing dedicate (`/assistenza/rinnovi`, ecc.) vs parametri/varianti dinamiche.
2. Integrazione lead → **HubSpot**: pipeline (commerciale, rinnovi, partner), mappatura campi, owner.
3. Deep-link Area Cliente per rinnovo/QR (passaggio di `impianto`/scadenza in modo sicuro, senza PII in URL).
4. Gestione P7 (CARE PREMIUM legacy): messaggio "aggiorna il piano" senza esporre il nome legacy.
5. Set definitivo di eventi/UTM e strumento di analytics (GA4? altro) + consenso cookie.
6. Materiale scaricabile per P9 (partner) e gating (form prima del download sì/no).
