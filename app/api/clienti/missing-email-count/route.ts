import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.adminClient
    .from("clienti_anagrafica")
    .select("email, attivo");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const count = ((data || []) as Array<{ email?: string | null; attivo?: boolean | null }>).reduce(
    (total, row) => {
      if (row.attivo === false) return total;
      const email = String(row.email || "").trim();
      const hasValidEmail = email.includes("@");
      return hasValidEmail ? total : total + 1;
    },
    0
  );

  return NextResponse.json({ count });
}
