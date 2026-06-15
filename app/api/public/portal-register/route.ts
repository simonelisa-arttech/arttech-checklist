export const runtime = "nodejs";

/**
 * POST /api/public/portal-register
 *
 * Auto-registrazione area cliente con verifica email:
 * - Se l'email corrisponde a un cliente in clienti_anagrafica → crea
 *   credenziali (Supabase Auth + clienti_portale_auth) e le invia via email.
 *   Le credenziali arrivano SOLO all'email in anagrafica: chi inserisce
 *   l'email di un altro cliente non riceve nulla.
 * - Se non corrisponde (o corrisponde a più clienti) → richiesta in
 *   approvazione staff (tabella portal_registration_requests) + notifica email.
 *
 * Pubblico (esente middleware via /api/public/), protetto da rate limit + honeypot.
 * CORS: maxischermo.biz + atsystem stesso + ALLOWED_ORIGINS.
 */

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email";

// ── Rate limit ───────────────────────────────────────────────────────────────
type RateLimitEntry = { count: number; resetAt: number };
const rateLimitMap = new Map<string, RateLimitEntry>();

function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(ip: string, limit = 5, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

// ── CORS ─────────────────────────────────────────────────────────────────────
const PORTAL_ORIGINS = [
  "https://www.maxischermo.biz",
  "https://maxischermo.biz",
  "https://atsystem.arttechworld.com",
  "http://localhost:8000", // test locale portale
  "http://127.0.0.1:8000", // test locale portale
  "http://localhost:3000", // dev next
];

function getAllowedOrigins(): string[] {
  const env = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...PORTAL_ORIGINS, ...env];
}

function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // curl / server-side
  return getAllowedOrigins().includes(origin);
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  const allowed = getAllowedOrigins().includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

// ── Helpers credenziali (stessa logica di /api/clienti/portal-access) ────────
function isValidEmail(value?: string | null) {
  const email = String(value || "").trim().toLowerCase();
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function generateTemporaryPassword(length = 16) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i += 1) {
    password += alphabet[bytes[i] % alphabet.length];
  }
  return password;
}

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://atsystem.arttechworld.com"
  ).replace(/\/+$/, "");
}

async function sendCredentialsEmail(input: {
  email: string;
  clienteDenominazione?: string | null;
  temporaryPassword: string;
}) {
  const nomeCliente = String(input.clienteDenominazione || "cliente").trim();
  const loginUrl = `${getSiteUrl()}/login`;
  await sendEmail({
    to: input.email,
    subject: "Benvenuto nell'area cliente - AT SYSTEM",
    text: [
      `Gentile ${nomeCliente},`,
      "",
      "la tua registrazione all'area cliente AT SYSTEM è stata completata.",
      `Email: ${input.email}`,
      `Password temporanea: ${input.temporaryPassword}`,
      `Accedi da: ${loginUrl}`,
      "",
      "Ti consigliamo di cambiare la password al primo accesso.",
    ].join("\n"),
    html: [
      `<p>Gentile ${nomeCliente},</p>`,
      "<p>la tua registrazione all'area cliente AT SYSTEM è stata completata.</p>",
      `<p><strong>Email:</strong> ${input.email}<br /><strong>Password temporanea:</strong> ${input.temporaryPassword}</p>`,
      `<p><a href="${loginUrl}">Accedi all'area cliente</a></p>`,
      "<p>Ti consigliamo di cambiare la password al primo accesso.</p>",
    ].join(""),
  });
}

async function notifyStaffPendingRequest(input: {
  email: string;
  denominazione?: string | null;
  piva?: string | null;
  telefono?: string | null;
  codice_ordine?: string | null;
  messaggio?: string | null;
  motivo: string;
}) {
  const to =
    process.env.REGISTRATION_NOTIFY_EMAIL ||
    process.env.EMAIL_FROM ||
    "ticket@maxischermiled.it";
  const righe = [
    `Email: ${input.email}`,
    `Ragione sociale: ${input.denominazione || "-"}`,
    `P.IVA: ${input.piva || "-"}`,
    `Telefono: ${input.telefono || "-"}`,
    `Codice ordine/commessa: ${input.codice_ordine || "-"}`,
    `Messaggio: ${input.messaggio || "-"}`,
    `Motivo verifica manuale: ${input.motivo}`,
  ];
  try {
    await sendEmail({
      to,
      // Reply-To = email del richiedente: il ticket HubSpot aperto via
      // email-to-ticket resta collegato al contatto e si puo' rispondere subito.
      replyTo: input.email,
      subject: `[Area Cliente] Nuova richiesta registrazione da verificare: ${input.email}`,
      text: ["Nuova richiesta di registrazione area cliente in attesa di approvazione.", "", ...righe].join("\n"),
      html: [
        "<p>Nuova richiesta di registrazione area cliente <strong>in attesa di approvazione</strong>.</p>",
        "<ul>",
        ...righe.map((r) => `<li>${r}</li>`),
        "</ul>",
        `<p>Per attivare l'accesso: AT SYSTEM → Clienti → scheda cliente → Area cliente → Crea credenziali.</p>`,
      ].join(""),
    });
  } catch {
    // la notifica non deve bloccare la registrazione
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────────
export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const cors = corsHeaders(request);

  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Origin non consentito" }, { status: 403, headers: cors });
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Troppe richieste, riprova tra qualche minuto" },
      { status: 429, headers: cors }
    );
  }

  let body: {
    email?: string;
    denominazione?: string;
    piva?: string;
    telefono?: string;
    codice_ordine?: string;
    messaggio?: string;
    website?: string; // honeypot
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400, headers: cors });
  }

  // Honeypot anti-bot: campo nascosto, se compilato fingiamo successo
  if (String(body?.website || "").trim().length > 0) {
    return NextResponse.json({ ok: true, status: "pending" }, { status: 200, headers: cors });
  }

  const email = String(body?.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Email non valida" }, { status: 400, headers: cors });
  }

  const clean = (v?: string) => {
    const s = String(v || "").trim();
    return s.length > 0 ? s.slice(0, 300) : null;
  };
  const denominazione = clean(body?.denominazione);
  const piva = clean(body?.piva);
  const telefono = clean(body?.telefono);
  const codiceOrdine = clean(body?.codice_ordine);
  const messaggio = clean(body?.messaggio);

  const admin = getSupabaseAdmin();

  // 1. Match email in anagrafica
  const { data: matches, error: matchErr } = await admin
    .from("clienti_anagrafica")
    .select("id, denominazione, email, attivo")
    .ilike("email", email)
    .limit(3);
  if (matchErr) {
    return NextResponse.json({ error: "Errore interno" }, { status: 500, headers: cors });
  }

  const attivi = (matches || []).filter((c) => c.attivo !== false);

  const insertRequest = async (stato: string, clienteId: string | null, motivo: string) => {
    try {
      await admin.from("portal_registration_requests").insert({
        email,
        denominazione,
        piva,
        telefono,
        codice_ordine: codiceOrdine,
        messaggio,
        stato,
        cliente_id: clienteId,
        ip,
        motivo,
      });
    } catch {
      // log richiesta non bloccante
    }
  };

  // 2. Nessun match o match ambiguo → richiesta pending + notifica staff
  if (attivi.length !== 1) {
    const motivo =
      attivi.length === 0
        ? "Email non presente in anagrafica"
        : "Email associata a più clienti";
    await insertRequest("pending", null, motivo);
    await notifyStaffPendingRequest({ email, denominazione, piva, telefono, codice_ordine: codiceOrdine, messaggio, motivo });
    return NextResponse.json(
      {
        ok: true,
        status: "pending",
        message:
          "Richiesta ricevuta. I tuoi dati non risultano ancora associati a un progetto: il nostro staff verificherà la richiesta e riceverai le credenziali via email entro 1 giorno lavorativo.",
      },
      { status: 200, headers: cors }
    );
  }

  const cliente = attivi[0];

  // 3. Accesso già esistente?
  const { data: existing, error: existingErr } = await admin
    .from("clienti_portale_auth")
    .select("id, attivo")
    .eq("cliente_id", cliente.id)
    .maybeSingle();
  if (existingErr) {
    return NextResponse.json({ error: "Errore interno" }, { status: 500, headers: cors });
  }
  if (existing?.id) {
    if (existing.attivo === false) {
      const motivo = "Accesso esistente ma disattivato";
      await insertRequest("pending", cliente.id, motivo);
      await notifyStaffPendingRequest({ email, denominazione, piva, telefono, codice_ordine: codiceOrdine, messaggio, motivo });
      return NextResponse.json(
        {
          ok: true,
          status: "pending",
          message:
            "Il tuo accesso risulta disattivato. Lo staff verificherà la richiesta e ti ricontatterà via email.",
        },
        { status: 200, headers: cors }
      );
    }
    return NextResponse.json(
      {
        ok: true,
        status: "exists",
        message:
          "Un accesso per questa email è già attivo. Accedi dalla pagina di login; se non ricordi la password usa il recupero password.",
      },
      { status: 200, headers: cors }
    );
  }

  // 4. Match univoco senza accesso → crea credenziali e inviale all'email IN ANAGRAFICA
  const temporaryPassword = generateTemporaryPassword();
  const { data: createdUser, error: createUserErr } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      ruolo_portale: "CLIENTE",
      cliente_id: cliente.id,
      cliente_denominazione: cliente.denominazione || null,
    },
  });
  if (createUserErr || !createdUser?.user?.id) {
    const motivo = `Errore creazione utente Auth: ${String(createUserErr?.message || "sconosciuto")}`;
    await insertRequest("pending", cliente.id, motivo);
    await notifyStaffPendingRequest({ email, denominazione, piva, telefono, codice_ordine: codiceOrdine, messaggio, motivo });
    return NextResponse.json(
      {
        ok: true,
        status: "pending",
        message:
          "Non è stato possibile completare la registrazione automatica. Lo staff è stato avvisato e ti ricontatterà via email.",
      },
      { status: 200, headers: cors }
    );
  }

  const userId = createdUser.user.id;
  const { error: insertAccessErr } = await admin.from("clienti_portale_auth").insert({
    cliente_id: cliente.id,
    user_id: userId,
    email,
    attivo: true,
  });
  if (insertAccessErr) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return NextResponse.json({ error: "Errore interno" }, { status: 500, headers: cors });
  }

  await insertRequest("auto_approved", cliente.id, "Match univoco email in anagrafica");

  try {
    await sendCredentialsEmail({
      email,
      clienteDenominazione: cliente.denominazione || null,
      temporaryPassword,
    });
  } catch {
    // credenziali create ma email fallita: lo staff può fare reset password
    await notifyStaffPendingRequest({
      email,
      denominazione,
      piva,
      telefono,
      codice_ordine: codiceOrdine,
      messaggio,
      motivo: "Credenziali create ma invio email fallito: fare reset password dal gestionale",
    });
  }

  return NextResponse.json(
    {
      ok: true,
      status: "activated",
      message:
        "Registrazione completata! Le credenziali di accesso sono state inviate all'indirizzo email registrato in anagrafica. Controlla la posta (anche lo spam).",
    },
    { status: 200, headers: cors }
  );
}
