export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { resolveClientePortalAuth } from "@/lib/clientePortalAuth";

function parseLocalDay(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setHours(0, 0, 0, 0);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getRinnovoStato(scadenza?: string | null) {
  const data = parseLocalDay(scadenza);
  if (!data) return "ATTIVO";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return data < today ? "SCADUTO" : "ATTIVO";
}

function getRinnovoTipoLabel(itemTipo?: string | null, subtipo?: string | null) {
  const tipo = String(itemTipo || "").trim().toUpperCase();
  const sub = String(subtipo || "").trim().toUpperCase();
  if (tipo === "LICENZA") return "Licenza";
  if (tipo === "SIM") return "SIM";
  if (tipo === "SAAS" && sub === "ULTRA") return "SaaS Ultra";
  if (tipo === "SAAS") return "SaaS";
  if (tipo === "GARANZIA") return "Garanzia";
  if (tipo === "TAGLIANDO") return "Tagliando";
  if (tipo === "RINNOVO") return "Rinnovo";
  return tipo || "Rinnovo";
}

export async function GET(request: Request) {
  const auth = await resolveClientePortalAuth(request);
  if (!auth.ok) return auth.response;
  if (auth.cliente.attivo === false) {
    return NextResponse.json({ error: "Cliente inattivo" }, { status: 403 });
  }

  const { data: checklistRows, error: checklistErr } = await auth.adminClient
    .from("checklists")
    .select("id, nome_checklist")
    .eq("cliente_id", auth.cliente.cliente_id);

  if (checklistErr) {
    return NextResponse.json({ error: checklistErr.message }, { status: 500 });
  }

  const checklistIds = (checklistRows || [])
    .map((row: any) => String(row?.id || "").trim())
    .filter(Boolean);

  if (checklistIds.length === 0) {
    return NextResponse.json({
      ok: true,
      cliente: {
        cliente_id: auth.cliente.cliente_id,
        email: auth.cliente.email,
        attivo: auth.cliente.attivo,
      },
      rinnovi: [],
    });
  }

  const checklistNameById = new Map<string, string | null>(
    (checklistRows || []).map((row: any) => [
      String(row?.id || "").trim(),
      String(row?.nome_checklist || "").trim() || null,
    ])
  );

  const { data: rinnoviRows, error: rinnoviErr } = await auth.adminClient
    .from("rinnovi_servizi")
    .select("id, checklist_id, item_tipo, subtipo, descrizione, scadenza, stato")
    .in("checklist_id", checklistIds)
    .order("scadenza", { ascending: true });

  if (rinnoviErr) {
    return NextResponse.json({ error: rinnoviErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    cliente: {
      cliente_id: auth.cliente.cliente_id,
      email: auth.cliente.email,
      attivo: auth.cliente.attivo,
    },
    rinnovi: (rinnoviRows || []).map((row: any) => {
      const checklistId = String(row?.checklist_id || "").trim() || null;
      return {
        id: String(row?.id || ""),
        checklist_id: checklistId,
        progetto_nome: checklistId ? checklistNameById.get(checklistId) || null : null,
        tipo: getRinnovoTipoLabel(row?.item_tipo ?? null, row?.subtipo ?? null),
        descrizione: String(row?.descrizione || "").trim() || null,
        data_scadenza: row?.scadenza ?? null,
        stato: getRinnovoStato(row?.scadenza ?? null),
      };
    }),
  });
}
