# Regola di Allineamento — Gestionale Interno ↔ Area Cliente ↔ Area Assistenza

**Stato:** VINCOLANTE · **Tipo:** regola strutturale di progetto
**Creato:** 2026-06-17 · **Owner:** Art Tech S.r.l. (Simone)
**Ambito:** ATSYSTEM (arttech-checklist) — gestionale interno + interfacce cliente

---

## 1. Principio

ATSYSTEM non è solo il gestionale interno: è il sistema operativo dell'azienda, e gli stessi dati
alimentano anche le interfacce rivolte al cliente. Di conseguenza **ogni modifica al gestionale
interno deve essere valutata anche rispetto a tutto ciò che il cliente vede o che il sistema
elabora a valle.**

Non basta correggere il gestionale. Se una modifica cambia **dati, nomi, stati, source of truth,
tabelle, API, documenti, allegati, scadenze o logiche operative**, va verificato esplicitamente
cosa cambia per:

- Area Cliente
- Area Assistenza
- customer portal
- customer-lookup (API sito esterno, es. maxischermo.biz)
- support tier
- scadenziario
- documenti / fascicolo cliente
- cataloghi SaaS / servizi
- mapping **Cliente → Progetto → Piano → Impianto**
- ticket, interventi, rinnovi, garanzie e piani assistenza

---

## 2. Checklist obbligatoria per OGNI fix o modifica

Ogni proposta di fix o modifica al gestionale **deve sempre includere**, nel report, i 10 punti
seguenti. Se un punto non è impattato, va comunque dichiarato esplicitamente "nessun impatto".

1. **Impatto gestionale interno** — cosa cambia per operatori e backoffice.
2. **Impatto Area Cliente** — cosa vede/non vede il cliente nella sua area.
3. **Impatto Area Assistenza** — ticket guidati, contatto diretto, SLA, tier.
4. **Impatto customer-lookup / API** — endpoint pubblici e siti esterni che consumano i dati.
5. **Impatto documenti / allegati / fascicolo cliente** — visibilità e collegamenti file.
6. **Impatto scadenziario / rinnovi** — LICENZA, TAGLIANDO, SAAS, SAAS_ULTRA, GARANZIA, alert.
7. **Impatto cataloghi SaaS / servizi / support tier** — PLUS, PREMIUM, ULTRA, EVENTS e gerarchia.
8. **Eventuali SQL / migration necessari** — mai darli per applicati: scriverli e chiedere conferma.
9. **Test consigliati o eseguiti** — typecheck/build/lint, E2E Playwright, verifica manuale.
10. **Rischi di disallineamento** — dove gestionale e interfacce cliente potrebbero divergere.

---

## 3. Regole operative collegate

- **Source of truth invariata:** non introdurre seconde fonti di verità. Esempio concreto: la lista
  delle task operative resta `checklist_tasks`; non leggere `checklist_checks` in UI come fallback
  permanente.
- **Isolamento cliente:** un utente con `ruolo_portale = CLIENTE` non deve mai accedere a dati di
  altri clienti né essere riconosciuto come operatore (hardening in `lib/adminAuth.ts`).
- **Doppia logica tier:** ricordare che `app/api/public/customer-lookup/route.ts` ha una copia
  separata della logica tier usata dal sito esterno — ogni modifica ai tier va allineata anche lì.
- **Migration:** mai applicare alla cieca. Vanno scritte, classificate e approvate prima
  dell'esecuzione (vedi `docs/ANALISI_UNTRACKED_2026-06.md`).
- **Niente secrets nel repo.**

---

## 4. Documenti di riferimento (fonti di verità correlate)

- `PROJECT_CONTEXT.md` — fonte di verità del progetto
- `HANDOFF_CONTEXT.md` — stato recente
- `docs/architecture/MASTER_HANDOFF_2026-06.md`
- `docs/architecture/SUPPORT_TIER_PER_PROGETTO.md` — calcolo copertura e priorità ticket
- `docs/MODELLO_ASSISTENZA_ATSYSTEM.md` — modello assistenza (piani, SLA, interventi, alert)
- `docs/DB_SCHEMA.md` — schema database Supabase

---

## 5. Applicazione

Questa regola si applica da subito a ogni intervento, incluso il fix in corso sulla
**Check-list operativa** (materializzazione `checklist_tasks` mancante su progetti legacy).
Nessuna logica applicativa va modificata senza il report a 10 punti di cui alla sezione 2.
