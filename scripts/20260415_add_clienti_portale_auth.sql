create table if not exists public.clienti_portale_auth (
  id uuid primary key default gen_random_uuid(),

  cliente_id uuid not null
    references public.clienti_anagrafica(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  email text not null,
  attivo boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clienti_portale_auth_cliente_id_key'
      and conrelid = 'public.clienti_portale_auth'::regclass
  ) then
    alter table public.clienti_portale_auth
      add constraint clienti_portale_auth_cliente_id_key unique (cliente_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clienti_portale_auth_user_id_key'
      and conrelid = 'public.clienti_portale_auth'::regclass
  ) then
    alter table public.clienti_portale_auth
      add constraint clienti_portale_auth_user_id_key unique (user_id);
  end if;
end
$$;

create index if not exists clienti_portale_auth_email_idx
  on public.clienti_portale_auth (lower(email));
