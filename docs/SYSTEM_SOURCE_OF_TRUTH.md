# SYSTEM SOURCE OF TRUTH — ATSYSTEM

**Stato:** VINCOLANTE · **Da leggere OBBLIGATORIAMENTE prima di ogni intervento**
**Creato:** 2026-06-17 · **Owner:** Art Tech S.r.l. (Simone)

> La conoscenza del progetto NON vive nelle singole chat o nei singoli agenti.
> Vive nei documenti del repository. Le chat sono intercambiabili; il repo è la fonte di verità.

---

## 1. Cos'è ATSYSTEM

ATSYSTEM non è un semplice gestionale: è un **ecosistema** in cui gli stessi dati alimentano più
superfici, interne ed esterne. Componenti:

- Gestionale interno
- Area Cliente
- Area Assistenza
- Customer Portal
- Support Tier
- Customer Lookup (API sito esterno)
- Scadenziario
- Fascicolo Tecnico
- Documentazione Cliente
- Catalogo SaaS / Servizi
- Catena **Cliente → Progetto → Piano → Impianto**

Una modifica a una parte può propagarsi a tutte le altre. Per questo nessun intervento è "locale".

---

## 2. PRIMA di qualsiasi modifica (obbligatorio)

1. **Leggere i documenti di handoff e source of truth** del repo (vedi §5).
2. **Verificare se esistono modifiche recenti** fatte da altre chat/agenti (working tree non
   committato, ultimi commit, documenti di handoff aggiornati).
3. **Valutare gli impatti** su tutti i componenti dell'ecosistema (§1).

## 3. DOPO qualsiasi modifica (obbligatorio)

1. **Aggiornare il documento di handoff/stato più appropriato** (es. `HANDOFF_CONTEXT.md` o
   `docs/architecture/MASTER_HANDOFF_2026-06.md`).
2. **Registrare** nel handoff:
   - motivo della modifica
   - file modificati
   - eventuali SQL / migration (mai dati per applicati)
   - impatto gestionale
   - impatto Area Cliente
   - impatto Area Assistenza
   - impatto Customer Portal
   - impatto Customer Lookup
   - impatto Scadenziario / Fascicolo Tecnico / Documentazione Cliente
   - impatto Cataloghi SaaS / Servizi / Support Tier
   - rischi residui
   - attività future

## 4. Report a 10 punti per OGNI fix

Ogni proposta di fix deve includere il report d'impatto a 10 punti definito in
`docs/architecture/GESTIONALE_AREA_CLIENTE_ALIGNMENT.md`. Se un punto non è impattato,
dichiararlo esplicitamente.

---

## 5. Documenti fonte di verità (ordine di lettura consigliato)

1. `PROJECT_CONTEXT.md` — fonte di verità del progetto
2. `HANDOFF_CONTEXT.md` — stato recente, bug fixati, feature
3. `TODO.md` — task pendenti e priorità
4. `docs/SYSTEM_SOURCE_OF_TRUTH.md` — **questo documento** (regole di allineamento)
5. `docs/architecture/GESTIONALE_AREA_CLIENTE_ALIGNMENT.md` — report a 10 punti
6. `docs/architecture/MASTER_HANDOFF_2026-06.md` — handoff architetturale
7. `docs/architecture/SUPPORT_TIER_PER_PROGETTO.md` — calcolo copertura e priorità ticket
8. `docs/MODELLO_ASSISTENZA_ATSYSTEM.md` — modello assistenza (piani, SLA, interventi, alert)
9. `docs/DB_SCHEMA.md` — schema database Supabase

---

## 6. Invarianti tecniche da non violare

- **Source of truth dati invariata.** Esempi: lista task operative = `checklist_tasks` (non
  `checklist_checks` in UI); copertura/tier = `saas_contratti`/`rinnovi_servizi`.
- **Isolamento cliente.** `ruolo_portale = CLIENTE` non vede dati di altri clienti né è mai
  operatore (hardening `lib/adminAuth.ts`).
- **Doppia logica tier.** `app/api/public/customer-lookup/route.ts` ha una copia della logica tier
  per il sito esterno: allinearla a ogni modifica dei tier.
- **Migration.** Mai applicate alla cieca: scritte, classificate, approvate.
- **Niente secrets nel repo.**

---

## 7. Lavoro in parallelo tra chat

Più chat/agenti possono lavorare in parallelo sul repo, a patto che:
- usino questi documenti come fonte di verità condivisa;
- preferibilmente le modifiche al **codice** restino concentrate in una sola chat per volta,
  con commit/push frequenti, per evitare collisioni nel working tree;
- ogni intervento aggiorni il handoff (§3) così che le altre chat vedano lo stato reale.

### Progetto Supabase di produzione
- Produzione (`atsystem.arttechworld.com`) → progetto **`aaiuyaiwdrecyqjgnjxp`**
  ("checklists-arttech's Project", regione West EU / Ireland).
- `art-tech-channel-staging` (`fvjltdlpwnmxwjcpmwcs`) è **staging**, non produzione.
