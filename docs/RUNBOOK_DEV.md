# RUNBOOK DEV - AT SYSTEM

## Avvio locale

pnpm install
pnpm dev

Typecheck:
npx tsc --noEmit

---

## Deploy produzione

git pull origin main
git push origin main

Vercel auto-deploy.

---

## Se modifica DB

1. Creare script in /scripts
2. Eseguire su Supabase SQL Editor
3. Annotare in HANDOFF_CONTEXT.md
4. Verificare constraint

---

## Debug Rinnovi

Checklist:

- Stato corretto in DB?
- Mapping corretto?
- subtipo coerente?
- UI aggiornata senza refresh?
- Duplicati presenti?
