-- Riallineamento definitivo operatori.user_id <-> auth.users.id
-- Esegui in Supabase SQL Editor con service role.

begin;

-- 0) Diagnostica rapida: eventuali duplicati email in operatori
-- (se restituisce righe, va gestito manualmente prima di imporre vincoli unici)
select lower(email) as email_norm, count(*)
from public.operatori
where email is not null
group by lower(email)
having count(*) > 1;

-- 1) Pulisce user_id non validi (puntano a utenti auth non più esistenti)
update public.operatori o
set user_id = null
where o.user_id is not null
  and not exists (
    select 1 from auth.users u where u.id = o.user_id
  );

-- 2) Backfill generale: collega per email case-insensitive
with matched as (
  select o.id as operatore_id, u.id as auth_user_id
  from public.operatori o
  join auth.users u
    on lower(coalesce(o.email, '')) = lower(coalesce(u.email, ''))
)
update public.operatori o
set user_id = m.auth_user_id
from matched m
where o.id = m.operatore_id
  and (o.user_id is null or o.user_id <> m.auth_user_id);

-- 3) Fix mirato per le varianti note (davide/davice)
with target as (
  select u.id as auth_user_id, lower(u.email) as auth_email
  from auth.users u
  where lower(u.email) in (
    's.davide@maxischermiled.it',
    's.davice@maxischermiled.it'
  )
)
update public.operatori o
set user_id = t.auth_user_id,
    email = coalesce(o.email, t.auth_email)
from target t
where lower(coalesce(o.email, '')) in (
    's.davide@maxischermiled.it',
    's.davice@maxischermiled.it'
  )
  and (o.user_id is null or o.user_id <> t.auth_user_id);

commit;

-- 4) Verifica finale
select
  o.id,
  o.nome,
  o.email,
  o.user_id,
  u.email as auth_email,
  o.attivo
from public.operatori o
left join auth.users u on u.id = o.user_id
where lower(coalesce(o.email, '')) in (
  's.davide@maxischermiled.it',
  's.davice@maxischermiled.it'
)
order by o.nome;
