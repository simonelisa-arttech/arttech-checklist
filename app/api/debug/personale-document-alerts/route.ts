import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";
import {
  buildPersonaleDocumentAlertMessage,
  collectPersonaleDocumentAlertDigest,
} from "@/lib/personaleDocumentAlerts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  try {
    const digest = await collectPersonaleDocumentAlertDigest();
    const message = buildPersonaleDocumentAlertMessage(digest);
    return NextResponse.json({ ok: true, digest, message });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Errore generazione digest documenti personale" },
      { status: 500 }
    );
  }
}
