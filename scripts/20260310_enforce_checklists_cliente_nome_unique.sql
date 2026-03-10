with ranked as (
  select
    id,
    cliente_id,
    nome_checklist,
    row_number() over (
      partition by cliente_id, nome_checklist
      order by coalesce(updated_at, created_at) desc nulls last, created_at desc nulls last, id desc
    ) as rn,
    count(*) over (partition by cliente_id, nome_checklist) as cnt
  from public.checklists
  where cliente_id is not null
    and nome_checklist is not null
    and btrim(nome_checklist) <> ''
),
to_mark as (
  select
    c.id,
    c.nome_checklist
  from public.checklists c
  join ranked r on r.id = c.id
  where r.cnt > 1
    and r.rn > 1
)
update public.checklists c
set
  nome_checklist = concat(c.nome_checklist, ' [DUPLICATO ', substr(c.id::text, 1, 8), ']'),
  note = concat_ws(
    E'\n',
    nullif(c.note, ''),
    'Rinominato automaticamente come duplicato durante enforcement UNIQUE(cliente_id, nome_checklist).'
  ),
  updated_at = now()
from to_mark t
where c.id = t.id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.checklists'::regclass
      and conname = 'checklists_cliente_id_nome_checklist_key'
  ) then
    alter table public.checklists
      add constraint checklists_cliente_id_nome_checklist_key
      unique (cliente_id, nome_checklist);
  end if;
end
$$;
