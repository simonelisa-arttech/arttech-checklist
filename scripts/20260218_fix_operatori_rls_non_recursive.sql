-- Fix RLS recursion on public.operatori
-- Run in Supabase SQL Editor.

alter table public.operatori enable row level security;

-- Drop known/legacy recursive policies if present.
drop policy if exists "operatori_select_self" on public.operatori;
drop policy if exists "operatori_update_self" on public.operatori;
drop policy if exists "Users can view their own operator row" on public.operatori;
drop policy if exists "Users can update their own operator row" on public.operatori;
drop policy if exists "operatori_select_by_role_recursive" on public.operatori;
drop policy if exists "operatori_update_by_role_recursive" on public.operatori;

-- Safety cleanup: remove any policy names that include recursive hints.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'operatori'
      and (
        policyname ilike '%recursive%'
        or policyname ilike '%operatori_select%'
        or policyname ilike '%operatori_update%'
      )
  loop
    execute format('drop policy if exists %I on public.operatori', p.policyname);
  end loop;
end $$;

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
