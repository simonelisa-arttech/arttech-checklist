# DB_SCHEMA - Tabelle Critiche

## rinnovi_servizi

Campi rilevanti:
- id
- checklist_id
- item_tipo
- subtipo
- stato
- data_scadenza

Constraint:
rinnovi_servizi_item_tipo_check

Valori ammessi item_tipo:
- LICENZA
- TAGLIANDO
- SAAS
- RINNOVO
- GARANZIA

SAAS_ULTRA = SAAS + subtipo ULTRA

---

## checklists

Contiene:
- saas_*
- garanzia_*
- dati impianto

---

## tagliandi
Tabella autonoma.

---

## licenze
Gestita via API.
