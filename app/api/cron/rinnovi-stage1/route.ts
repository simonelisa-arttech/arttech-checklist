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
  notify_stage1_sent_at?: string | null;
  checklists?: {
    id: string;
    cliente_id?: string | null;
    nome_checklist: string | null;
    proforma: string | null;
    magazzino_importazione: string | null;
  } | null;
};

type RenewalAlertRuleRow = {
  cliente: string;
  stage: "stage1" | "stage2";
  enabled: boolean;
  mode: "MANUALE" | "AUTOMATICO";
  days_before: number;
  send_to_cliente: boolean;
  send_to_art_tech: boolean;
  art_tech_mode: "OPERATORE" | "EMAIL";
  art_tech_operatore_id: string | null;
  art_tech_email: string | null;
  art_tech_name: string | null;
  stop_condition: "AT_EXPIRY" | "AFTER_FIRST_SEND" | "ON_STATUS";
  stop_statuses: string[];
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

function buildStage1Message(cliente: string, rows: RinnovoRow[]) {
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
    `AVVISO RINNOVI — Cliente: ${cliente || "—"}`,
    `Interventi: ${rows.length}`,
    `Data invio: ${now}`,
    "",
    ...lines,
  ].join("\n");
}

function buildStage1Html(cliente: string, rows: RinnovoRow[]) {
  const title = `Scadenze servizi — ${cliente || "—"}`;
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Missing Supabase envs (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const selectWithClienteId =
    "id, cliente, cliente_id, item_tipo, riferimento, descrizione, checklist_id, scadenza, stato, proforma, cod_magazzino, notify_stage1_sent_at, checklists:checklist_id(id, cliente_id, nome_checklist, proforma, magazzino_importazione)";
  const selectWithoutClienteId =
    "id, cliente, item_tipo, riferimento, descrizione, checklist_id, scadenza, stato, proforma, cod_magazzino, notify_stage1_sent_at, checklists:checklist_id(id, cliente_id, nome_checklist, proforma, magazzino_importazione)";

  let rinnovi: RinnovoRow[] | null = null;
  let rinnoviErr: { message: string } | null = null;

  const withIdRes = await supabase
    .from("rinnovi_servizi")
    .select(selectWithClienteId)
    .eq("stato", "DA_AVVISARE")
    .order("scadenza", { ascending: true });

  if (withIdRes.error && withIdRes.error.message.includes("cliente_id")) {
    const withoutIdRes = await supabase
      .from("rinnovi_servizi")
      .select(selectWithoutClienteId)
      .eq("stato", "DA_AVVISARE")
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

  const rows = (rinnovi || []).filter((r: RinnovoRow) => r.scadenza);
  if (rows.length === 0) {
    return NextResponse.json({ processedClients: 0, processedRows: 0 });
  }

  const { data: rulesData, error: rulesErr } = await supabase
    .from("renewal_alert_rules")
    .select("*")
    .eq("stage", "stage1")
    .eq("enabled", true)
    .eq("mode", "AUTOMATICO");
  if (rulesErr) {
    return NextResponse.json({ error: rulesErr.message }, { status: 500 });
  }
  const rulesMap = new Map<string, RenewalAlertRuleRow>();
  for (const row of (rulesData || []) as RenewalAlertRuleRow[]) {
    rulesMap.set(String(row.cliente || "").trim().toLowerCase(), row);
  }
  if (rulesMap.size === 0) {
    return NextResponse.json({ processedClients: 0, processedRows: 0 });
  }

  const { data: operatori, error: opErr } = await supabase
    .from("operatori")
    .select("id, nome, ruolo, email, attivo, alert_enabled");
  if (opErr) {
    return NextResponse.json({ error: opErr.message }, { status: 500 });
  }

  const systemId = await getSystemOperatoreId(supabase);
  const clienteIds = Array.from(
    new Set(
      rows
        .map((row) => String(row.checklists?.cliente_id || row.cliente_id || "").trim())
        .filter(Boolean)
    )
  );
  const emailByClienteId = new Map<string, string>();
  if (clienteIds.length > 0) {
    const { data: clientiRows } = await supabase
      .from("clienti_anagrafica")
      .select("id, email")
      .in("id", clienteIds);
    for (const row of (clientiRows || []) as any[]) {
      const email = String(row.email || "").trim();
      if (email.includes("@")) emailByClienteId.set(String(row.id), email);
    }
  }
  const grouped = new Map<string, RinnovoRow[]>();
  for (const r of rows) {
    const key = String(r.cliente || r.cliente_id || "—").trim() || "—";
    const list = grouped.get(key) ?? [];
    list.push(r);
    grouped.set(key, list);
  }

  let processedClients = 0;
  let processedRows = 0;
  const nowIso = new Date().toISOString();
  for (const [cliente, list] of grouped.entries()) {
    const rule = rulesMap.get(String(cliente || "").trim().toLowerCase());
    if (!rule) continue;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eligible = list.filter((row) => {
      if (!row.scadenza) return false;
      const dt = new Date(row.scadenza);
      dt.setHours(0, 0, 0, 0);
      const diff = Math.ceil((dt.getTime() - today.getTime()) / 86400000);
      if (diff !== Number(rule.days_before || 0)) return false;
      if (rule.stop_condition === "AFTER_FIRST_SEND" && row.notify_stage1_sent_at) return false;
      if (
        rule.stop_condition === "ON_STATUS" &&
        Array.isArray(rule.stop_statuses) &&
        rule.stop_statuses.includes(String(row.stato || "").toUpperCase())
      ) {
        return false;
      }
      return true;
    });
    if (eligible.length === 0) continue;

    const recipients: Array<{ email: string; name: string | null; operatoreId: string | null }> = [];
    if (rule.send_to_art_tech) {
      if (String(rule.art_tech_mode || "").toUpperCase() === "EMAIL") {
        const email = String(rule.art_tech_email || "").trim();
        if (email.includes("@")) {
          recipients.push({ email, name: rule.art_tech_name || "Art Tech", operatoreId: null });
        }
      } else {
        const recipient =
          (operatori || []).find((row: any) => row.id === rule.art_tech_operatore_id) ||
          getDefaultOperatoreByRole(operatori || [], "SUPERVISORE");
        const email = String(recipient?.email || "").trim();
        if (email.includes("@")) {
          recipients.push({ email, name: recipient?.nome ?? "Art Tech", operatoreId: recipient?.id ?? null });
        }
      }
    }
    if (rule.send_to_cliente) {
      const clienteId = String(eligible[0]?.checklists?.cliente_id || eligible[0]?.cliente_id || "").trim();
      const email = clienteId ? emailByClienteId.get(clienteId) || "" : "";
      if (email.includes("@")) {
        recipients.push({ email, name: "Cliente", operatoreId: null });
      }
    }
    const dedupRecipients = Array.from(
      new Map(recipients.map((recipient) => [recipient.email.toLowerCase(), recipient])).values()
    );
    if (dedupRecipients.length === 0) continue;

    const messaggio = buildStage1Message(cliente, eligible);
    const subject = `[Art Tech] Scadenze servizi – ${cliente || "—"}`;
    const html = buildStage1Html(cliente, eligible);
    for (const recipient of dedupRecipients) {
      try {
        await sendEmail({ to: recipient.email, subject, text: messaggio, html });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Errore invio email";
        await supabase.from("checklist_alert_log").insert({
          checklist_id: eligible[0]?.checklist_id ?? null,
          to_operatore_id: recipient.operatoreId,
          to_email: recipient.email,
          to_nome: recipient.name,
          from_operatore_id: systemId,
          messaggio: `ERRORE INVIO EMAIL: ${errorMsg}\n\n${messaggio}`,
          canale: "rinnovo_stage1_auto_error",
          trigger: "AUTOMATICO",
        });
        return NextResponse.json({ error: errorMsg }, { status: 500 });
      }
      for (const row of eligible) {
        const { error: logErr } = await supabase.from("checklist_alert_log").insert({
          checklist_id: row.checklist_id,
          tipo: row.item_tipo,
          riferimento: row.riferimento,
          stato: row.stato,
          destinatario: `Regola auto ${rule.days_before}gg`,
          to_operatore_id: recipient.operatoreId,
          to_email: recipient.email,
          to_nome: recipient.name,
          from_operatore_id: systemId,
          subject,
          messaggio,
          inviato_email: true,
          trigger: "AUTOMATICO",
          canale: "rinnovo_stage1_auto",
          scadenza: row.scadenza,
        });
        if (logErr) {
          return NextResponse.json({ error: logErr.message }, { status: 500 });
        }
      }
    }

    const ids = eligible.map((r) => r.id);
    const { error: updErr } = await supabase
      .from("rinnovi_servizi")
      .update({
        stato: "AVVISATO",
        notify_stage1_sent_at: nowIso,
        notify_stage1_to_operatore_id: dedupRecipients[0]?.operatoreId ?? null,
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
