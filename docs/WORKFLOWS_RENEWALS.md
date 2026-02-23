# WORKFLOWS_RENEWALS - AT SYSTEM

## Scopo
Documentare il funzionamento completo del sistema Scadenze & Rinnovi.

---

# 1. Workflow Stati

DA_AVVISARE  
-> AVVISATO  
-> CONFERMATO  
-> DA_FATTURARE  
-> FATTURATO  

Stati opzionali:
- NON_RINNOVATO

Non introdurre nuovi stati senza aggiornare:
- DB
- getWorkflowStato
- UI badge
- documentazione

---

# 2. Fonti che generano rinnoviAll

| Source | Origine |
|--------|---------|
| rinnovi | tabella rinnovi_servizi |
| tagliandi | tabella tagliandi |
| licenze | tabella licenze |
| saas | campi saas_* in checklists |
| saas_contratto | tabella saas_contratti |
| garanzie | campi garanzia_* in checklists |

---

# 3. Mapping tipi

SAAS → item_tipo: "SAAS", subtipo: null  
SAAS_ULTRA → item_tipo: "SAAS", subtipo: "ULTRA"  
GARANZIA → item_tipo: "GARANZIA", subtipo: null  

ATTENZIONE: SAAS_ULTRA NON e un item_tipo DB.

---

# 4. Funzioni Chiave

- getWorkflowStato(r)
- getRinnovoMatch(r)
- ensureRinnovoForItem(r)
- mapRinnovoTipo(tipo)

Qualsiasi modifica a una di queste richiede test manuale completo.

---

# 5. Problemi storici

- Stato non aggiornato dopo invio alert
- Constraint violation su GARANZIA
- Creazione duplicati rinnovi_servizi
