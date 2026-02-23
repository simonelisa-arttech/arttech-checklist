# DUPLICATION_FLOW - Dashboard Progetti

## Scopo
Definire cosa succede quando si duplica un progetto.

---

# 1. Copiato

- Checklist base  
- Impianto  
- checklist_items (BOM)  
- checklist_tasks (reset stato = DA_FARE)

---

# 2. NON copiato

- Seriali  
- Licenze  
- SaaS  
- Tagliandi  
- Garanzie  
- Log avvisi  
- rinnovi_servizi  

---

# 3. Rischi noti

- Popup che si chiude su re-render
- Remount causato da key dinamiche
- Redirect prematuro
- Stato React resettato

---

# 4. Test manuale obbligatorio

1. Duplica progetto
2. Verifica redirect corretto
3. Verifica task in DA_FARE
4. Verifica assenza rinnovi/saas/garanzie
