# Checklist Art Tech

## Operativi in 10 minuti
Prerequisiti:
- Node.js LTS
- Git
- Accesso al progetto Supabase

Setup:
```bash
git clone <repo>
cd <repo>
npm install
cp .env.example .env.local
# compila .env.local con le chiavi
npm run dev
```

Compila `.env.local` con:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Dove prendere le chiavi Supabase:
Supabase Dashboard → Project Settings → API:
- Project URL
- anon public key
- service_role key (solo server, non deve andare in client)

## Variabili ambiente
Da impostare in `.env.local` (locale) e in produzione (es. Vercel):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Note importanti:
- Non usare mai `SUPABASE_SERVICE_ROLE_KEY` con prefisso `NEXT_PUBLIC_`.
- Non committare mai `SUPABASE_SERVICE_ROLE_KEY`.
- I cron usano **solo** `SUPABASE_SERVICE_ROLE_KEY` (se manca, si fermano).

## Troubleshooting rapido
- “Missing SUPABASE_SERVICE_ROLE_KEY” → manca env o non hai riavviato `npm run dev`
- 401/403 → RLS/permessi su Supabase
- “relation does not exist” → migrazioni/script non applicati

## Checklist sicurezza DevTools
- Apri DevTools → Network (abilita “Preserve log”)
- Ricarica la pagina
- Filtra “supabase” / “rest/v1”
- Apri una request → Headers
- Verifica che NON compaia mai `SUPABASE_SERVICE_ROLE_KEY` in header o querystring
- Devono esserci solo chiamate a `/api/...` oppure anon key lato client (ok)

## Ruoli operativi
- SUPERVISORE: riceve alert stage1 scadenze/avvisi, può segnare CONFERMATO / NON_RINNOVATO
- AMMINISTRAZIONE: riceve alert stage2 DA_FATTURARE, può segnare FATTURATO
- OPERATORE: interventi/checklist/notes/allegati + alert interventi (manuale)

## Dati demo (opzionale)
Se vuoi popolare rapidamente la UI, usa `scripts/seed-demo.sql` nel SQL Editor di Supabase.

## Workflow consigliato
- feature branch → PR → merge su main

## Cron (Vercel)
Esempio di schedule (da configurare in `vercel.json`):
- `/api/cron/rinnovi-stage1` ogni mattina
- `/api/cron/rinnovi-stage2` ogni mattina

Le chiamate devono includere header:
`Authorization: Bearer ${CRON_SECRET}`

Se Vercel Cron non supporta header custom, puoi usare il fallback:
`/api/cron/rinnovi-stage1?secret=${CRON_SECRET}`
`/api/cron/rinnovi-stage2?secret=${CRON_SECRET}`

## Rimozione dati demo
I dati demo servono solo per onboarding/preview.  
Per identificarli, cerca clienti “DEMO” o record con note/descrizioni “demo” (o un eventuale `is_demo = true`).  
Per rimuoverli, usa `scripts/cleanup-demo.sql` oppure elimina manualmente i record demo da clienti/checklist/rinnovi/interventi. **Da eseguire solo in ambienti non produttivi.**
