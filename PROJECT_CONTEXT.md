> ⚠️ Questo documento è la fonte di verità del progetto.
> Se qualcosa qui contraddice il codice, **vince questo file**.

# AT SYSTEM – Project Context

## Stato del progetto (Febbraio 2026)

AT SYSTEM è una web app interna per Art Tech che gestisce:
- Clienti
- Progetti (ex checklist)
- Scadenze e rinnovi
- Licenze, SaaS, Garanzie, Tagliandi
- Avvisi email manuali e automatici
- Storico avvisi
- Seriali hardware
- Preparazione futura: magazzino, ricambi, noleggi

Stack:
- Next.js (App Router)
- Supabase (Postgres + Auth)
- Vercel
- Resend (email)

---

## Concetti chiave

### PROGETTO (ex Checklist)
Ogni progetto rappresenta un impianto.
Può avere:
- Codice magazzino
- Dimensioni
- Licenze
- SaaS
- Garanzie
- Tagliandi
- Seriali hardware

Il termine “Checklist” è mantenuto solo nella pagina operativa interna.

---

## Scadenze & Rinnovi (CUORE OPERATIVO)

Un’unica tabella riepiloga TUTTE le scadenze:
- LICENZA
- TAGLIANDO
- SAAS
- SAAS_ULTRA
- GARANZIA

Ogni riga può:
- Inviare avvisi email
- Passare da DA_AVVISARE → AVVISATO → CONFERMATO
- Gestire fatturazione (dove previsto)
- Essere modificata tramite modale

Badge:
- AVVISATO (n) con tooltip dettagliato
- Scadenze entro 30gg (solo future)

---

## Avvisi Email

- Inviati tramite /api/send-alert
- Provider: Resend
- Mittente fisso: progetti@maxischermiled.it
- Supporto:
  - Operatore
  - Email manuale
- Log completo in checklist_alert_log
- Trigger supportati:
  - MANUALE
  - 60GG / 30GG / 15GG

---

## Preset Avvisi

Gestiti da tabella:
alert_message_templates

CRUD completo via UI:
- Tipo: LICENZA / TAGLIANDO / GENERICO
- Trigger: MANUALE / 60GG / 30GG / 15GG
- Subject + body con placeholder
- Attivo / Disattivo

Usati nel modale “Invia avviso”.

---

## Storico Avvisi

Pagina dedicata:
- Filtri per cliente, progetto, tipo, periodo
- Colonna progetto
- Export CSV
- Link diretto dai badge AVVISATO

---

## Seriali Hardware

Tabella asset_serials:
- CONTROLLO (player, modem, sending card) → univoco per progetto
- MODULO_LED → può essere usato su più progetti
- Campo note per modello/componente
- Ricerca per seriale in dashboard
- “Usato anche in…” visibile in scheda progetto

---

## Stato attuale

✔️ Avvisi funzionanti
✔️ Email inviate correttamente
✔️ Log DB completo
✔️ Preset avvisi funzionanti
✔️ ULTRA cliente-level gestito
✔️ Seriali integrati

---

## Prossimi obiettivi (NON ANCORA IMPLEMENTATI)

- Avvisi automatici giornalieri su task non completati
- Magazzino ricambi:
  - stock
  - assegnazione a operatori
  - ricambi usati / guasti / in riparazione
- Noleggi:
  - disponibilità
  - danni
  - addebiti
- Dashboard ruoli (coordinatore / magazzino / tecnico)

⚠️ Qualsiasi modifica deve rispettare questa architettura.
