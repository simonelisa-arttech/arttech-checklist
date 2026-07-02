# Art Tech Hub — P3.4 (1° step) + EPIC "Customer Portal Experience"

> **Direttiva:** CEO 02/07/2026 — l'Area Cliente evolve in **Art Tech Hub**, customer portal premium a 5 sezioni (memoria `art-tech-hub-customer-portal`).
> **UX:** Hub a card + top nav (reference Apple Business / Tesla / Google Workspace). Mai stile gestionale.
> **Stato:** P3.4 (1° step) implementato in `app/cliente/page.tsx`. EPIC successiva sotto.

## Cosa fa P3.4 (questo PR)

Trasforma `app/cliente` da pagina unica a scorrimento in **Hub navigabile**:
- **Top nav** (barra sticky glass) con: `Hub` + le 5 sezioni.
- **Home ("Hub")**: griglia di **5 card** (icona + titolo + tagline + stato sintetico + "Apri →"). È la landing dopo il login.
- **5 sezioni** commutabili senza reload:
  1. **Dashboard** — contenuti esistenti invariati (Progetti, Scadenze, Documenti, KPI in header), rispettano i `settings` di visibilità per-cliente.
  2. **Assistenza** — `ClienteAssistenzaSection` **separata** dalla Dashboard (prima era una card nella stessa griglia).
  3. **Marketplace** — griglia di card CTA (rinnovi, upgrade EyeSmartPlayer, AT Channel, MyDOOH, DOOHBook, AdLedMarket, promozioni, voucher) con badge "PRESTO" (struttura; wiring commerciale nell'EPIC).
  4. **News** — placeholder premium "in arrivo" (AT Channel).
  5. **Analytics** — placeholder premium "in arrivo".
- **Deep-link P3.2/P3.3 preservati**: `?azione=assistenza|preventivo` o `?ticket=nuovo` → apre direttamente la sezione **Assistenza**; nuovo `?sezione=<id>` per aprire una sezione specifica.

Additivo e a basso rischio: nessuna modifica ai fetch/dati, nessuna migration. I blocchi dati esistenti sono stati spostati sotto Dashboard, non riscritti.

### File
- `app/cliente/page.tsx` — tipo `HubSection`, `HUB_SECTIONS`, `MARKETPLACE_ITEMS`, stato `activeSection` (da deep-link), top nav, home a card, viste Marketplace/News/Analytics, gating per sezione.

## EPIC "Customer Portal Experience" (dopo P3.4)

1. **Dashboard premium**: ridisegno visivo (hero impianto, stato coperture a colpo d'occhio, timeline scadenze), foto impianto (bucket `impianti-cover`), riepilogo contratti.
2. **Assistenza (P3.4 originale)**: screening avanzato ticket (urgenza, accesso/sicurezza, ricambi, foto/video) + pipeline HubSpot T1–T13 + Quote. Vedi `docs/ASSISTENZA_FLUSSO_LEDCARE.md` §4/§5/P3.4.
3. **Marketplace attivo**: wiring reale delle CTA verso ESP/AT Channel/MyDOOH/DOOHBook/AdLedMarket + promozioni/voucher (coordinamento cross-chat WP/NET/ESP via DISPATCH; oggi solo struttura).
4. **News/AT Channel**: feed contenuti (video, case history, webinar, eventi) — sorgente da definire (AT Channel/CMS).
5. **Analytics**: utilizzo, performance impianti, storico (sorgente EyeSmartPlayer/monitoraggio da definire).
6. **Estetica trasversale**: sistema di design premium (spaziature, tipografia, motion leggero), responsività mobile-first, dark-ready.

Regola: ogni intervento su `app/cliente/*` va progettato come tassello di queste 5 sezioni, con report d'impatto a 10 punti (`docs/architecture/GESTIONALE_AREA_CLIENTE_ALIGNMENT.md`).
