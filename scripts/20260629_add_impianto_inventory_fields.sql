-- EPIC ATSYSTEM -> Inventory Publish
-- STEP 1A - campi additivi su checklist_impianti
-- NON applicare senza approvazione esplicita

alter table public.checklist_impianti
add column if not exists screen_code text,
add column if not exists inventory_enabled boolean not null default false,
add column if not exists inventory_status text not null default 'coming_soon',
add column if not exists audience text,
add column if not exists lat double precision,
add column if not exists lng double precision,
add column if not exists inventory_synced_at timestamptz;

do $$
begin
if not exists (
select 1
from pg_constraint
where conname = 'checklist_impianti_inventory_status_chk'
and conrelid = 'public.checklist_impianti'::regclass
) then
alter table public.checklist_impianti
add constraint checklist_impianti_inventory_status_chk
check (inventory_status in ('draft','coming_soon','live'));
end if;
end $$;

create unique index if not exists checklist_impianti_screen_code_uidx
on public.checklist_impianti (screen_code)
where screen_code is not null;
