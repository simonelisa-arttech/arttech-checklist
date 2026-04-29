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

function getTagliandoStato(scadenza?: string | null) {
  const data = parseLocalDay(scadenza);
  if (!data) return "ATTIVO";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return data < today ? "SCADUTO" : "ATTIVO";
}

function getTagliandoTipoLabel(modalita?: string | null) {
  const raw = String(modalita || "").trim().toUpperCase();
  if (raw === "ANNUALE") return "Annuale";
  if (raw === "PERIODICO") return "Periodico";
  if (raw === "SEMESTRALE") return "Semestrale";
  if (raw === "MENSILE") return "Mensile";
  return raw || "Tagliando";
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
      tagliandi: [],
    });
  }

  const checklistNameById = new Map<string, string | null>(
    (checklistRows || []).map((row: any) => [
      String(row?.id || "").trim(),
      String(row?.nome_checklist || "").trim() || null,
    ])
  );

  const { data: tagliandiRows, error: tagliandiErr } = await auth.adminClient
    .from("tagliandi")
    .select("id, checklist_id, modalita, note, scadenza, stato, created_at")
    .in("checklist_id", checklistIds)
    .order("scadenza", { ascending: true })
    .order("created_at", { ascending: true });

  if (tagliandiErr) {
    return NextResponse.json({ error: tagliandiErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    cliente: {
      cliente_id: auth.cliente.cliente_id,
      email: auth.cliente.email,
      attivo: auth.cliente.attivo,
    },
    tagliandi: (tagliandiRows || []).map((row: any) => {
      const checklistId = String(row?.checklist_id || "").trim() || null;
      return {
        id: String(row?.id || ""),
        checklist_id: checklistId,
        progetto_nome: checklistId ? checklistNameById.get(checklistId) || null : null,
        tipo: getTagliandoTipoLabel(row?.modalita ?? null),
        descrizione: String(row?.note || "").trim() || null,
        data_scadenza: row?.scadenza ?? null,
        stato: getTagliandoStato(row?.scadenza ?? null),
      };
    }),
  });
}
