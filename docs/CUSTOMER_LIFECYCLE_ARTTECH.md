# Customer Lifecycle Art Tech — Ciclo di vita del cliente

> Riferimento strategico dell'ecosistema cliente Art Tech, dal primo contatto alla partnership.
> Allineato a `MODELLO_ASSISTENZA_ATSYSTEM.md`, `SUPPORT_TIER_PER_PROGETTO.md`,
> `AREA_CLIENTE_CUSTOMER_JOURNEY.md`, `LANDING_ASSISTENZA_STRATEGY.md`/`_FUNNEL.md`.
> Nomenclatura ufficiale; CARE PREMIUM solo come stato legacy interno (mai piano offerto);
> PREMIUM CLIENT = programma relazionale. AT SYSTEM è la source of truth.

Versione: 2026-06-15

Legenda strumenti: **Sito/Landing**, **HubSpot** (CRM/lead), **AT SYSTEM** (backoffice/source of truth),
**Area Cliente** (`atsystem.arttechworld.com`), **Resend** (email/alert), **WhatsApp**, **EyeSmartPlayer**
(monitoraggio), **Cronoprogramma**, **Ticketing**.

---

## Fasi del ciclo di vita

### 1. Primo contatto
- **Cliente:** capire se Art Tech risolve il suo bisogno. **Art Tech:** qualificare il lead, fissare sopralluogo.
- **Dati:** nome, azienda, contatto, esigenza, location. **Strumenti:** Sito/Landing, Ads, HubSpot.
- **Area Cliente:** —. **AT SYSTEM:** —(lead in HubSpot). **Opportunità:** preventivo/offerta.
- **Trigger:** lead form → HubSpot; nurturing email. **KPI:** lead, costo/lead, tasso di qualificazione.

### 2. Vendita impianto
- **Cliente:** soluzione su misura, ROI chiaro. **Art Tech:** chiudere il deal, scegliere la formula (vendita/noleggio/comodato/revenue sharing).
- **Dati:** specifiche impianto, formula, contratto. **Strumenti:** HubSpot (deal), preventivo, documento commerciale.
- **Area Cliente:** —. **AT SYSTEM:** creazione **progetto** all'ordine. **Opportunità:** includere SAAS (CARE PLUS/ULTRA) + PREMIUM CLIENT già in fase d'ordine.
- **Trigger:** deal won → crea progetto + pianifica installazione. **KPI:** win rate, valore medio, % ordini con SAAS allegato.

### 3. Consegna / installazione
- **Cliente:** impianto installato e funzionante. **Art Tech:** installazione corretta, tempi rispettati.
- **Dati:** cronoprogramma, seriali hardware, foto, collaudo. **Strumenti:** Cronoprogramma, app operatori, `asset_serials`.
- **Area Cliente:** (post) documenti di consegna nel fascicolo tecnico. **AT SYSTEM:** `cronoprogramma_meta`, impianti, seriali; stato **OPERATIVO**. **Opportunità:** attivazione SAAS al collaudo.
- **Trigger:** fine installazione → stato OPERATIVO + avvio garanzia. **KPI:** rispetto tempi, qualità, % collaudi ok.

### 4. Onboarding
- **Cliente:** sapere come gestire l'impianto e ricevere assistenza. **Art Tech:** attivare la relazione digitale, ridurre il supporto manuale.
- **Dati:** email aziendale del referente. **Strumenti:** email onboarding (Resend), Area Cliente, guida.
- **Area Cliente:** presentazione "I tuoi impianti". **AT SYSTEM:** associa cliente ↔ progetti. **Opportunità:** invito registrazione + presentazione piani.
- **Trigger:** post-consegna → email onboarding + invito registrazione. **KPI:** % onboarding completato.

### 5. Registrazione Area Cliente
- **Cliente:** accesso self-service. **Art Tech:** spostare le interazioni su un canale tracciato.
- **Dati:** email aziendale, verifica anagrafica. **Strumenti:** `/registrazione`, AT SYSTEM auth, HubSpot.
- **Area Cliente:** account attivo, scoping per cliente. **AT SYSTEM:** verifica match anagrafica + approvazione. **Opportunità:** visibilità coperture → upsell contestuale.
- **Trigger:** registrazione → verifica → accesso/approvazione interna. **KPI:** tasso di registrazione, tempo di approvazione.

### 6. Garanzia
- **Cliente:** protezione dai difetti. **Art Tech:** rispettare la garanzia e preparare la conversione a SAAS prima della scadenza.
- **Dati:** scadenza garanzia per impianto. **Strumenti:** `rinnovi_servizi`/`checklists`, alert (Resend).
- **Area Cliente:** badge garanzia + scadenza. **AT SYSTEM:** `tier = garanzia` per progetto. **Opportunità:** upsell CARE PLUS/ULTRA pre-scadenza; PREMIUM CLIENT nei casi previsti.
- **Trigger:** alert fine garanzia (interni 90/60/30, cliente 30/15). **KPI:** % conversione garanzia → SAAS.

### 7. Assistenza (ticketing)
- **Cliente:** risolvere i problemi velocemente. **Art Tech:** gestione efficiente, ticket corretti, meno telefonate.
- **Dati:** ticket (impianto, categoria, foto/video, snapshot tier). **Strumenti:** Ticketing/Area Cliente, `assistenza_tickets`, HubSpot email-to-ticket, WhatsApp (se PREMIUM CLIENT).
- **Area Cliente:** flusso guidato (J1). **AT SYSTEM:** `computeSupportTierForProgetto`, coda prioritizzata. **Opportunità:** impianti fuori copertura → preventivo/upsell.
- **Trigger:** ticket aperto → notifica staff (reply-to cliente). **KPI:** tempo presa in carico, % risolti, % ticket ben categorizzati, soddisfazione.

### 8. CARE PLUS
- **Cliente:** gestione/monitoraggio/continuità. **Art Tech:** ricavi ricorrenti + base per upsell.
- **Dati:** contratto, scadenza, interventi. **Strumenti:** AT SYSTEM (SAAS), Area Cliente.
- **Area Cliente:** copertura PLUS visibile. **AT SYSTEM:** `tier = plus`. **Opportunità:** upsell ULTRA, attivare PREMIUM CLIENT, add-on servizi.
- **Trigger:** reminder rinnovo + upsell. **KPI:** MRR PLUS, churn, upsell rate.

### 9. CARE ULTRA
- **Cliente:** priorità + interventi inclusi per impianti critici. **Art Tech:** massimizzare valore e retention sugli impianti critici.
- **Dati:** contratto, SLA, interventi inclusi/residui. **Strumenti:** AT SYSTEM, Area Cliente, WhatsApp (PREMIUM CLIENT incluso).
- **Area Cliente:** priorità + residui + canale diretto. **AT SYSTEM:** `tier = ultra`, `premium_client` incluso. **Opportunità:** estensione ad altri impianti del cliente.
- **Trigger:** alert anticipati di scadenza; alert residui = 1/0. **KPI:** MRR ULTRA, retention, interventi/contratto.

### 10. PREMIUM CLIENT (programma)
- **Cliente:** corsia preferenziale di relazione. **Art Tech:** fidelizzazione, percezione premium, leva di upsell.
- **Dati:** flag `premium_client`, referente, contatto. **Strumenti:** AT SYSTEM (flag), WhatsApp, referente.
- **Area Cliente:** badge PREMIUM CLIENT + canale prioritario. **AT SYSTEM:** automatico in ULTRA/EVENT/noleggi/garanzie (`premium_client_incluso_garanzia`); opzionale su PLUS. **Opportunità:** vendita add-on su PLUS; base per futuri programmi (STRATEGIC/PARTNER/DOOH).
- **Trigger:** attivazione → assegnazione referente. **KPI:** % clienti con PREMIUM CLIENT, retention, soddisfazione.

### 11. Rinnovi
- **Cliente:** continuità senza interruzioni. **Art Tech:** ricavi ricorrenti, non perdere coperture.
- **Dati:** scadenze per progetto. **Strumenti:** `rinnovi_servizi`, alert, Area Cliente, HubSpot (deal rinnovo), landing rinnovi.
- **Area Cliente:** scadenze + CTA rinnovo. **AT SYSTEM:** workflow rinnovi (DA_AVVISARE → … → FATTURATO). **Opportunità:** upsell in fase di rinnovo.
- **Trigger:** alert 90/60/30/15 (interni), 30/15 (cliente); landing `/assistenza/rinnovi`. **KPI:** tasso di rinnovo, revenue retention, churn.

### 12. Upgrade
- **Cliente:** più copertura/priorità. **Art Tech:** aumentare ARPU.
- **Dati:** piano attuale → target. **Strumenti:** Area Cliente, HubSpot, landing upgrade.
- **Area Cliente:** confronto piani + CTA. **AT SYSTEM:** cambio piano sul progetto. **Opportunità:** PLUS→ULTRA, +PREMIUM CLIENT, +add-on (`SAAS-MON/TCK/...`).
- **Trigger:** segnali comportamentali (molti ticket, residui esauriti) → suggerimento upgrade. **KPI:** upsell rate, ARPU, expansion MRR.

### 13. Nuovi impianti
- **Cliente:** espandere la presenza LED. **Art Tech:** cross-sell di un nuovo progetto.
- **Dati:** nuovo progetto/impianto. **Strumenti:** HubSpot (deal), AT SYSTEM (nuovo progetto), Area Cliente (CTA commerciale).
- **Area Cliente:** CTA "Richiedi ampliamento / nuova installazione". **AT SYSTEM:** nuovo progetto con copertura indipendente. **Opportunità:** nuovo impianto + piano + PREMIUM CLIENT.
- **Trigger:** CTA da Area Cliente → lead HubSpot. **KPI:** cross-sell rate, impianti per cliente.

### 14. Partnership
- **Partner:** collaborazione (comodato/revenue sharing/spazi). **Art Tech:** espandere il network DOOH, ricavi condivisi.
- **Dati:** tipo collaborazione, spazi, condizioni. **Strumenti:** HubSpot (pipeline partner), documento commerciale.
- **Area Cliente:** (futura) vista dedicata partner. **AT SYSTEM:** gestione progetti partner/network. **Opportunità:** revenue sharing, network nazionale.
- **Trigger:** lead partner dalla landing (P9). **KPI:** numero partner, ricavi del network.

### 15. Eventi (ART TECH EVENT)
- **Cliente:** assistenza reattiva durante l'evento. **Art Tech:** servizio premium temporaneo + ricavi evento.
- **Dati:** evento (date, location), impianto temporaneo. **Strumenti:** AT SYSTEM (EVENT), Area Cliente/QR, WhatsApp.
- **Area Cliente:** canale prioritario durante l'evento. **AT SYSTEM:** `tier = event`, scadenza = fine evento, `premium_client` incluso. **Opportunità:** eventi ricorrenti, conversione a noleggio/vendita.
- **Trigger:** inizio/fine evento; chiusura copertura a fine evento. **KPI:** numero eventi, ricavi/evento, conversione post-evento.

### 16. Noleggi
- **Cliente:** LED senza acquisto. **Art Tech:** ricavi ricorrenti + assistenza inclusa.
- **Dati:** contratto noleggio, durata, impianti. **Strumenti:** AT SYSTEM (modulo noleggi, futuro), HubSpot.
- **Area Cliente:** copertura noleggio + PREMIUM CLIENT incluso. **AT SYSTEM:** progetto noleggio; `premium_client` incluso. **Opportunità:** riscatto/upgrade a vendita, rinnovo noleggio.
- **Trigger:** scadenza noleggio → rinnovo/riscatto. **KPI:** utilizzo flotta, ricavi noleggio, conversione a vendita.

---

## Mappa strategica dell'ecosistema

```
Cliente
  └── Progetto (contenitore commerciale)
        └── Piano (Garanzia / CARE PLUS / CARE ULTRA / ART TECH EVENT)  [+ PREMIUM CLIENT trasversale]
              └── Impianto (unità tecnica, fascicolo tecnico)
                    └── Ticket (assistenza guidata, copertura riconosciuta)
                          └── Rinnovo (continuità della copertura)
                                └── Upsell (upgrade piano / PREMIUM CLIENT / nuovi impianti)
```

- La **copertura** è determinata a livello **Progetto/Impianto** (mai cliente).
- Il **Ticket** eredita automaticamente copertura, SLA, PREMIUM CLIENT e garanzia dal progetto/impianto.
- Il **Rinnovo** mantiene attiva la copertura; gli **alert** lo anticipano.
- L'**Upsell** (upgrade, PREMIUM CLIENT, nuovi impianti) chiude il ciclo e ne avvia uno nuovo (espansione).
- **PREMIUM CLIENT** attraversa tutte le fasi come layer relazionale, indipendente dal piano.

---

## Lifecycle consigliato (sintesi)

Acquisizione (1–2) → Attivazione (3–5) → Copertura & assistenza (6–10) → Continuità & crescita
(11–13) → Espansione ecosistema (14–16). Obiettivo trasversale: **portare ogni cliente in Area
Cliente** (canale tracciato) e **attaccare un piano SAAS + PREMIUM CLIENT** il prima possibile,
massimizzando ricavi ricorrenti e retention.

---

## Punti critici individuati
1. **Drop-off onboarding → registrazione:** se il cliente non si registra, l'ecosistema (assistenza, upsell, alert) non parte. Dipende dalla correttezza dell'**email aziendale in anagrafica**.
2. **Conversione garanzia → SAAS:** momento ad alto valore spesso perso senza alert/azione commerciale tempestiva.
3. **CARE PREMIUM legacy:** rischio di incoerenza nomi finché i 14 progetti non sono riallineati manualmente.
4. **Tier oggi a livello cliente** (non ancora per-progetto): gap tecnico da colmare con `computeSupportTierForProgetto`.
5. **Doppia fonte scadenze** (`rinnovi_servizi` vs `checklists.saas_scadenza/garanzia_scadenza`): rischio di alert/coperture incoerenti.
6. **Scoping dati per cliente:** errori = rischio data leak tra clienti.
7. **Modulo noleggi** ancora futuro: la fase 16 non è pienamente strumentata in AT SYSTEM.

---

## Opportunità commerciali individuate
1. **SAAS in fase d'ordine** (CARE PLUS/ULTRA): ricavi ricorrenti dal giorno 1.
2. **Conversione garanzia → CARE PLUS/ULTRA** prima della scadenza (alert-driven).
3. **Upsell PLUS → ULTRA** e attivazione **PREMIUM CLIENT** (anche su PLUS, opzionale).
4. **Add-on servizi** (`SAAS-MON/TCK/SIM/CMS/BKP/RPT/SLA/EXT/CYB`) su qualsiasi piano.
5. **CTA "nuovo impianto / ampliamento"** dall'Area Cliente → cross-sell strutturale.
6. **Eventi ricorrenti** → conversione a noleggio/vendita.
7. **Network partner** (comodato, revenue sharing) → ricavi DOOH condivisi.
8. **PREMIUM CLIENT** come leva di fidelizzazione e base per futuri programmi (STRATEGIC / PARTNER / DOOH).
