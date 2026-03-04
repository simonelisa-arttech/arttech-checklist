# Safety Audit RLS - Ordine di esecuzione

1. Eseguire audit:
```sql
\i scripts/20260304_safety_audit.sql
```

2. Se audit mostra `has_authenticated_select_policy = false` o `grant_select_authenticated = false`
su tabelle runtime (`checklists`, `clienti_anagrafica`, `saas_interventi`, `operatori`), applicare:
```sql
\i scripts/20260304_dashboard_rls_min_select.sql
```

3. Rieseguire audit e verificare:
- `rls_enabled = true`
- `has_authenticated_select_policy = true` sulle tabelle runtime
- `has_anon_or_public_policy = false` salvo scelta esplicita

## Issue runtime da monitorare

- Dashboard vuota:
  - SQL fix idempotente: `20260304_dashboard_rls_min_select.sql`
  - Code fix: dashboard deve caricare via `/api/dashboard` (service role), non con query client diretta.

- Delete con backup fallisce (`permission denied ... checklists_backup`):
  - SQL fix: non dare grant a `authenticated` su backup.
  - Code fix: usare solo API server `/api/checklists/delete-with-backup` con `supabaseAdmin`.

- Cron/attachments/interventi con RLS FORCE:
  - SQL fix: policy/grant minimi solo se audit evidenzia blocchi sulle tabelle runtime.
  - Code fix: operazioni amministrative in `app/api/**` con service role; client solo `fetch`.
