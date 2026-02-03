export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

type OperatoreRow = {
  id: string;
  nome: string | null;
  ruolo: string | null;
  email: string | null;
  attivo: boolean | null;
  alert_enabled: boolean | null;
};

type LicenzaRow = {
  id: string;
  checklist_id: string | null;
  scadenza: string | null;
  tipo: string | null;
  status?: string | null;
  stato?: string | null;
  note?: string | null;
  ref_univoco?: string | null;
  telefono?: string | null;
  intestatario?: string | null;
  gestore?: string | null;
  fornitore?: string | null;
  checklists?: { cliente: string | null; nome_checklist: string | null } | null;
};

type TagliandoRow = {
  id: string;
  cliente: string | null;
  checklist_id: string | null;
  scadenza: string | null;
  stato: string | null;
  note: string | null;
  modalita: string | null;
  checklists?: { nome_checklist: string | null } | null;
};

const REMINDER_DAYS = [60, 30, 15];

function startOfDay(d: Date) {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function daysUntil(target: Date, today: Date) {
  const diff = target.getTime() - today.getTime();
  return Math.round(diff / (24 * 60 * 60 * 1000));
}

function getDefaultOperatoreByRole(ops: OperatoreRow[], role: string) {
  const target = ops.find(
    (o) =>
      o.attivo !== false &&
      o.alert_enabled &&
      String(o.ruolo || "").toUpperCase() === role
  );
  if (target) return target;
  return ops.find((o) => o.attivo !== false && o.alert_enabled) ?? null;
}

async function getSystemOperatoreId(supabase: any) {
  type RowId = { id: string };
  const { data: row, error } = await supabase
    .from("operatori")
    .select("id")
    .or("nome.ilike.SYSTEM,ruolo.ilike.SYSTEM")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const rowId = (row as RowId | null)?.id ?? null;
  if (rowId) return rowId;
  const { data: inserted, error: insertErr } = await supabase
    .from("operatori")
    .insert({
      nome: "SYSTEM",
      ruolo: "SYSTEM",
      attivo: false,
      alert_enabled: false,
    } as any)
    .select("id")
    .single();
  if (insertErr) return null;
  return (inserted as { id?: string } | null)?.id ?? null;
}

async function hasTriggerLog(
  supabase: any,
  params: { checklist_id: string | null; tipo: string; riferimento: string; trigger: string }
) {
  const { data, error } = await supabase
    .from("checklist_alert_log")
    .select("id")
    .eq("checklist_id", params.checklist_id)
    .eq("tipo", params.tipo)
    .eq("riferimento", params.riferimento)
    .eq("trigger", params.trigger)
    .limit(1);
  if (error) return false;
  return (data || []).length > 0;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const hasValidHeader = authHeader === `Bearer ${cronSecret}`;
  const hasValidQuery = cronSecret && querySecret === cronSecret;
  if (!hasValidHeader && !hasValidQuery) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase envs (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const today = startOfDay(new Date());
  const maxDays = Math.max(...REMINDER_DAYS);
  const limitDate = new Date(today);
  limitDate.setDate(today.getDate() + maxDays);
  const fromDate = today.toISOString().slice(0, 10);
  const toDate = limitDate.toISOString().slice(0, 10);

  const { data: operatori, error: opErr } = await supabase
    .from("operatori")
    .select("id, nome, ruolo, email, attivo, alert_enabled");
  if (opErr) {
    return NextResponse.json({ error: opErr.message }, { status: 500 });
  }
  const recipient = getDefaultOperatoreByRole(operatori || [], "SUPERVISORE");
  const toEmail = recipient?.email ?? null;
  if (!toEmail) {
    return NextResponse.json({ error: "Missing recipient email" }, { status: 500 });
  }
  const systemId = await getSystemOperatoreId(supabase);

  const { data: licenzeData, error: licErr } = await supabase
    .from("licenses")
    .select(
      "id, checklist_id, scadenza, tipo, status, stato, note, ref_univoco, telefono, intestatario, gestore, fornitore, checklists:checklist_id(cliente, nome_checklist)"
    )
    .gte("scadenza", fromDate)
    .lte("scadenza", toDate);
  if (licErr) {
    return NextResponse.json({ error: licErr.message }, { status: 500 });
  }

  const { data: tagliandiData, error: tagErr } = await supabase
    .from("tagliandi")
    .select("id, cliente, checklist_id, scadenza, stato, note, modalita, checklists:checklist_id(nome_checklist)")
    .gte("scadenza", fromDate)
    .lte("scadenza", toDate);
  if (tagErr) {
    return NextResponse.json({ error: tagErr.message }, { status: 500 });
  }

  let sentCount = 0;
  let skippedCount = 0;

  for (const l of (licenzeData || []) as LicenzaRow[]) {
    const scad = parseDate(l.scadenza);
    if (!scad) continue;
    const diff = daysUntil(scad, today);
    if (!REMINDER_DAYS.includes(diff)) continue;
    const trigger = `auto_${diff}`;
    const riferimento = l.id;
    const hasLog = await hasTriggerLog(supabase, {
      checklist_id: l.checklist_id ?? null,
      tipo: "LICENZA",
      riferimento,
      trigger,
    });
    if (hasLog) {
      skippedCount += 1;
      continue;
    }
    const clienteLabel = l.checklists?.cliente ?? "—";
    const progetto = l.checklists?.nome_checklist ?? l.checklist_id ?? "—";
    const subject = `[Art Tech] Reminder ${diff}gg – ${clienteLabel}`;
    const refParts = [
      l.ref_univoco,
      l.telefono,
      l.intestatario,
      l.gestore,
      l.fornitore,
      l.note,
    ].filter(Boolean);
    const riferimentoLabel = refParts.join(" · ") || l.id;
    const message = [
      `REMINDER LICENZA (${diff}gg) — Cliente: ${clienteLabel}`,
      `Scadenza: ${scad.toLocaleDateString("it-IT")}`,
      `PROGETTO: ${progetto}`,
      `Riferimento: ${riferimentoLabel}`,
    ].join("\n");
    const html = `<div>${message.replace(/\n/g, "<br/>")}</div>`;
    try {
      await sendEmail({ to: toEmail, subject, text: message, html });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Errore invio email";
      await supabase.from("checklist_alert_log").insert({
        checklist_id: l.checklist_id ?? null,
        to_operatore_id: recipient?.id ?? null,
        to_email: toEmail,
        to_nome: recipient?.nome ?? null,
        from_operatore_id: systemId,
        tipo: "LICENZA",
        riferimento,
        messaggio: `ERRORE INVIO EMAIL: ${errorMsg}\n\n${message}`,
        canale: "reminder_auto_error",
        trigger,
      });
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
    await supabase.from("checklist_alert_log").insert({
      checklist_id: l.checklist_id ?? null,
      to_operatore_id: recipient?.id ?? null,
      to_email: toEmail,
      to_nome: recipient?.nome ?? null,
      from_operatore_id: systemId,
      tipo: "LICENZA",
      riferimento,
      messaggio: message,
      canale: "reminder_auto",
      trigger,
    });
    await supabase
      .from("licenses")
      .update({
        alert_sent_at: new Date().toISOString(),
        alert_to: toEmail,
      })
      .eq("id", l.id);
    sentCount += 1;
  }

  for (const t of (tagliandiData || []) as TagliandoRow[]) {
    const scad = parseDate(t.scadenza);
    if (!scad) continue;
    const diff = daysUntil(scad, today);
    if (!REMINDER_DAYS.includes(diff)) continue;
    const trigger = `auto_${diff}`;
    const riferimento = t.id;
    const hasLog = await hasTriggerLog(supabase, {
      checklist_id: t.checklist_id ?? null,
      tipo: "TAGLIANDO",
      riferimento,
      trigger,
    });
    if (hasLog) {
      skippedCount += 1;
      continue;
    }
    const clienteLabel = t.cliente ?? "—";
    const progetto = t.checklists?.nome_checklist ?? t.checklist_id ?? "—";
    const subject = `[Art Tech] Reminder ${diff}gg – ${clienteLabel}`;
    const modalita = t.modalita ? `Modalità: ${String(t.modalita).toUpperCase()}` : "";
    const message = [
      `REMINDER TAGLIANDO (${diff}gg) — Cliente: ${clienteLabel}`,
      `Scadenza: ${scad.toLocaleDateString("it-IT")}`,
      `PROGETTO: ${progetto}`,
      t.note ? `Note: ${t.note}` : "",
      modalita,
    ]
      .filter(Boolean)
      .join("\n");
    const html = `<div>${message.replace(/\n/g, "<br/>")}</div>`;
    try {
      await sendEmail({ to: toEmail, subject, text: message, html });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Errore invio email";
      await supabase.from("checklist_alert_log").insert({
        checklist_id: t.checklist_id ?? null,
        to_operatore_id: recipient?.id ?? null,
        to_email: toEmail,
        to_nome: recipient?.nome ?? null,
        from_operatore_id: systemId,
        tipo: "TAGLIANDO",
        riferimento,
        messaggio: `ERRORE INVIO EMAIL: ${errorMsg}\n\n${message}`,
        canale: "reminder_auto_error",
        trigger,
      });
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
    await supabase.from("checklist_alert_log").insert({
      checklist_id: t.checklist_id ?? null,
      to_operatore_id: recipient?.id ?? null,
      to_email: toEmail,
      to_nome: recipient?.nome ?? null,
      from_operatore_id: systemId,
      tipo: "TAGLIANDO",
      riferimento,
      messaggio: message,
      canale: "reminder_auto",
      trigger,
    });
    await supabase
      .from("tagliandi")
      .update({
        alert_last_sent_at: new Date().toISOString(),
        alert_last_sent_by_operatore: systemId,
      })
      .eq("id", t.id);
    sentCount += 1;
  }

  return NextResponse.json({ ok: true, sentCount, skippedCount });
}
