import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

export const runtime = "nodejs";

type MissingEmailReason = "NULL" | "EMPTY" | "SOLO_SPAZI" | "NO_AT";
type MissingEmailListRow = {
  id: string | null;
  denominazione: string | null;
  email: string | null;
  attivo: boolean | null;
  motivo: MissingEmailReason;
  possible_duplicate: boolean;
};

function getMissingEmailReason(emailValue?: string | null): MissingEmailReason | null {
  if (emailValue === null || emailValue === undefined) return "NULL";
  if (emailValue === "") return "EMPTY";
  const trimmed = String(emailValue).trim();
  if (!trimmed) return "SOLO_SPAZI";
  if (!trimmed.includes("@")) return "NO_AT";
  return null;
}

function getDuplicateKey(denominazione?: string | null) {
  return String(denominazione || "").trim().toLowerCase();
}

export async function GET(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.adminClient
    .from("clienti_anagrafica")
    .select("id, denominazione, email, attivo")
    .order("denominazione", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []) as Array<{
    id?: string | null;
    denominazione?: string | null;
    email?: string | null;
    attivo?: boolean | null;
  }>;

  const duplicateCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.attivo === false) continue;
    const key = getDuplicateKey(row.denominazione);
    if (!key) continue;
    duplicateCounts.set(key, (duplicateCounts.get(key) || 0) + 1);
  }

  const result = rows.reduce<MissingEmailListRow[]>((acc, row) => {
    if (row.attivo === false) return acc;
    const reason = getMissingEmailReason(row.email);
    if (!reason) return acc;
    const duplicateKey = getDuplicateKey(row.denominazione);
    acc.push({
        id: row.id || null,
        denominazione: row.denominazione || null,
        email: row.email ?? null,
        attivo: row.attivo ?? null,
        motivo: reason,
        possible_duplicate: duplicateKey ? (duplicateCounts.get(duplicateKey) || 0) > 1 : false,
      });
    return acc;
  }, []);

  return NextResponse.json(result);
}
