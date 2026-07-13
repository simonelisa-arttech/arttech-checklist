/**
 * Utility per query Supabase con filtri `.in(colonna, ids)` su liste potenzialmente grandi.
 * Con centinaia/migliaia di id un unico `.in()` genera un URL oltre il limite del gateway
 * PostgREST (HTTP 400 "Bad Request"). Spezzare in batch evita il problema.
 *
 * Esempio:
 *   const rows = await selectInChunks(ids, (chunk) =>
 *     admin.from("checklist_tasks").select("checklist_id, stato").in("checklist_id", chunk)
 *   );
 */
export function chunkArray<T>(arr: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type SupabaseResult<R> = { data: R[] | null; error: { message: string } | null };

/**
 * Esegue `queryFn` per ogni batch di `ids` e concatena i risultati.
 * Rilancia un Error al primo errore Supabase.
 */
export async function selectInChunks<R>(
  ids: string[],
  queryFn: (chunk: string[]) => PromiseLike<SupabaseResult<R>>,
  size = 100
): Promise<R[]> {
  const out: R[] = [];
  for (const chunk of chunkArray(ids, size)) {
    if (chunk.length === 0) continue;
    const { data, error } = await queryFn(chunk);
    if (error) throw new Error(error.message);
    if (data) out.push(...data);
  }
  return out;
}
