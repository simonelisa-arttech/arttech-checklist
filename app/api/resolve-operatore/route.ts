export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

export async function GET(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({ ok: true, operatore_id: auth.operatore.id });
}
