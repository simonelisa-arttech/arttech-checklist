import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type AziendeDocumentAlertItem = {
  documento_id: string;
  azienda_id: string;
  azienda_nome: string;
  tipo_documento: string;
  data_scadenza: string;
  alert_stato: "ATTIVO" | "SOSPESO" | "COMPLETATO" | null;
  alert_frequenza: "ONCE" | "DAILY" | "WEEKLY" | null;
  giorni_preavviso_effettivi: number;
  stato_scadenza: "SCADUTO" | "IN_SCADENZA";
  giorni_delta: number;
  last_notified_at: string | null;
};

export type AziendeDocumentAlertDigest = {
  generated_at: string;
  scaduti: AziendeDocumentAlertItem[];
  in_scadenza: AziendeDocumentAlertItem[];
  grouped: Array<{
    azienda_id: string;
    azienda_nome: string;
    scaduti: AziendeDocumentAlertItem[];
    in_scadenza: AziendeDocumentAlertItem[];
  }>;
};

export type AziendeDocumentAlertMessage = {
  subject: string;
  text: string;
  html: string;
};

type AziendaDocumentoDbRow = {
  id: string | null;
  azienda_id: string | null;
  tipo_documento: string | null;
  data_scadenza: string | null;
  giorni_preavviso: number | null;
  alert_stato: string | null;
  alert_frequenza: string | null;
  last_notified_at: string | null;
};

type AziendaDbRow = {
  id: string | null;
  ragione_sociale: string | null;
};

function startOfLocalDay(value?: Date) {
  const date = value ? new Date(value) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDateOnly(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (!Number.isFinite(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function normalizeAlertStato(value?: string | null) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "ATTIVO" || raw === "SOSPESO" || raw === "COMPLETATO") return raw;
  return null;
}

function normalizeAlertFrequenza(value?: string | null) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "ONCE" || raw === "DAILY" || raw === "WEEKLY") return raw;
  return null;
}

function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function diffDays(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function shouldIncludeByFrequency(
  frequenza: "ONCE" | "DAILY" | "WEEKLY",
  lastNotifiedAt: string | null,
  today: Date
) {
  const lastDate = parseDateOnly(lastNotifiedAt);
  if (!lastDate) return true;

  if (frequenza === "ONCE") return false;
  if (frequenza === "DAILY") return toIsoDate(lastDate) !== toIsoDate(today);
  if (frequenza === "WEEKLY") return diffDays(lastDate, today) >= 7;
  return true;
}

function compareAlertItems(a: AziendeDocumentAlertItem, b: AziendeDocumentAlertItem) {
  const byAzienda = a.azienda_nome.localeCompare(b.azienda_nome, "it");
  if (byAzienda !== 0) return byAzienda;
  const byDelta = a.giorni_delta - b.giorni_delta;
  if (byDelta !== 0) return byDelta;
  return a.tipo_documento.localeCompare(b.tipo_documento, "it");
}

function formatAlertDelta(item: AziendeDocumentAlertItem) {
  if (item.stato_scadenza === "SCADUTO") {
    const days = Math.abs(item.giorni_delta);
    return `scaduto da ${days} ${days === 1 ? "giorno" : "giorni"}`;
  }
  return `scade tra ${item.giorni_delta} ${item.giorni_delta === 1 ? "giorno" : "giorni"}`;
}

function buildSectionLines(
  title: string,
  grouped: AziendeDocumentAlertDigest["grouped"],
  pickItems: (azienda: AziendeDocumentAlertDigest["grouped"][number]) => AziendeDocumentAlertItem[]
) {
  const lines: string[] = [];
  for (const azienda of grouped) {
    const items = pickItems(azienda);
    if (items.length === 0) continue;

    lines.push(title);
    lines.push(`Azienda: ${azienda.azienda_nome}`);
    for (const item of items) {
      lines.push(
        `- ${item.tipo_documento} · scadenza ${item.data_scadenza} · ${formatAlertDelta(item)}`
      );
    }
    lines.push("");
  }
  return lines;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSectionHtml(
  title: string,
  color: string,
  grouped: AziendeDocumentAlertDigest["grouped"],
  pickItems: (azienda: AziendeDocumentAlertDigest["grouped"][number]) => AziendeDocumentAlertItem[]
) {
  const sections: string[] = [];

  for (const azienda of grouped) {
    const items = pickItems(azienda);
    if (items.length === 0) continue;

    sections.push(`
      <div style="margin-top:18px">
        <div style="font-size:16px;font-weight:700;margin-bottom:8px">${escapeHtml(azienda.azienda_nome)}</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tbody>
            ${items
              .map(
                (item) => `
                  <tr>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb">${escapeHtml(item.tipo_documento)}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;white-space:nowrap">${escapeHtml(
                      item.data_scadenza
                    )}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;color:${color};font-weight:700">${escapeHtml(
                      formatAlertDelta(item)
                    )}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `);
  }

  if (sections.length === 0) return "";

  return `
    <div style="margin-top:24px">
      <h3 style="margin:0 0 12px 0;color:${color};font-size:18px">${escapeHtml(title)}</h3>
      ${sections.join("")}
    </div>
  `;
}

export async function collectAziendeDocumentAlertDigest(input?: {
  today?: Date;
}): Promise<AziendeDocumentAlertDigest> {
  const supabase = getSupabaseAdmin();
  const today = startOfLocalDay(input?.today);

  const [{ data: docsData, error: docsError }, { data: aziendeData, error: aziendeError }] =
    await Promise.all([
      supabase
        .from("aziende_documenti")
        .select(
          "id, azienda_id, tipo_documento, data_scadenza, giorni_preavviso, alert_stato, alert_frequenza, last_notified_at"
        ),
      supabase.from("aziende").select("id, ragione_sociale"),
    ]);

  if (docsError) throw new Error(`Errore caricamento documenti aziende: ${docsError.message}`);
  if (aziendeError) throw new Error(`Errore caricamento aziende: ${aziendeError.message}`);

  const aziendeById = new Map<string, string>();
  for (const row of ((aziendeData || []) as AziendaDbRow[])) {
    const id = String(row.id || "").trim();
    if (!id) continue;
    aziendeById.set(id, String(row.ragione_sociale || "").trim() || "—");
  }

  const eligibleItems: AziendeDocumentAlertItem[] = [];

  for (const row of ((docsData || []) as AziendaDocumentoDbRow[])) {
    const documentoId = String(row.id || "").trim();
    const aziendaId = String(row.azienda_id || "").trim();
    const tipoDocumento = String(row.tipo_documento || "").trim();
    const scadenza = parseDateOnly(row.data_scadenza);
    const stato = normalizeAlertStato(row.alert_stato);
    const frequenza = normalizeAlertFrequenza(row.alert_frequenza) || "ONCE";

    if (!documentoId || !aziendaId || !tipoDocumento || !scadenza) continue;
    if (stato === "SOSPESO" || stato === "COMPLETATO") continue;

    const giorniPreavvisoEffettivi =
      typeof row.giorni_preavviso === "number" && Number.isFinite(row.giorni_preavviso)
        ? row.giorni_preavviso
        : 30;
    const giorniDelta = diffDays(today, scadenza);
    const statoScadenza =
      giorniDelta < 0 ? "SCADUTO" : giorniDelta <= giorniPreavvisoEffettivi ? "IN_SCADENZA" : null;

    if (!statoScadenza) continue;
    if (!shouldIncludeByFrequency(frequenza, row.last_notified_at, today)) continue;

    eligibleItems.push({
      documento_id: documentoId,
      azienda_id: aziendaId,
      azienda_nome: aziendeById.get(aziendaId) || "—",
      tipo_documento: tipoDocumento,
      data_scadenza: toIsoDate(scadenza),
      alert_stato: stato,
      alert_frequenza: frequenza,
      giorni_preavviso_effettivi: giorniPreavvisoEffettivi,
      stato_scadenza: statoScadenza,
      giorni_delta: giorniDelta,
      last_notified_at: row.last_notified_at || null,
    });
  }

  const scaduti = eligibleItems
    .filter((item) => item.stato_scadenza === "SCADUTO")
    .sort(compareAlertItems);
  const inScadenza = eligibleItems
    .filter((item) => item.stato_scadenza === "IN_SCADENZA")
    .sort(compareAlertItems);

  const groupedMap = new Map<
    string,
    {
      azienda_id: string;
      azienda_nome: string;
      scaduti: AziendeDocumentAlertItem[];
      in_scadenza: AziendeDocumentAlertItem[];
    }
  >();

  for (const item of [...scaduti, ...inScadenza]) {
    const bucket =
      groupedMap.get(item.azienda_id) || {
        azienda_id: item.azienda_id,
        azienda_nome: item.azienda_nome,
        scaduti: [],
        in_scadenza: [],
      };
    groupedMap.set(item.azienda_id, bucket);

    if (item.stato_scadenza === "SCADUTO") {
      bucket.scaduti.push(item);
    } else {
      bucket.in_scadenza.push(item);
    }
  }

  const grouped = Array.from(groupedMap.values()).sort((a, b) =>
    a.azienda_nome.localeCompare(b.azienda_nome, "it")
  );

  return {
    generated_at: new Date().toISOString(),
    scaduti,
    in_scadenza: inScadenza,
    grouped,
  };
}

export function buildAziendeDocumentAlertMessage(
  digest: AziendeDocumentAlertDigest
): AziendeDocumentAlertMessage {
  const total = digest.scaduti.length + digest.in_scadenza.length;
  const subject = `[AT SYSTEM] Alert documenti aziende (${total})`;
  const lines: string[] = [
    "Alert documenti aziende",
    `Generato il: ${digest.generated_at}`,
    "",
  ];

  if (digest.scaduti.length > 0) {
    lines.push(...buildSectionLines("SCADUTI", digest.grouped, (azienda) => azienda.scaduti));
  }

  if (digest.in_scadenza.length > 0) {
    lines.push(
      ...buildSectionLines("IN SCADENZA", digest.grouped, (azienda) => azienda.in_scadenza)
    );
  }

  if (digest.scaduti.length === 0 && digest.in_scadenza.length === 0) {
    lines.push("Nessun documento azienda in alert.");
  }

  const sectionsHtml: string[] = [];
  if (digest.scaduti.length > 0) {
    sectionsHtml.push(
      buildSectionHtml("SCADUTI", "#b91c1c", digest.grouped, (azienda) => azienda.scaduti)
    );
  }
  if (digest.in_scadenza.length > 0) {
    sectionsHtml.push(
      buildSectionHtml("IN SCADENZA", "#ea580c", digest.grouped, (azienda) => azienda.in_scadenza)
    );
  }
  if (sectionsHtml.length === 0) {
    sectionsHtml.push(
      `<p style="margin-top:16px;font-size:14px;color:#374151">Nessun documento azienda in alert.</p>`
    );
  }

  return {
    subject,
    text: lines.join("\n").trim(),
    html: `
      <div style="font-family:Arial,sans-serif;color:#111827">
        <h2 style="margin:0 0 8px 0">Alert documenti aziende</h2>
        <div style="font-size:13px;color:#6b7280">Generato il: ${escapeHtml(digest.generated_at)}</div>
        ${sectionsHtml.join("")}
      </div>
    `.trim(),
  };
}
