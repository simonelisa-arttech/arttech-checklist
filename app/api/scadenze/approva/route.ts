export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

const TABELLE_AMMESSE = new Set(["rinnovi_servizi", "tagliandi"]);
const STATI_AMMESSI = new Set([
  "PROPOSTO",
  "DA_VERIFICARE",
  "VERIFICATO",
  "APPROVATO",
  "ATTIVO",
  "SCADUTO",
  "STORICIZZATO",
]);

export async function POST(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const tabella = String(body?.origine || body?.tabella || "").trim();
  const rawId = String(body?.raw_id || body?.id || "").trim();
  const nuovoStato = String(body?.lifecycle_status || "ATTIVO").trim().toUpperCase();

  if (!TABELLE_AMMESSE.has(tabella)) {
    return NextResponse.json(
      { error: `origine non valida: ${tabella}. Ammesse: rinnovi_servizi, tagliandi` },
      { status: 400 }
    );
  }
  if (!rawId) return NextResponse.json({ error: "raw_id mancante" }, { status: 400 });
  if (!STATI_AMMESSI.has(nuovoStato)) {
    return NextResponse.json({ error: `lifecycle_status non valido: ${nuovoStato}` }, { status: 400 });
  }

  const verificatoDa =
    (auth.operatore as any)?.nome ||
    (auth.operatore as any)?.email ||
    auth.user?.email ||
    auth.user?.id ||
    "operatore";

  const { data, error } = await auth.adminClient
    .from(tabella)
    .update({
      lifecycle_status: nuovoStato,
      verificato_da: verificatoDa,
      verificato_il: new Date().toISOString(),
    })
    .eq("id", rawId)
    .select("id, lifecycle_status")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Scadenza non trovata" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    origine: tabella,
    raw_id: rawId,
    lifecycle_status: (data as any).lifecycle_status,
    verificato_da: verificatoDa,
  });
}
