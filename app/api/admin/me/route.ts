export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    ok: true,
    isAdmin: true,
    operatore: {
      id: auth.operatore.id,
      nome: auth.operatore.nome,
      email: auth.operatore.email,
      ruolo: auth.operatore.ruolo,
    },
  });
}
