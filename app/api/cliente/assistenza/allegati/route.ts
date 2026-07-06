export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * P4.5 — Allegati ticket assistenza (foto/video).
 * POST multipart: { ticketId, file } → upload nel bucket privato `ticket-allegati`
 * (via service role) + record in `assistenza_ticket_allegati`.
 * L'accesso è mediato dal server: il cliente non tocca direttamente lo Storage.
 */

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { resolveClientePortalAuth } from "@/lib/clientePortalAuth";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
]);
const BUCKET = "ticket-allegati";

export async function POST(request: Request) {
  const auth = await resolveClientePortalAuth(request);
  if (!auth.ok) return auth.response;
  if (auth.cliente.attivo === false) {
    return NextResponse.json({ error: "Cliente inattivo" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const ticketId = String(form.get("ticketId") || "").trim();
  const file = form.get("file");
  if (!ticketId) {
    return NextResponse.json({ error: "ticketId mancante" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file mancante" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File assente o troppo grande (max 10MB)" }, { status: 400 });
  }
  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: "Tipo di file non consentito" }, { status: 400 });
  }

  // Verifica appartenenza del ticket al cliente loggato (sicurezza).
  const { data: tk, error: tkErr } = await auth.adminClient
    .from("assistenza_tickets")
    .select("id, cliente_id")
    .eq("id", ticketId)
    .eq("cliente_id", auth.cliente.cliente_id)
    .maybeSingle();
  if (tkErr) {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
  if (!tk) {
    return NextResponse.json({ error: "Ticket non valido per questo cliente" }, { status: 403 });
  }

  const safeName = String(file.name || "allegato")
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 120);
  const path = `${ticketId}/${randomUUID()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await auth.adminClient.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (upErr) {
    return NextResponse.json({ error: upErr.message || "Errore upload" }, { status: 500 });
  }

  const { error: insErr } = await auth.adminClient
    .from("assistenza_ticket_allegati")
    .insert({
      ticket_id: ticketId,
      cliente_id: auth.cliente.cliente_id,
      path,
      filename: safeName,
      content_type: contentType,
      size: file.size,
    });
  if (insErr) {
    // rollback best-effort dello storage
    await auth.adminClient.storage.from(BUCKET).remove([path]).catch(() => undefined);
    return NextResponse.json({ error: insErr.message || "Errore interno" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, filename: safeName });
}
