export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

type RinnovoRow = {
  id: string;
  cliente: string | null;
  cliente_id?: string | null;
  item_tipo: string | null;
  riferimento: string | null;
  descrizione: string | null;
  checklist_id: string | null;
  scadenza: string | null;
  stato: string | null;
  proforma: string | null;
  cod_magazzino: string | null;
  confirmed_at: string | null;
  checklists?: {
    id: string;
    nome_checklist: string | null;
    proforma: string | null;
    magazzino_importazione: string | null;
  } | null;
};

type OperatoreRow = {
  id: string;
  nome: string | null;
  ruolo: string | null;
  email: string | null;
  attivo: boolean | null;
  alert_enabled: boolean | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildStage2Message(cliente: string, rows: RinnovoRow[]) {
  const now = new Date().toLocaleString("it-IT");
  const lines = rows.map((r) => {
    const tipo = String(r.item_tipo || "ALTRO").toUpperCase();
    const ref = r.riferimento || r.descrizione || r.checklist_id?.slice(0, 8) || "—";
    const scadenza = r.scadenza ? new Date(r.scadenza).toLocaleDateString("it-IT") : "—";
    const checklist = r.checklists ?? null;
    const checklistName = checklist?.nome_checklist ?? r.checklist_id?.slice(0, 8) ?? "—";
    const proforma = r.proforma || checklist?.proforma || "—";
    const codMag = r.cod_magazzino || checklist?.magazzino_importazione || "—";
    const link = r.checklist_id ? `/checklists/${r.checklist_id}` : null;
    const linkLabel = link ? ` | Link: ${link}` : "";
    return `- ${tipo} | ${ref} | Scadenza: ${scadenza} | Checklist: ${checklistName}${linkLabel} | Proforma: ${proforma} | CodMag: ${codMag}`;
  });
  return [
    `FATTURAZIONE RINNOVI — Cliente: ${cliente || "—"}`,
    `Interventi: ${rows.length}`,
    `Data invio: ${now}`,
    "",
    ...lines,
  ].join("\n");
}

function buildStage2Html(cliente: string, rows: RinnovoRow[]) {
  const title = `Da fatturare — ${cliente || "—"}`;
  const items = rows
    .map((r) => {
      const tipo = String(r.item_tipo || "ALTRO").toUpperCase();
      const ref = r.riferimento || r.descrizione || r.checklist_id?.slice(0, 8) || "—";
      const scadenza = r.scadenza ? new Date(r.scadenza).toLocaleDateString("it-IT") : "—";
      const checklist = r.checklists ?? null;
      const checklistName = checklist?.nome_checklist ?? r.checklist_id?.slice(0, 8) ?? "—";
      const proforma = r.proforma || checklist?.proforma || "—";
      const codMag = r.cod_magazzino || checklist?.magazzino_importazione || "—";
      const link = r.checklist_id ? `/checklists/${r.checklist_id}` : "";
      return `<li><strong>${escapeHtml(tipo)}</strong> — ${escapeHtml(
        ref
      )} • Scadenza: ${escapeHtml(scadenza)} • Checklist: ${escapeHtml(
        checklistName
      )}${link ? ` • Link: ${escapeHtml(link)}` : ""} • Proforma: ${escapeHtml(
        proforma
      )} • CodMag: ${escapeHtml(codMag)}</li>`;
    })
    .join("");
  return `
    <div>
      <h2>${escapeHtml(title)}</h2>
      <ul>${items}</ul>
      <p style="font-size:12px;color:#6b7280">Messaggio automatico Art Tech.</p>
    </div>
  `;
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

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const hasValidHeader = authHeader === `Bearer ${cronSecret}`;
  const hasValidQuery = querySecret === cronSecret;
  if (!cronSecret || (!hasValidHeader && !hasValidQuery)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Missing Supabase envs (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const selectWithClienteId =
    "id, cliente, cliente_id, item_tipo, riferimento, descrizione, checklist_id, scadenza, stato, proforma, cod_magazzino, confirmed_at, billing_notified_at, checklists:checklist_id(id, nome_checklist, proforma, magazzino_importazione)";
  const selectWithoutClienteId =
    "id, cliente, item_tipo, riferimento, descrizione, checklist_id, scadenza, stato, proforma, cod_magazzino, confirmed_at, billing_notified_at, checklists:checklist_id(id, nome_checklist, proforma, magazzino_importazione)";

  let rinnovi: RinnovoRow[] | null = null;
  let rinnoviErr: { message: string } | null = null;

  const withIdRes = await supabase
    .from("rinnovi_servizi")
    .select(selectWithClienteId)
    .eq("stato", "DA_FATTURARE")
    .is("billing_notified_at", null)
    .not("confirmed_at", "is", null)
    .order("scadenza", { ascending: true });

  if (withIdRes.error && withIdRes.error.message.includes("cliente_id")) {
    const withoutIdRes = await supabase
      .from("rinnovi_servizi")
      .select(selectWithoutClienteId)
      .eq("stato", "DA_FATTURARE")
      .is("billing_notified_at", null)
      .not("confirmed_at", "is", null)
      .order("scadenza", { ascending: true });
    rinnovi = (withoutIdRes.data ?? []) as unknown as RinnovoRow[];
    rinnoviErr = withoutIdRes.error ? { message: withoutIdRes.error.message } : null;
  } else {
    rinnovi = (withIdRes.data ?? []) as unknown as RinnovoRow[];
    rinnoviErr = withIdRes.error ? { message: withIdRes.error.message } : null;
  }

  if (rinnoviErr) {
    return NextResponse.json({ error: rinnoviErr.message }, { status: 500 });
  }

  const rows = (rinnovi || []).filter((r: RinnovoRow) => r.id);
  if (rows.length === 0) {
    return NextResponse.json({ processedClients: 0, processedRows: 0 });
  }

  const { data: operatori, error: opErr } = await supabase
    .from("operatori")
    .select("id, nome, ruolo, email, attivo, alert_enabled");
  if (opErr) {
    return NextResponse.json({ error: opErr.message }, { status: 500 });
  }

  const systemId = await getSystemOperatoreId(supabase);
  const grouped = new Map<string, RinnovoRow[]>();
  for (const r of rows) {
    const key = String(r.cliente_id || r.cliente || "—").trim() || "—";
    const list = grouped.get(key) ?? [];
    list.push(r);
    grouped.set(key, list);
  }

  let processedClients = 0;
  let processedRows = 0;
  const nowIso = new Date().toISOString();
  for (const [cliente, list] of grouped.entries()) {
    const recipient = getDefaultOperatoreByRole(operatori || [], "AMMINISTRAZIONE");
    const toEmail = recipient?.email ?? null;
    if (!toEmail) {
      const errorMsg = `Nessuna email destinatario per cliente: ${cliente}`;
      console.error(errorMsg);
      await supabase.from("checklist_alert_log").insert({
        checklist_id: null,
        task_id: null,
        task_template_id: null,
        to_operatore_id: recipient?.id ?? null,
        to_email: null,
        to_nome: recipient?.nome ?? null,
        from_operatore_id: systemId,
        messaggio: errorMsg,
        canale: "rinnovo_stage2_auto_error",
      });
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
    const messaggio = buildStage2Message(cliente, list);
    const subject = `[Art Tech] Da fatturare – ${cliente || "—"}`;
    const html = buildStage2Html(cliente, list);
    try {
      await sendEmail({ to: toEmail, subject, text: messaggio, html });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Errore invio email";
      console.error(errorMsg);
      await supabase.from("checklist_alert_log").insert({
        checklist_id: null,
        task_id: null,
        task_template_id: null,
        to_operatore_id: recipient?.id ?? null,
        to_email: toEmail,
        to_nome: recipient?.nome ?? null,
        from_operatore_id: systemId,
        messaggio: `ERRORE INVIO EMAIL: ${errorMsg}\n\n${messaggio}`,
        canale: "rinnovo_stage2_auto_error",
      });
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
    const checklistId = list.find((r) => r.checklist_id)?.checklist_id ?? null;
    const { error: logErr } = await supabase.from("checklist_alert_log").insert({
      checklist_id: checklistId,
      task_id: null,
      task_template_id: null,
      to_operatore_id: recipient?.id ?? null,
      to_email: toEmail,
      to_nome: recipient?.nome ?? null,
      from_operatore_id: systemId,
      messaggio,
      canale: "rinnovo_stage2_auto",
    });
    if (logErr) {
      return NextResponse.json({ error: logErr.message }, { status: 500 });
    }

    const ids = list.map((r) => r.id);
    const { error: updErr } = await supabase
      .from("rinnovi_servizi")
      .update({
        billing_notified_at: nowIso,
        billing_stage2_sent_at: nowIso,
        billing_stage2_to_operatore_id: recipient?.id ?? null,
      })
      .in("id", ids);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    processedClients += 1;
    processedRows += ids.length;
  }

  return NextResponse.json({ processedClients, processedRows });
}
