export function parseDimensioniToM2(input?: string | null): number | null {
  if (!input) return null;
  const s = input
    .toLowerCase()
    .replaceAll(",", ".")
    .replace(/[×\*]/g, "x")
    .replace(/\s+/g, " ")
    .trim();

  const m = s.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;

  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  const area = a * b;
  if (area <= 0) return null;
  return area;
}

export function parseDimensioniToWH(
  input?: string | null
): { larghezza: number; altezza: number } | null {
  if (!input) return null;
  const s = input
    .toLowerCase()
    .replaceAll(",", ".")
    .replace(/[×\*]/g, "x")
    .replace(/\s+/g, " ")
    .trim();
  const m = s.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const larghezza = Number(m[1]);
  const altezza = Number(m[2]);
  if (!Number.isFinite(larghezza) || !Number.isFinite(altezza)) return null;
  if (larghezza <= 0 || altezza <= 0) return null;
  return { larghezza, altezza };
}

export function calcM2FromDimensioni(
  dimensioni?: string | null,
  numeroFacce?: number | null
): number | null {
  const wh = parseDimensioniToWH(dimensioni);
  if (!wh) return null;
  const facceRaw = Number(numeroFacce ?? 1);
  const facce = Number.isFinite(facceRaw) && facceRaw > 0 ? facceRaw : 1;
  const area = wh.larghezza * wh.altezza * facce;
  return Math.round(area * 100) / 100;
}

export function calcM2Totale(
  righe: Array<{ dimensioni?: string | null; qty?: string | number | null }>
): number {
  return righe.reduce((sum, r) => {
    const area = parseDimensioniToM2(r.dimensioni);
    if (!area) return sum;
    const rawQty = r.qty ?? 1;
    const qty = typeof rawQty === "string" ? Number(rawQty) : rawQty;
    if (!Number.isFinite(qty) || qty <= 0) return sum;
    return sum + area * qty;
  }, 0);
}
