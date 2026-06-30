-- EPIC ATSYSTEM -> Inventory Publish
-- STEP 1B - bucket pubblico copertine impianti
-- NON applicare senza approvazione esplicita

insert into storage.buckets (id, name, public)
values ('impianti-cover', 'impianti-cover', true)
on conflict (id) do nothing;

drop policy if exists "impianti-cover public read" on storage.objects;
create policy "impianti-cover public read"
on storage.objects
for select
using (bucket_id = 'impianti-cover');

drop policy if exists "impianti-cover auth write" on storage.objects;
create policy "impianti-cover auth write"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'impianti-cover');

drop policy if exists "impianti-cover auth update" on storage.objects;
create policy "impianti-cover auth update"
on storage.objects
for update
to authenticated
using (bucket_id = 'impianti-cover');

drop policy if exists "impianti-cover auth delete" on storage.objects;
create policy "impianti-cover auth delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'impianti-cover');
