# Checklist Art Tech

## Prerequisiti
- Node.js 18.17+ (consigliato 20+)
- npm

## Setup rapido
```bash
npm install
cp .env.example .env.local
# compila .env.local
npm run dev
```

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
- I cron usano **solo** `SUPABASE_SERVICE_ROLE_KEY` (se manca, si fermano).

## Cron (Vercel)
Esempio di schedule (da configurare in `vercel.json`):
- `/api/cron/rinnovi-stage1` ogni mattina
- `/api/cron/rinnovi-stage2` ogni mattina

Le chiamate devono includere header:
`Authorization: Bearer ${CRON_SECRET}`

Se Vercel Cron non supporta header custom, puoi usare il fallback:
`/api/cron/rinnovi-stage1?secret=${CRON_SECRET}`
`/api/cron/rinnovi-stage2?secret=${CRON_SECRET}`
