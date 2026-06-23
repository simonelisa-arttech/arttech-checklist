# Landing "Assistenza Art Tech" — Strategia e architettura

> Strategia per una landing commerciale che funga da: materiale commerciale, pagina campagne
> marketing, pagina rinnovi, pagina upsell assistenza e punto d'ingresso verso l'Area Cliente.
> Fonti: `MODELLO_ASSISTENZA_ATSYSTEM.md`, `CATALOGO_PIANI_ATSYSTEM.md`,
> `DOCUMENTO_COMMERCIALE_ASSISTENZA.md`, `AREA_CLIENTE_CUSTOMER_JOURNEY.md`,
> `DECK_ASSISTENZA_13_SLIDE.md`, `architecture/SUPPORT_TIER_PER_PROGETTO.md`.
> Solo nomenclatura ufficiale; CARE PREMIUM non compare come piano; PREMIUM CLIENT = programma relazionale.

Versione: 2026-06-15

---

## 1. Dominio / URL — raccomandazione

**Asset esistenti:** sito brand `maxischermiled.it` (WordPress), app `atsystem.arttechworld.com`
(Area Cliente / registrazione), landing già pubblicata su `ledcareservice.com`, voce menu "Assistenza"
oggi puntata a ledcareservice.com.

**Raccomandazione (per conversione + SEO + semplicità + integrazione + campagne):**

| Ruolo | Dominio/URL | Perché |
|------|-------------|--------|
| **Landing canonica** | **`maxischermiled.it/assistenza`** | Sottocartella del dominio brand: eredita autorità SEO del sito principale (a differenza di sottodomini o domini esterni), massima fiducia/brand recognition, miglior Quality Score nelle campagne, URL semplice e ricordabile. |
| **Dominio vanity / offline** | **`ledcareservice.com`** → 301 a `maxischermiled.it/assistenza` | Corto e leggibile per QR sui ledwall, stampa e passaparola; con redirect 301 + canonical evita contenuti duplicati e consolida la SEO sul dominio brand. |
| **Ingresso Area Cliente** | `atsystem.arttechworld.com` (`/registrazione`, `/login`) | È l'app reale; la landing vi rimanda con CTA. (Futuro opzionale: alias amichevole `my.maxischermiled.it`.) |

**Perché NON gli altri:**
- `assistenza.maxischermiled.it` (sottodominio): Google lo tratta più come sito separato → diluisce l'autorità SEO rispetto alla sottocartella.
- `ledcareservice.com` come canonico: dominio esterno senza storia SEO del brand → parte da zero, separa il brand, peggiora Quality Score.
- `my.art-tech.it` / `assistenza.art-tech.it`: introducono un brand diverso (`art-tech.it`) → confusione e dispersione; vanno bene solo come alias tecnico, non come canonico.

> Principio: **una sola URL canonica forte (`/assistenza`)**, tutto il resto reindirizza con 301 e UTM.

---

## 2. Architettura della landing (sezioni)

1. **Hero** — claim + doppia CTA (area cliente + scopri i piani).
2. **Perché è diverso** — assistenza tradizionale vs Area Cliente + AT SYSTEM.
3. **Come funziona** — copertura per progetto/impianto (Cliente → Progetti → Piano → Impianti).
4. **Garanzia** — copertura di base.
5. **CARE PLUS** — gestione, monitoraggio, ticketing.
6. **CARE ULTRA** — priorità + interventi inclusi.
7. **ART TECH EVENT** — eventi e noleggi.
8. **PREMIUM CLIENT** — programma relazionale trasversale.
9. **Area Cliente** — lo strumento operativo (impianti, ticket, documenti, fascicolo tecnico).
10. **Alert automatici** — proattività e monitoraggio.
11. **FAQ** — riduzione attrito e obiezioni.
12. **CTA finali** — registrazione + contatti + lead form.

---

## 3. Conversioni per sezione

Conversione primaria = **registrazione/accesso Area Cliente** + **lead commerciale** (form). Secondarie =
apertura ticket, contatto WhatsApp/telefono.

| # | Sezione | CTA consigliata | Lead generabile | → Area Cliente | → AT SYSTEM |
|---|---------|-----------------|-----------------|----------------|-------------|
| 1 | Hero | "Accedi / Registrati" + "Scopri i piani" | Registrazione cliente | `/registrazione`, `/login` | Sì (app) |
| 2 | Perché è diverso | "Scopri come funziona" (scroll) | Engagement | — | — |
| 3 | Come funziona | "Verifica la tua copertura" | Account/lookup | `/login` | Lookup copertura per progetto |
| 4 | Garanzia | "Hai un impianto in garanzia? Apri assistenza" | Ticket | `/login` → ticket | Tier=garanzia, ticket |
| 5 | CARE PLUS | "Richiedi CARE PLUS" | Lead commerciale | — | Crea opportunità/contratto |
| 6 | CARE ULTRA | "Passa a CARE ULTRA" | Lead/upsell | — | Opportunità ULTRA |
| 7 | ART TECH EVENT | "Richiedi assistenza evento" | Lead urgente evento | — | Opportunità EVENT |
| 8 | PREMIUM CLIENT | "Attiva PREMIUM CLIENT" | Lead/upsell relazionale | — | Flag `premium_client` |
| 9 | Area Cliente | "Entra nella tua Area Cliente" | Registrazione/accesso | `/registrazione`, `/login` | Sì |
| 10 | Alert automatici | "Tieni i tuoi impianti sotto controllo" | Registrazione | `/login` | Alert/monitoraggio |
| 11 | FAQ | "Apri un ticket" / "Contattaci" | Ticket / contatto | `/login` | Ticket |
| 12 | CTA finali | "Registrati" + WhatsApp/email/telefono | Registrazione + lead | `/registrazione` | Sì |

Tracciamento: ogni CTA con UTM e, dove possibile, evento di conversione (lead form, registrazione, ticket).

---

## 4. Evoluzione futura (landing modulare)

La pagina va costruita a **blocchi/sezioni riutilizzabili** + parametri UTM, così da generare varianti
senza riscrivere:
- **Pagina rinnovi** — variante con hero "Rinnova la tua copertura" + deep-link Area Cliente alla scadenza specifica.
- **Pagina upgrade** — hero "Passa a CARE ULTRA / Attiva PREMIUM CLIENT" + tabella comparativa in evidenza.
- **Landing Google Ads** — focus keyword "assistenza maxischermo LED / ledwall", hero + piani + form, FAQ per Quality Score.
- **Landing Meta** — più visiva, storytelling "prima/dopo", lead form nativo.
- **Pagina QR sui ledwall** — `ledcareservice.com` (vanity) → `/assistenza?utm_source=qr&utm_campaign=<impianto>`, hero "Assistenza per questo impianto".
- **Onboarding clienti** — variante post-vendita con guida ai primi passi in Area Cliente.

Requisiti per abilitare l'evoluzione: sezioni componibili, hero/CTA parametrizzabili, supporto UTM,
deep-link verso Area Cliente, A/B test sulle CTA.

---

## 5. Strategia consigliata (sintesi)

- **Una landing canonica** `maxischermiled.it/assistenza`, modulare e tracciata; `ledcareservice.com`
  come dominio vanity in 301.
- **Doppio obiettivo** per ogni vista: (a) portare in **Area Cliente** chi è già cliente
  (registrazione/ticket/rinnovo), (b) generare **lead commerciali** per chi valuta un piano.
- **Nomenclatura ufficiale** ovunque; PREMIUM CLIENT presentato come programma relazionale, mai come piano.
- **Niente promesse SLA non confermate**; ART TECH EVENT senza "on-site 1h" come regola.
- Allineare poi la voce "Assistenza" dei siti (oggi → ledcareservice.com) alla nuova URL canonica.

---

## 6. Punti da validare
1. **URL canonica**: confermare `maxischermiled.it/assistenza` (vincolo: è WordPress — serve poter
   pubblicare la landing lì con controllo su layout/tracciamento) vs mantenere `ledcareservice.com` canonico.
2. Gestione **redirect 301** e `canonical` da ledcareservice.com per non perdere SEO.
3. Form lead: dove confluiscono (HubSpot? CRM?) e quali campi.
4. Eventi di conversione e UTM standard per le campagne.
5. Alias futuro Area Cliente (`my.maxischermiled.it`) sì/no.
6. Aggiornare la voce menu "Assistenza" dei siti alla URL canonica scelta.
