-- Definitive fix for public.operatori RLS recursion + FK target
-- Run in Supabase SQL Editor.

-- 1) Drop ALL existing policies on public.operatori
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'operatori'
  loop
    execute format('drop policy if exists %I on public.operatori', p.policyname);
  end loop;
end $$;

-- 2) Ensure RLS is enabled
alter table public.operatori enable row level security;

-- 3) Recreate minimal non-recursive policies
create policy "operatori_select_self"
on public.operatori
for select
to authenticated
using (user_id = auth.uid());

create policy "operatori_update_self"
on public.operatori
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 4) FK correction: operatori.user_id -> auth.users(id)
alter table public.operatori
  drop constraint if exists operatori_user_id_fkey;

alter table public.operatori
  add constraint operatori_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on update cascade
  on delete set null;
