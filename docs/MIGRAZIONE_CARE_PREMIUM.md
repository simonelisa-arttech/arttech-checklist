# Migrazione CARE PREMIUM (legacy) — clienti da riallineare manualmente

> Estrazione live dal DB di produzione (`checklists-arttech's Project`) il 2026-06-15 via Supabase
> SQL editor. CARE PREMIUM (`SAAS-PR*`) è **legacy in dismissione**: ogni progetto va riallineato
> manualmente a **CARE PLUS + Premium Client** oppure **CARE ULTRA**.

## Dove vivono davvero i piani (dato live importante)
- I piani sono in **`checklists.saas_piano`** (NON in `saas_contratti`, che contiene solo contratti
  ULTRA: `SAAS-UL4/12/24/36/-ILL`).
- Distribuzione `checklists.saas_piano`: SAAS-PL ×336, (null) ×128, SAAS-UL ×55, SAAS-UL24 ×31,
  SAAS-MON ×16, **SAAS-PR4 ×7**, SAAS-UL4 ×7, **SAAS-PR ×6**, SAAS-EVTF ×2, SAAS-UL8 ×2,
  **SAAS-PR36 ×1**.
- **Totale CARE PREMIUM = 14 progetti.**

## Anomalie legacy in `rinnovi_servizi` (da normalizzare)
- `SAAS_ULTRA` ×1 → deve essere `item_tipo=SAAS` + `subtipo=ULTRA`.
- `SAAS_SCHERMO` ×2 → valore fuori standard (non nel CHECK constraint); verificare/correggere.
- `SAAS / ULTRA` ×2 → corretto (SAAS + subtipo ULTRA).

---

## Elenco dei 14 progetti CARE PREMIUM

Suggerimento destinazione: i piani con SLA rapido (`SAAS-PR4` = H4) sono più vicini a **CARE ULTRA**;
`SAAS-PR`/`SAAS-PR36` (SLA standard/lento) si prestano a **CARE PLUS + Premium Client**. Decisione
finale per riga al commerciale.

| # | Cliente | Progetto | Codice | Scadenza | Attivo | Destinazione suggerita |
|---|---------|----------|--------|----------|--------|------------------------|
| 1 | Centro Servizi Courmayeur S.R.L. | LEDWALL (EX VG) | SAAS-PR36 | 2026-11-07 | sì | CARE PLUS + Premium Client |
| 2 | Coima Sgr S.P.A. | VELA | SAAS-PR | 2030-06-23 | sì | CARE PLUS + Premium Client |
| 3 | COMES - Commercio e Sviluppo S.R.L. | COMES - CAMPANIA 2/2 | SAAS-PR4 | 2029-03-30 | sì | CARE ULTRA (H4) |
| 4 | COMES - Commercio e Sviluppo S.R.L. | COMES - CAMPANIA 1/2 | SAAS-PR4 | 2029-03-30 | sì | CARE ULTRA (H4) |
| 5 | GEMMA | ROMA EST 1/2 | SAAS-PR4 | 2029-03-30 | sì | CARE ULTRA (H4) |
| 6 | GEMMA S.R.L. | ROMA EST 2/2 | SAAS-PR4 | 2029-03-30 | sì | CARE ULTRA (H4) |
| 7 | Impresa Generale Pubblicità — JCDecaux SPA | CAIROLI [INGRESSO 9046] | SAAS-PR | 2026-12-31 | sì | CARE PLUS + Premium Client |
| 8 | Impresa Generale Pubblicità — JCDecaux SPA | CAIROLI [INGRESSO 9045] | SAAS-PR | 2026-12-31 | sì | CARE PLUS + Premium Client |
| 9 | Shopville Le Gru S.R.L. | LE GRU 1/3 | SAAS-PR4 | 2029-03-30 | sì | CARE ULTRA (H4) |
| 10 | Shopville Le Gru S.R.L. | LE GRU 3/3 | SAAS-PR4 | 2029-03-30 | sì | CARE ULTRA (H4) |
| 11 | Shopville Le Gru S.R.L. | LE GRU 2/3 | SAAS-PR4 | 2029-03-30 | sì | CARE ULTRA (H4) |
| 12 | Videowall SRL | ZARA [INGRESSO 1] | SAAS-PR | 2028-02-15 | sì | CARE PLUS + Premium Client |
| 13 | Vivenda Group S.p.A. | MAXISCHERMO ROMA | SAAS-PR | 2025-09-04 | **no (scaduto)** | Valutare rinnovo o chiusura |
| 14 | Federazione Italiana Pallavolo | Noleggio BPER Test Match Biella 14/05/2026 | SAAS-PR | — | — (noleggio/test) | Probabile da ignorare (evento concluso) |

## Sintesi operativa
- **Progetti attivi da riallineare: 12** (righe 1–12).
- 1 scaduto (Vivenda Group) → decidere rinnovo o chiusura.
- 1 noleggio/test (Federazione Italiana Pallavolo) → probabilmente non rilevante.
- Clienti coinvolti (~9): Centro Servizi Courmayeur, Coima Sgr, COMES, GEMMA, JCDecaux, Shopville Le
  Gru, Videowall, Vivenda Group, (Federazione Italiana Pallavolo).
- Candidati a **CARE ULTRA** (SLA H4): COMES (2), GEMMA (2), Shopville Le Gru (3) = 7 progetti.
- Candidati a **CARE PLUS + Premium Client**: Centro Servizi Courmayeur, Coima Sgr, JCDecaux (2),
  Videowall = 5 progetti.

> Nota: il riallineamento è **manuale** (campo `checklists.saas_piano`). Nessuna automazione finché
> non validate le destinazioni riga per riga.
