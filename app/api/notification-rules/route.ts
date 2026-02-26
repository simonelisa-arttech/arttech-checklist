export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAccessToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (bearerToken) return bearerToken;

  const cookieToken = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("sb-access-token="))
    ?.split("=")
    .slice(1)
    .join("=");

  return cookieToken || "";
}

async function requireUser(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Missing Supabase envs" }, { status: 500 }),
    };
  }

  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await supabaseAnon.auth.getUser(accessToken);
  if (userErr || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { ok: true as const, adminClient };
}

function normalizeTarget(input: any) {
  const raw = String(input || "")
    .trim()
    .toUpperCase();
  if (raw === "MAGAZZINO") return "MAGAZZINO";
  if (raw === "TECNICO_SW" || raw === "TECNICO SW" || raw === "TECNICO-SW") return "TECNICO_SW";
  if (raw === "ALTRO") return "GENERICA";
  return raw || "GENERICA";
}

function sanitizeEmailList(input: any) {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((x: any) => String(x || "").trim().toLowerCase())
        .filter((x: string) => x.includes("@"))
    )
  );
}

function parseRecipientTokens(input: any) {
  if (Array.isArray(input)) {
    return input
      .map((x: any) => String(x || "").trim())
      .filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(/[\n,;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function parseOnlyFuture(input: any) {
  if (typeof input === "boolean") return input;
  const raw = String(input ?? "")
    .trim()
    .toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return true;
}

function defaultModeByTarget(target: string) {
  return target === "MAGAZZINO" || target === "TECNICO_SW" ? "AUTOMATICA" : "MANUALE";
}

function isMissingColumn(err: any, col: string) {
  return String(err?.message || "").toLowerCase().includes(col.toLowerCase());
}

function isLegacyTaskTargetUniqueViolation(err: any) {
  const code = String(err?.code || "").toLowerCase();
  const msg = String(err?.message || "").toLowerCase();
  return (
    code === "23505" &&
    (msg.includes("notification_rules_task_target_uniq") ||
      msg.includes("task_target_uniq") ||
      (msg.includes("duplicate key") && msg.includes("task_title") && msg.includes("target")))
  );
}

async function getAvailableTargets(adminClient: any) {
  const base = ["GENERICA", "MAGAZZINO", "TECNICO_SW"];
  const out = new Set<string>(base);
  const { data } = await adminClient.from("operatori").select("ruolo").eq("attivo", true);
  for (const row of data || []) {
    const role = normalizeTarget((row as any)?.ruolo);
    if (role) out.add(role);
  }
  return Array.from(out);
}

type OperatoreRecipientRow = {
  nome: string | null;
  email: string | null;
  ruolo: string | null;
  attivo: boolean | null;
  riceve_notifiche?: boolean | null;
  alert_enabled?: boolean | null;
};

async function listOperatoriForNotifications(adminClient: any): Promise<OperatoreRecipientRow[]> {
  const withRiceve = await adminClient
    .from("operatori")
    .select("nome, email, ruolo, attivo, riceve_notifiche")
    .eq("attivo", true);
  if (!withRiceve.error) return (withRiceve.data || []) as OperatoreRecipientRow[];
  if (!isMissingColumn(withRiceve.error, "riceve_notifiche")) {
    throw new Error(withRiceve.error.message);
  }

  const fallback = await adminClient
    .from("operatori")
    .select("nome, email, ruolo, attivo, alert_enabled")
    .eq("attivo", true);
  if (fallback.error) throw new Error(fallback.error.message);
  return ((fallback.data || []) as OperatoreRecipientRow[]).map((o) => ({
    ...o,
    riceve_notifiche: o.alert_enabled !== false,
  }));
}

function buildAutoRecipients(target: string, operatori: OperatoreRecipientRow[]) {
  const normalizedTarget = normalizeTarget(target);
  return Array.from(
    new Set(
      operatori
        .filter((o) => normalizeTarget(o.ruolo) === normalizedTarget)
        .filter((o) => o.riceve_notifiche !== false)
        .map((o) => String(o.email || "").trim().toLowerCase())
        .filter((email) => email.includes("@"))
    )
  );
}

function normalizeLooseText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveExtraRecipientsFromTokens(tokens: string[], operatori: OperatoreRecipientRow[]) {
  const unresolved: string[] = [];
  const resolved: string[] = [];
  const byEmail = new Map<string, string>();
  const byName = new Map<string, string>();

  for (const op of operatori) {
    const email = String(op.email || "").trim().toLowerCase();
    if (!email.includes("@")) continue;
    byEmail.set(email, email);
    const nameKey = normalizeLooseText(String(op.nome || ""));
    if (nameKey) byName.set(nameKey, email);
  }

  for (const rawToken of tokens) {
    const token = rawToken.trim();
    if (!token) continue;
    const low = token.toLowerCase();
    if (low.includes("@")) {
      resolved.push(low);
      continue;
    }
    const normalized = normalizeLooseText(token);
    if (!normalized) continue;

    const exact = byName.get(normalized);
    if (exact) {
      resolved.push(exact);
      continue;
    }

    const containsMatches = Array.from(byName.entries())
      .filter(([name]) => name.includes(normalized) || normalized.includes(name))
      .map(([, email]) => email);
    const unique = Array.from(new Set(containsMatches));
    if (unique.length === 1) {
      resolved.push(unique[0]);
    } else {
      unresolved.push(token);
    }
  }

  return {
    extraRecipients: Array.from(new Set(resolved)),
    unresolved,
  };
}

function withRecipients(rule: any, operatori: OperatoreRecipientRow[]) {
  const extra_recipients = sanitizeEmailList(rule?.recipients);
  const auto_recipients = buildAutoRecipients(String(rule?.target || "GENERICA"), operatori);
  const effective_recipients = Array.from(new Set([...auto_recipients, ...extra_recipients]));
  return {
    ...(rule || {}),
    recipients: extra_recipients,
    extra_recipients,
    auto_recipients,
    effective_recipients,
  };
}

async function listRulesForTask(
  adminClient: any,
  taskTitle: string,
  target: string,
  taskTemplateId: string | null
) {
  const selectWithChecklist =
    "id, enabled, mode, checklist_id, task_template_id, task_title, target, recipients, frequency, send_time, timezone, day_of_week, only_future, send_on_create, created_at, updated_at";
  const selectFallback =
    "id, enabled, mode, task_template_id, task_title, target, recipients, frequency, send_time, timezone, only_future, send_on_create, created_at, updated_at";

  let q = adminClient
    .from("notification_rules")
    .select(selectWithChecklist)
    .eq("task_title", taskTitle)
    .eq("target", target)
    .order("created_at", { ascending: false });
  if (taskTemplateId) q = q.eq("task_template_id", taskTemplateId);

  let { data, error } = await q;
  if (error && isMissingColumn(error, "send_on_create")) {
    let qS = adminClient
      .from("notification_rules")
      .select(
        "id, enabled, mode, checklist_id, task_template_id, task_title, target, recipients, frequency, send_time, timezone, day_of_week, only_future, created_at, updated_at"
      )
      .eq("task_title", taskTitle)
      .eq("target", target)
      .order("created_at", { ascending: false });
    if (taskTemplateId) qS = qS.eq("task_template_id", taskTemplateId);
    const res = await qS;
    data = (res.data || []).map((r: any) => ({ ...r, send_on_create: false }));
    error = res.error;
  }
  if (error && isMissingColumn(error, "day_of_week")) {
    let q2 = adminClient
      .from("notification_rules")
      .select(selectFallback)
      .eq("task_title", taskTitle)
      .eq("target", target)
      .order("created_at", { ascending: false });
    if (taskTemplateId) q2 = q2.eq("task_template_id", taskTemplateId);
    const res = await q2;
    data = (res.data || []).map((r: any) => ({ ...r, day_of_week: null, checklist_id: null, send_on_create: false }));
    error = res.error;
  }
  if (error && isMissingColumn(error, "checklist_id")) {
    let q3 = adminClient
      .from("notification_rules")
      .select(selectFallback)
      .eq("task_title", taskTitle)
      .eq("target", target)
      .order("created_at", { ascending: false });
    if (taskTemplateId) q3 = q3.eq("task_template_id", taskTemplateId);
    const res = await q3;
    data = (res.data || []).map((r: any) => ({ ...r, checklist_id: null, day_of_week: null }));
    error = res.error;
  }
  if (error && isMissingColumn(error, "task_template_id")) {
    const selectNoTemplate =
      "id, enabled, mode, checklist_id, task_title, target, recipients, frequency, send_time, timezone, only_future, send_on_create, created_at, updated_at";
    const selectNoTemplateNoChecklist =
      "id, enabled, mode, task_title, target, recipients, frequency, send_time, timezone, only_future, send_on_create, created_at, updated_at";
    const res = await adminClient
      .from("notification_rules")
      .select(selectNoTemplate)
      .eq("task_title", taskTitle)
      .eq("target", target)
      .order("created_at", { ascending: false });
    data = (res.data || []).map((r: any) => ({ ...r, task_template_id: null, day_of_week: null }));
    error = res.error;
    if (error && isMissingColumn(error, "checklist_id")) {
      const res2 = await adminClient
        .from("notification_rules")
        .select(selectNoTemplateNoChecklist)
        .eq("task_title", taskTitle)
        .eq("target", target)
        .order("created_at", { ascending: false });
      data = (res2.data || []).map((r: any) => ({
        ...r,
        task_template_id: null,
        checklist_id: null,
        day_of_week: null,
        send_on_create: false,
      }));
      error = res2.error;
    }
  }
  return { data: (data || []) as any[], error };
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const taskTemplateId = String(url.searchParams.get("task_template_id") || "").trim() || null;
  const taskTitle = String(url.searchParams.get("task_title") || "").trim();
  const target = normalizeTarget(url.searchParams.get("target"));
  const checklistId = String(url.searchParams.get("checklist_id") || "").trim() || null;

  const availableTargets = await getAvailableTargets(auth.adminClient);
  let operatori: OperatoreRecipientRow[] = [];
  try {
    operatori = await listOperatoriForNotifications(auth.adminClient);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Errore caricamento operatori" }, { status: 500 });
  }

  if (!taskTitle) {
    return NextResponse.json({
      ok: true,
      effective_rule: null,
      global_rule: null,
      override_rule: null,
      data: [],
      available_targets: availableTargets,
    });
  }

  const { data: rows, error } = await listRulesForTask(
    auth.adminClient,
    taskTitle,
    target,
    taskTemplateId
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const globalRule = rows.find((r: any) => !r.checklist_id) || null;
  const overrideRule = checklistId
    ? rows.find((r: any) => String(r.checklist_id || "") === checklistId) || null
    : null;

  const virtualRule = {
    id: null,
    checklist_id: checklistId,
    task_template_id: taskTemplateId,
    enabled: true,
    mode: defaultModeByTarget(target),
    task_title: taskTitle,
    target,
    recipients: [],
    frequency: "DAILY",
    send_time: "07:30",
    timezone: "Europe/Rome",
    day_of_week: null,
    send_on_create: false,
    only_future: true,
    created_at: null,
    updated_at: null,
  };

  const effectiveRule = withRecipients(overrideRule || globalRule || virtualRule, operatori);
  const globalWithRecipients = globalRule ? withRecipients(globalRule, operatori) : null;
  const overrideWithRecipients = overrideRule ? withRecipients(overrideRule, operatori) : null;

  return NextResponse.json({
    ok: true,
    effective_rule: effectiveRule,
    global_rule: globalWithRecipients,
    override_rule: overrideWithRecipients,
    data: [effectiveRule],
    available_targets: availableTargets,
    auto_recipients: effectiveRule.auto_recipients,
    extra_recipients: effectiveRule.extra_recipients,
    effective_recipients: effectiveRule.effective_recipients,
  });
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const taskTemplateId = String(body?.task_template_id || "").trim() || null;
  const taskTitle = String(body?.task_title || "").trim();
  const checklistId = String(body?.checklist_id || "").trim() || null;
  const target = normalizeTarget(body?.target);
  if (!taskTitle) {
    return NextResponse.json({ error: "Missing task_title" }, { status: 400 });
  }

  const tokens = parseRecipientTokens(body?.recipients);
  let operatori: OperatoreRecipientRow[] = [];
  try {
    operatori = await listOperatoriForNotifications(auth.adminClient);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Errore caricamento operatori" }, { status: 500 });
  }
  const resolvedExtra = resolveExtraRecipientsFromTokens(tokens, operatori);
  if (resolvedExtra.unresolved.length > 0) {
    return NextResponse.json(
      {
        error:
          `Destinatari non riconosciuti: ${resolvedExtra.unresolved.join(", ")}. ` +
          "Usa email valide o nomi operatore esatti.",
        unresolved_tokens: resolvedExtra.unresolved,
      },
      { status: 400 }
    );
  }
  const frequency = String(body?.frequency || "DAILY").trim().toUpperCase();
  const dayOfWeek =
    body?.day_of_week === null || body?.day_of_week === undefined || body?.day_of_week === ""
      ? null
      : Number(body.day_of_week);

  const payload = {
    checklist_id: checklistId,
    enabled: body?.enabled !== false,
    mode: String(body?.mode || defaultModeByTarget(target)).trim().toUpperCase(),
    task_template_id: taskTemplateId,
    task_title: taskTitle,
    target,
    recipients: resolvedExtra.extraRecipients,
    frequency,
    send_time: String(body?.send_time || "07:30").trim(),
    timezone: String(body?.timezone || "Europe/Rome").trim() || "Europe/Rome",
    day_of_week: dayOfWeek,
    send_on_create: body?.send_on_create === true,
    only_future: parseOnlyFuture(body?.only_future),
  };

  let existingQuery = auth.adminClient
    .from("notification_rules")
    .select("id")
    .eq("task_title", taskTitle)
    .eq("target", target)
    .limit(1);
  if (checklistId) {
    existingQuery = existingQuery.eq("checklist_id", checklistId);
  } else {
    existingQuery = existingQuery.is("checklist_id", null);
  }

  let { data: existing, error: existingErr } = await existingQuery.maybeSingle();
  if (existingErr && isMissingColumn(existingErr, "checklist_id")) {
    if (checklistId) {
      return NextResponse.json(
        { error: "Schema DB non aggiornato: manca notification_rules.checklist_id" },
        { status: 500 }
      );
    }
    existing = null;
    existingErr = null;
  }
  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });

  const selectSaved =
    "id, enabled, mode, checklist_id, task_template_id, task_title, target, recipients, frequency, send_time, timezone, day_of_week, only_future, send_on_create, created_at, updated_at";

  if (existing?.id) {
    const { data, error } = await auth.adminClient
      .from("notification_rules")
      .update(payload)
      .eq("id", existing.id)
      .select(selectSaved)
      .single();
    if (error && isMissingColumn(error, "send_on_create")) {
      const compatPayload = { ...payload } as any;
      delete compatPayload.send_on_create;
      const res = await auth.adminClient
        .from("notification_rules")
        .update(compatPayload)
        .eq("id", existing.id)
        .select(
          "id, enabled, mode, checklist_id, task_template_id, task_title, target, recipients, frequency, send_time, timezone, day_of_week, only_future, created_at, updated_at"
        )
        .single();
      if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
      const dataWithRecipients = withRecipients({ ...(res.data as any), send_on_create: false }, operatori);
      return NextResponse.json({ ok: true, data: dataWithRecipients });
    }
    if (error && isMissingColumn(error, "checklist_id")) {
      const compatPayload = { ...payload } as any;
      delete compatPayload.checklist_id;
      delete compatPayload.day_of_week;
      const res = await auth.adminClient
        .from("notification_rules")
        .update(compatPayload)
        .eq("id", existing.id)
        .select(
          "id, enabled, mode, task_template_id, task_title, target, recipients, frequency, send_time, timezone, only_future, send_on_create, created_at, updated_at"
        )
        .single();
      if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
      const dataWithRecipients = withRecipients(
        { ...(res.data as any), checklist_id: null, day_of_week: null },
        operatori
      );
      return NextResponse.json({ ok: true, data: dataWithRecipients });
    }
    if (error && isMissingColumn(error, "day_of_week")) {
      const compatPayload = { ...payload } as any;
      delete compatPayload.day_of_week;
      const res = await auth.adminClient
        .from("notification_rules")
        .update(compatPayload)
        .eq("id", existing.id)
        .select(
          "id, enabled, mode, checklist_id, task_template_id, task_title, target, recipients, frequency, send_time, timezone, only_future, send_on_create, created_at, updated_at"
        )
        .single();
      if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
      const dataWithRecipients = withRecipients({ ...(res.data as any), day_of_week: null }, operatori);
      return NextResponse.json({ ok: true, data: dataWithRecipients });
    }
    if (error && isMissingColumn(error, "task_template_id")) {
      const compatPayload = { ...payload } as any;
      delete compatPayload.task_template_id;
      delete compatPayload.day_of_week;
      const res = await auth.adminClient
        .from("notification_rules")
        .update(compatPayload)
        .eq("id", existing.id)
        .select(
          "id, enabled, mode, checklist_id, task_title, target, recipients, frequency, send_time, timezone, only_future, send_on_create, created_at, updated_at"
        )
        .single();
      if (res.error && isMissingColumn(res.error, "checklist_id")) {
        const res2 = await auth.adminClient
          .from("notification_rules")
          .update(compatPayload)
          .eq("id", existing.id)
          .select(
            "id, enabled, mode, task_title, target, recipients, frequency, send_time, timezone, only_future, send_on_create, created_at, updated_at"
          )
          .single();
        if (res2.error) return NextResponse.json({ error: res2.error.message }, { status: 500 });
        const dataWithRecipients = withRecipients(
          { ...(res2.data as any), checklist_id: null, task_template_id: null, day_of_week: null },
          operatori
        );
        return NextResponse.json({ ok: true, data: dataWithRecipients });
      }
      if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
      const dataWithRecipients = withRecipients(
        { ...(res.data as any), task_template_id: null, day_of_week: null },
        operatori
      );
      return NextResponse.json({ ok: true, data: dataWithRecipients });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: withRecipients(data, operatori) });
  }

  const { data, error } = await auth.adminClient
    .from("notification_rules")
    .insert(payload)
    .select(selectSaved)
    .single();
  if (error && isLegacyTaskTargetUniqueViolation(error)) {
    // Compat mode per schema legacy: esiste unicità globale (task_title,target)
    // e non può coesistere override progetto + globale.
    // In questo caso aggiorniamo la regola esistente invece di fallire.
    const { data: legacyExisting, error: legacyErr } = await auth.adminClient
      .from("notification_rules")
      .select("id")
      .eq("task_title", taskTitle)
      .eq("target", target)
      .limit(1)
      .maybeSingle();
    if (legacyErr) return NextResponse.json({ error: legacyErr.message }, { status: 500 });
    if (!legacyExisting?.id) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: legacySaved, error: legacySaveErr } = await auth.adminClient
      .from("notification_rules")
      .update(payload)
      .eq("id", legacyExisting.id)
      .select(selectSaved)
      .single();
    if (legacySaveErr) return NextResponse.json({ error: legacySaveErr.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      data: withRecipients(legacySaved, operatori),
      warning:
        "Schema legacy: override progetto non separabile da regola globale (vincolo unico task_title,target).",
    });
  }
  if (error && isMissingColumn(error, "send_on_create")) {
    const compatPayload = { ...payload } as any;
    delete compatPayload.send_on_create;
    const res = await auth.adminClient
      .from("notification_rules")
      .insert(compatPayload)
      .select(
        "id, enabled, mode, checklist_id, task_template_id, task_title, target, recipients, frequency, send_time, timezone, day_of_week, only_future, created_at, updated_at"
      )
      .single();
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      data: withRecipients({ ...(res.data as any), send_on_create: false }, operatori),
    });
  }
  if (error && isMissingColumn(error, "checklist_id")) {
    if (checklistId) {
      return NextResponse.json(
        { error: "Schema DB non aggiornato: manca notification_rules.checklist_id" },
        { status: 500 }
      );
    }
    const compatPayload = { ...payload } as any;
    delete compatPayload.checklist_id;
    delete compatPayload.day_of_week;
    const res = await auth.adminClient
      .from("notification_rules")
      .insert(compatPayload)
      .select(
        "id, enabled, mode, task_template_id, task_title, target, recipients, frequency, send_time, timezone, only_future, send_on_create, created_at, updated_at"
      )
      .single();
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      data: withRecipients({ ...(res.data as any), checklist_id: null, day_of_week: null }, operatori),
    });
  }
  if (error && isMissingColumn(error, "day_of_week")) {
    const compatPayload = { ...payload } as any;
    delete compatPayload.day_of_week;
    const res = await auth.adminClient
      .from("notification_rules")
      .insert(compatPayload)
      .select(
        "id, enabled, mode, checklist_id, task_template_id, task_title, target, recipients, frequency, send_time, timezone, only_future, send_on_create, created_at, updated_at"
      )
      .single();
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      data: withRecipients({ ...(res.data as any), day_of_week: null }, operatori),
    });
  }
  if (error && isMissingColumn(error, "task_template_id")) {
    const compatPayload = { ...payload } as any;
    delete compatPayload.task_template_id;
    delete compatPayload.day_of_week;
    const res = await auth.adminClient
      .from("notification_rules")
      .insert(compatPayload)
      .select(
        "id, enabled, mode, checklist_id, task_title, target, recipients, frequency, send_time, timezone, only_future, send_on_create, created_at, updated_at"
      )
      .single();
    if (res.error && isMissingColumn(res.error, "checklist_id")) {
      if (checklistId) {
        return NextResponse.json(
          { error: "Schema DB non aggiornato: manca notification_rules.checklist_id" },
          { status: 500 }
        );
      }
      const res2 = await auth.adminClient
        .from("notification_rules")
        .insert(compatPayload)
        .select(
          "id, enabled, mode, task_title, target, recipients, frequency, send_time, timezone, only_future, send_on_create, created_at, updated_at"
        )
        .single();
      if (res2.error) return NextResponse.json({ error: res2.error.message }, { status: 500 });
      return NextResponse.json({
        ok: true,
        data: withRecipients(
          { ...(res2.data as any), checklist_id: null, task_template_id: null, day_of_week: null },
          operatori
        ),
      });
    }
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      data: withRecipients({ ...(res.data as any), task_template_id: null, day_of_week: null }, operatori),
    });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data: withRecipients(data, operatori) });
}

export async function DELETE(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const checklistId = String(url.searchParams.get("checklist_id") || "").trim();
  const taskTitle = String(url.searchParams.get("task_title") || "").trim();
  const target = normalizeTarget(url.searchParams.get("target"));

  if (!checklistId || !taskTitle) {
    return NextResponse.json({ error: "Missing checklist_id or task_title" }, { status: 400 });
  }

  const { error } = await auth.adminClient
    .from("notification_rules")
    .delete()
    .eq("checklist_id", checklistId)
    .eq("task_title", taskTitle)
    .eq("target", target);

  if (error && isMissingColumn(error, "checklist_id")) {
    return NextResponse.json(
      { error: "Schema DB non aggiornato: manca notification_rules.checklist_id" },
      { status: 500 }
    );
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
