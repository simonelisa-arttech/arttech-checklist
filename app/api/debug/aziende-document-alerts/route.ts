export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  buildAziendeDocumentAlertMessage,
  collectAziendeDocumentAlertDigest,
} from "@/lib/aziendeDocumentAlerts";

export async function GET() {
  try {
    const digest = await collectAziendeDocumentAlertDigest();
    const message = buildAziendeDocumentAlertMessage(digest);

    return NextResponse.json({
      ok: true,
      digest,
      message,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Errore debug alert documenti aziende",
      },
      { status: 500 }
    );
  }
}
