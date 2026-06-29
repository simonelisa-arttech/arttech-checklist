# Landing Assistenza — Implementation Plan (ponte wireframe → sviluppo)

> Documento operativo che collega `docs/LANDING_ASSISTENZA_WIREFRAME.md` allo sviluppo. Nessun
> codice. Dove i dati HubSpot reali non sono noti sono marcati **[DA CONFERMARE]** (non inventati).
> Nomenclatura ufficiale; PREMIUM CLIENT = programma (non piano); CARE PREMIUM assente.

Versione: 2026-06-15

Legenda: **AC** = Area Cliente (`atsystem.arttechworld.com`), **HS** = HubSpot, **WA** = WhatsApp.

---

# 1. Architettura finale

**Pagine landing (dominio brand `maxischermiled.it`):**
- `maxischermiled.it/assistenza` — **canonica/hub** (evergreen, SEO, tutti i profili generalisti).
- `maxischermiled.it/assistenza/rinnovi` — variante alto-intento (rinnovo copertura).
- `maxischermiled.it/assistenza/upgrade` — variante alto-intento (upgrade piano / PREMIUM CLIENT).
- `maxischermiled.it/assistenza/eventi` — variante eventi/noleggi (+ QR).

**Area Cliente / AT SYSTEM (`atsystem.arttechworld.com`):**
- `/login` — accesso clienti.
- `/registrazione` — registrazione con verifica anagrafica.

**Vanity/offline:** `ledcareservice.com` → **301** → `/assistenza` (per QR: `?utm_source=qr&impianto=<id>`).

**Relazioni tra pagine:**
```
ledcareservice.com ──301──▶ maxischermiled.it/assistenza (HUB)
        │                          │  ├─▶ /assistenza/rinnovi
        │(QR ?impianto)            │  ├─▶ /assistenza/upgrade
        ▼                          │  └─▶ /assistenza/eventi
  /assistenza/eventi               │
                                   ├─▶ atsystem…/login          (clienti)
                                   ├─▶ atsystem…/registrazione  (nuovi accessi)
                                   ├─▶ atsystem…  → ticket       (assistenza guidata)
                                   └─▶ HubSpot form              (lead commerciali)
```
- Le 4 pagine landing condividono i **blocchi riutilizzabili** (header, come funziona, PREMIUM CLIENT, Area Cliente, alert, FAQ, card piano, footer).
- Le varianti cambiano hero, CTA primaria, piano in evidenza, sottoinsieme FAQ, UTM/meta.
- Ogni pagina ha **due sbocchi**: Area Cliente (clienti) o HubSpot (lead).

---

# 2. Mappa CTA

| Testo CTA | Pagina origine | Destinazione finale | HS | AC | WA | Tel | Anchor |
|-----------|----------------|---------------------|----|----|----|-----|--------|
| Accedi all'Area Cliente | tutte (header/hero/§9) | `atsystem…/login` | — | ✓ | — | — | — |
| Registrati | hero/§9/§10/§12 | `atsystem…/registrazione` | — | ✓ | — | — | — |
| Scopri i piani / Confronta i piani | hero/§3/§5–7 | anchor §5–7 | — | — | — | — | ✓ |
| Verifica la tua copertura | §3 | `atsystem…/login` | — | ✓ | — | — | — |
| Apri assistenza (in garanzia) | §4/§11 | `atsystem…/login` → ticket | — | ✓ | — | — | — |
| Richiedi CARE PLUS | §5 | HS form (lead) | ✓ | — | — | — | — |
| Passa a CARE ULTRA | §6 / upgrade | HS form (lead/upsell) | ✓ | — | — | — | — |
| Richiedi assistenza evento | §7 / eventi | HS form + WA | ✓ | — | ✓ | — | — |
| Attiva PREMIUM CLIENT | §8 | HS form | ✓ | — | — | — | — |
| Parla con un referente | §8 | WA | — | — | ✓ | — | — |
| Entra nella tua Area Cliente | §9 | `atsystem…/login` | — | ✓ | — | — | — |
| Tieni i tuoi impianti sotto controllo | §10 | `atsystem…/registrazione` | — | ✓ | — | — | — |
| Apri un ticket | §11 | `atsystem…/login` → ticket | — | ✓ | — | — | — |
| Contattaci | §11/§12 | HS form / WA / `tel:` | ✓ | — | ✓ | ✓ | — |
| Rinnova ora | /assistenza/rinnovi | AC deep-link rinnovo **[DA CONFERMARE]** | — | ✓ | — | — | — |
| Fai l'upgrade | /assistenza/upgrade | HS form / AC | ✓ | ✓ | — | — | — |
| Registrati / Richiedi informazioni | §12 | `atsystem…/registrazione` **o** HS form | ✓ | ✓ | — | — | — |
| WhatsApp / Chiama | §7/§8/§12 | WA / `tel:<numero>` **[DA CONFERMARE]** | — | — | ✓ | ✓ | — |

---

# 3. Mappa Form

> Pipeline/owner HubSpot reali non noti in questo repo → **[DA CONFERMARE]**. Campi = minimi proposti.

| Form | Scopo | Campi minimi | Destinazione HS | Pipeline | Owner | Tag | Evento analytics |
|------|-------|--------------|-----------------|----------|-------|-----|------------------|
| Lead CARE PLUS | richiesta piano base | nome, azienda, email, telefono, esigenza, consenso | contatto+deal | Commerciale **[DA CONFERMARE]** | **[DA CONFERMARE]** | `care_plus`,`landing` | `form_submit{type:lead,plan:care_plus}` |
| Lead CARE ULTRA | richiesta/upsell ULTRA | come sopra | contatto+deal | Commerciale/Upsell **[DA CONF.]** | **[DA CONF.]** | `care_ultra`,`landing` | `form_submit{type:lead,plan:care_ultra}` |
| Lead ART TECH EVENT | assistenza/preventivo evento | nome, azienda, email, telefono, data/luogo evento, consenso | contatto+deal | Eventi **[DA CONFERMARE]** | **[DA CONF.]** | `event`,`landing` | `form_submit{type:lead,plan:event}` |
| PREMIUM CLIENT | interesse al programma | nome, azienda, email, telefono | contatto+deal | Upsell/Relazione **[DA CONF.]** | **[DA CONF.]** | `premium_client` | `form_submit{type:premium_client}` |
| Rinnovo | richiesta rinnovo copertura | email/azienda, identificazione impianto/contratto, consenso | contatto+deal | Rinnovi **[DA CONFERMARE]** | **[DA CONF.]** | `rinnovo` | `form_submit{type:rinnovo}` |
| Upgrade | upgrade piano | email/azienda, piano attuale→target, consenso | contatto+deal | Upsell **[DA CONFERMARE]** | **[DA CONF.]** | `upgrade` | `form_submit{type:upgrade}` |
| Contatto generico | domande/contatto | nome, email, messaggio, consenso | contatto | Commerciale **[DA CONF.]** | **[DA CONF.]** | `contatto` | `form_submit{type:contatto}` |
| Partner (opz.) | partnership/società sportive | azienda, referente, email, tipo collaborazione | contatto+deal | Partner **[DA CONFERMARE]** | **[DA CONF.]** | `partner` | `form_submit{type:partner}` |

Nota: la **registrazione** Area Cliente NON è un form HubSpot ma un flusso su `atsystem…/registrazione`
(verifica anagrafica); eventuale sync del contatto verso HubSpot **[DA CONFERMARE]**.

---

# 4. Mappa Analytics

**Convenzione naming consigliata:** `snake_case`, nome evento generico + parametri descrittivi
(evita un evento diverso per ogni bottone). Parametri comuni: `section`, `label`, `plan`, `type`,
`variant` (canonica/rinnovi/upgrade/eventi), più UTM standard.

| Evento | Quando | Parametri |
|--------|--------|-----------|
| `page_view` | caricamento pagina | `variant`, utm_* |
| `scroll_50` / `scroll_90` | profondità scroll | `variant` |
| `cta_click` | click su qualsiasi CTA | `section`, `label` |
| `plan_view` | sezione piano visibile | `plan` (garanzia/care_plus/care_ultra/art_tech_event) |
| `form_start` | focus primo campo | `type` |
| `form_submit` | invio form | `type`, `plan?` |
| `registration_start` | avvio registrazione AC | — |
| `registration_complete` | registrazione completata | — (lato AC) |
| `ticket_open` | apertura ticket | `impianto?` (lato AC) |
| `whatsapp_click` | click WhatsApp | `section` |
| `phone_click` | click telefono | `section` |
| `faq_open` | apertura FAQ | `question` |
| `qr_landing` | accesso da QR | `impianto` |

UTM standard: `utm_source` (google/meta/qr/email/site/partner) · `utm_medium` (cpc/social/qr/email/referral/menu) · `utm_campaign` (assistenza_2026/rinnovi/upgrade/event/qr_<impianto>) · `utm_content` · `utm_term`.

---

# 5. Integrazione Area Cliente

| Da landing | A | Note / deep-link consigliato | Stato |
|------------|---|------------------------------|-------|
| CTA login | `atsystem…/login` | opz. `?redirect=<area>` dopo login | esiste |
| CTA registrati | `atsystem…/registrazione` | passare `utm_*` per attribuzione; **no PII in URL** | esiste |
| CTA apri ticket | `atsystem…/login` → flusso ticket | da QR: deep-link con `impianto=<id>` per precompilare il ticket | ticket esiste; deep-link **[DA CONFERMARE]** |
| CTA rinnovo | `atsystem…` area scadenze/rinnovo | deep-link a scadenza/progetto specifico | **[DA CONFERMARE]** |
| CTA upgrade | `atsystem…` o HS form | deep-link a confronto piani / cambio piano | **[DA CONFERMARE]** |

Principi: nessun dato personale negli URL; il contesto (impianto/scadenza) passato solo come
identificatori non sensibili; la copertura è risolta da `computeSupportTierForProgetto` lato AC.

---

# 6. Integrazione HubSpot

Dati certi: HubSpot è integrato con **email-to-ticket** e **Reply-To = email cliente** sui ticket e
sulle richieste di registrazione (commit `99df49b`). Il resto è **proposto e [DA CONFERMARE]** con chi
gestisce HubSpot.

**Pipeline proposte (da confermare nomi reali):**
- **Commerciale** — lead nuovi e richieste piano (CARE PLUS/ULTRA).
- **Rinnovi** — pratiche di rinnovo copertura.
- **Upsell/Upgrade** — passaggi di piano + PREMIUM CLIENT.
- **Eventi** — richieste ART TECH EVENT.
- **Partner** — agenzie/società sportive/network.

**Tipi lead:** commerciale (nuovo) · rinnovo · upgrade · evento · premium_client · partner.

**Mappatura form → pipeline (proposta):** vedi §3 (colonna Pipeline). Owner, tag e proprietà custom:
**[DA CONFERMARE]**. Da definire anche eventuale sync contatto registrazione AC ↔ HubSpot.

> Vincolo: non creare/forzare nomi pipeline o owner non esistenti; allinearsi alla configurazione
> reale di HubSpot prima dell'implementazione.

---

# 7. Checklist pre-sviluppo (da validare)

- [ ] URL canonica confermata `maxischermiled.it/assistenza` e fattibilità su WordPress (controllo layout/blocchi).
- [ ] 301 + canonical da `ledcareservice.com`; aggiornare la voce menu "Assistenza" dei siti.
- [ ] Struttura URL varianti (`/rinnovi`, `/upgrade`, `/eventi`) vs varianti dinamiche.
- [ ] Provider form: HubSpot embedded vs custom → HS; campi, consenso privacy, doppio opt-in.
- [ ] Pipeline/owner/tag HubSpot reali confermati (§3, §6).
- [ ] Deep-link Area Cliente (ticket con `impianto`, rinnovo, upgrade) confermati o specificati.
- [ ] Numero WhatsApp ufficiale e `tel:` + aspettative di risposta (senza promesse non confermate).
- [ ] Strumento analytics (GA4?), naming eventi/UTM finale, cookie consent.
- [ ] Contenuti definitivi: copy sezioni, FAQ (base + varianti), trust badge/numeri verificati.
- [ ] Asset: logo, immagini impianti, mock Area Cliente, QR (gestiti in fase UI, non qui).
- [ ] Coerenza nomenclatura: Garanzia/CARE PLUS/CARE ULTRA/ART TECH EVENT/PREMIUM CLIENT; nessun "CARE PREMIUM"; nessun "on-site 1h" come regola.

---

## Riepilogo
Documento-ponte completo: architettura delle 4 pagine landing + Area Cliente, mappe complete di CTA,
form, analytics, integrazione Area Cliente e HubSpot, e checklist pre-sviluppo. Pronto per passare a
UI/UX → landing reale → integrazioni → campagne.

## Decisioni ancora aperte
1. Provider/modalità form e mappatura reale HubSpot (pipeline, owner, tag, sync registrazione).
2. Deep-link Area Cliente per ticket(QR)/rinnovo/upgrade.
3. Struttura URL varianti vs parametri dinamici.
4. Numero WhatsApp/telefono ufficiali e aspettative di risposta.
5. Strumento analytics + consenso cookie + naming definitivo eventi/UTM.
6. Fattibilità della canonica su WordPress con blocchi riutilizzabili.
