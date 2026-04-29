export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { resolveClientePortalAuth } from "@/lib/clientePortalAuth";
import { resolveClientePortalSettings } from "@/lib/clientePortalVisibility";

export async function GET(request: Request) {
  const auth = await resolveClientePortalAuth(request);
  if (!auth.ok) return auth.response;

  const settings = await resolveClientePortalSettings(auth.cliente.cliente_id);

  return NextResponse.json({
    ok: true,
    cliente: {
      cliente_id: auth.cliente.cliente_id,
      email: auth.cliente.email,
      attivo: auth.cliente.attivo,
    },
    settings,
    impersonation: auth.impersonation,
    impersonated_by_operatore_id: auth.impersonated_by_operatore_id,
  });
}
