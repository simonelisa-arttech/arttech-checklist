export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSiteUrl, requireOperatore } from "@/lib/adminAuth";
import { sendEmail } from "@/lib/email";

const STORAGE_SCHEME = "storage://checklist-documents/";

type AlertRequestBody = {
  azienda_id?: string;
  documento_id?: string;
};

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function parseDateOnly(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (!Number.isFinite(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getStoragePathFromDocumentUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw.startsWith(STORAGE_SCHEME)) return "";
  return raw.slice(STORAGE_SCHEME.length);
}

function splitRecipientValues(...values: Array<string | null | undefined>) {
  return values.flatMap((value) =>
    String(value || "")
      .split(/[\n,;]+/)
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

function normalizeRecipients(...values: Array<string | null | undefined>) {
  const invalid: string[] = [];
  const dedup = new Map<string, string>();

  for (const entry of splitRecipientValues(...values)) {
    const email = entry.trim();
    if (!SIMPLE_EMAIL_REGEX.test(email)) {
      invalid.push(email);
      continue;
    }
    const key = email.toLowerCase();
    if (!dedup.has(key)) dedup.set(key, email);
  }

  return {
    valid: Array.from(dedup.values()),
    invalid,
  };
}

function computeDocumentoStatus(input: {
  data_scadenza?: string | null;
  giorni_preavviso?: number | null;
  file_url?: string | null;
}) {
  const expiry = parseDateOnly(input.data_scadenza);
  const hasFile = Boolean(String(input.file_url || "").trim());
  if (!expiry) return hasFile ? "SCADENZA_MANCANTE" : "MANCANTE";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const preavviso =
    typeof input.giorni_preavviso === "number" && Number.isFinite(input.giorni_preavviso)
      ? input.giorni_preavviso
      : 30;
  if (diffDays < 0) return "SCADUTO";
  if (diffDays <= preavviso) return "IN_SCADENZA";
  return "VALIDO";
}

function buildMessage(input: {
  ragioneSociale: string;
  tipoDocumento: string;
  dataScadenza: string | null;
  status: string;
  documentUrl: string | null;
  managementUrl: string;
}) {
  const isMissing = input.status === "MANCANTE" || input.status === "SCADENZA_MANCANTE";
  const subject = isMissing
    ? "Avviso documento azienda mancante"
    : "Avviso documento azienda in scadenza";
  const lines = [
    `Azienda: ${input.ragioneSociale}`,
    `Documento: ${input.tipoDocumento}`,
    `Stato: ${input.status}`,
    `Data scadenza: ${input.dataScadenza || "—"}`,
    `Link documento: ${input.documentUrl || "—"}`,
    `Gestione documento: ${input.managementUrl}`,
  ];

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827">
      <h2 style="margin:0 0 12px 0">${escapeHtml(subject)}</h2>
      <table style="border-collapse:collapse;font-size:14px">
        <tbody>
          <tr><td style="padding:6px 12px 6px 0;font-weight:700">Azienda</td><td style="padding:6px 0">${escapeHtml(
            input.ragioneSociale
          )}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;font-weight:700">Documento</td><td style="padding:6px 0">${escapeHtml(
            input.tipoDocumento
          )}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;font-weight:700">Stato</td><td style="padding:6px 0">${escapeHtml(
            input.status
          )}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;font-weight:700">Data scadenza</td><td style="padding:6px 0">${escapeHtml(
            input.dataScadenza || "—"
          )}</td></tr>
        </tbody>
      </table>
      ${
        input.documentUrl
          ? `<p style="margin-top:16px"><a href="${escapeHtml(
              input.documentUrl
            )}" target="_blank" rel="noopener noreferrer">Apri documento</a></p>`
          : ""
      }
      <p style="margin-top:12px"><a href="${escapeHtml(
        input.managementUrl
      )}" target="_blank" rel="noopener noreferrer">Apri scheda azienda</a></p>
    </div>
  `.trim();

  return {
    subject,
    text: lines.join("\n"),
    html,
  };
}

export async function POST(request: Request) {
  try {
    const auth = await requireOperatore(request);
    if (!auth.ok) return auth.response;
    const supabase = auth.adminClient;
    const body = (await request.json().catch(() => ({}))) as AlertRequestBody;
    const aziendaId = String(body?.azienda_id || "").trim();
    const documentoId = String(body?.documento_id || "").trim();

    if (!aziendaId || !documentoId) {
      return NextResponse.json(
        { ok: false, error: "azienda_id e documento_id sono obbligatori" },
        { status: 400 }
      );
    }

    const [{ data: azienda, error: aziendaError }, { data: documento, error: documentoError }] =
      await Promise.all([
        supabase
          .from("aziende")
          .select("id, ragione_sociale, email, email_avvisi_aggiuntivi")
          .eq("id", aziendaId)
          .maybeSingle(),
        supabase
          .from("aziende_documenti")
          .select("id, azienda_id, tipo_documento, data_scadenza, giorni_preavviso, file_url")
          .eq("id", documentoId)
          .eq("azienda_id", aziendaId)
          .maybeSingle(),
      ]);

    if (aziendaError) {
      return NextResponse.json({ ok: false, error: aziendaError.message }, { status: 500 });
    }
    if (documentoError) {
      return NextResponse.json({ ok: false, error: documentoError.message }, { status: 500 });
    }
    if (!azienda) {
      return NextResponse.json({ ok: false, error: "Azienda non trovata" }, { status: 404 });
    }
    if (!documento) {
      return NextResponse.json({ ok: false, error: "Documento azienda non trovato" }, { status: 404 });
    }

    const recipients = normalizeRecipients(
      String(azienda.email || ""),
      String(azienda.email_avvisi_aggiuntivi || "")
    );
    if (recipients.invalid.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Indirizzi email non validi: ${recipients.invalid.join(", ")}`,
        },
        { status: 400 }
      );
    }
    if (recipients.valid.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Nessun destinatario email configurato per l'azienda" },
        { status: 400 }
      );
    }

    let documentUrl: string | null = null;
    const rawFileUrl = String(documento.file_url || "").trim();
    if (/^https?:\/\//i.test(rawFileUrl)) {
      documentUrl = rawFileUrl;
    } else {
      const storagePath = getStoragePathFromDocumentUrl(rawFileUrl);
      if (storagePath) {
        const { data } = await supabase.storage
          .from("checklist-documents")
          .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
        documentUrl = data?.signedUrl || null;
      }
    }

    const status = computeDocumentoStatus({
      data_scadenza: documento.data_scadenza,
      giorni_preavviso: documento.giorni_preavviso,
      file_url: documento.file_url,
    });
    const managementUrl = `${getSiteUrl()}/impostazioni/aziende#azienda-${encodeURIComponent(aziendaId)}`;
    const message = buildMessage({
      ragioneSociale: String(azienda.ragione_sociale || "—").trim() || "—",
      tipoDocumento: String(documento.tipo_documento || "Documento azienda").trim() || "Documento azienda",
      dataScadenza: String(documento.data_scadenza || "").trim() || null,
      status,
      documentUrl,
      managementUrl,
    });

    await sendEmail({
      to: recipients.valid as any,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    const { error: updateError } = await supabase
      .from("aziende_documenti")
      .update({ last_notified_at: new Date().toISOString() })
      .eq("id", documentoId);
    if (updateError) {
      return NextResponse.json(
        { ok: false, error: `Email inviata ma update alert fallito: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      to: recipients.valid,
      status,
      subject: message.subject,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Errore invio alert documento azienda") },
      { status: 500 }
    );
  }
}
