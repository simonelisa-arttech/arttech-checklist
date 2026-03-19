create table if not exists public.scadenze_alert_global_rules (
  id uuid primary key default gen_random_uuid(),
  tipo_scadenza text not null check (tipo_scadenza in ('LICENZA', 'TAGLIANDO', 'GARANZIA', 'SAAS')),
  attivo boolean not null default true,
  enabled_steps integer[] not null default array[30,15,7,1]::integer[],
  default_delivery_mode text not null default 'AUTO_CLIENTE' check (default_delivery_mode in ('AUTO_CLIENTE', 'MANUALE_INTERNO')),
  default_target text not null default 'CLIENTE' check (default_target in ('CLIENTE', 'ART_TECH', 'CLIENTE_E_ART_TECH')),
  default_template_id uuid null references public.alert_message_templates(id) on delete set null,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists scadenze_alert_global_rules_tipo_uniq
  on public.scadenze_alert_global_rules (tipo_scadenza);

create or replace function public.set_scadenze_alert_global_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_scadenze_alert_global_rules_updated_at on public.scadenze_alert_global_rules;
create trigger trg_scadenze_alert_global_rules_updated_at
before update on public.scadenze_alert_global_rules
for each row
execute function public.set_scadenze_alert_global_rules_updated_at();
