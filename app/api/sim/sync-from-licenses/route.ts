export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

type LicenseSimRow = {
  id: string;
  checklist_id: string | null;
  telefono: string | null;
  intestatario: string | null;
  gestore: string | null;
  scadenza: string | null;
  note: string | null;
  tipo: string | null;
  checklists:
    | {
        cliente_id: string | null;
      }
    | {
        cliente_id: string | null;
      }[]
    | null;
};

type SimCardRow = {
  id: string;
  license_id: string | null;
  numero_telefono: string | null;
  intestatario: string | null;
  operatore: string | null;
  data_scadenza: string | null;
  note: string | null;
  checklist_id: string | null;
  cliente_id: string | null;
  piano_attivo: string | null;
};

function firstChecklistJoin(
  value: LicenseSimRow["checklists"]
): { cliente_id: string | null } | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export async function POST(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  try {
    const { data: licenseRows, error: licenseError } = await auth.adminClient
      .from("licenses")
      .select(
        "id, checklist_id, telefono, intestatario, gestore, scadenza, note, tipo, checklists:checklist_id(cliente_id)"
      )
      .eq("tipo", "SIM");

    if (licenseError) {
      return NextResponse.json(
        { ok: false, error: `Errore caricamento licenze SIM: ${licenseError.message}` },
        { status: 500 }
      );
    }

    const simLicenses = ((licenseRows || []) as LicenseSimRow[]).filter((row) =>
      String(row.id || "").trim()
    );
    const licenseIds = simLicenses.map((row) => String(row.id));

    const { data: existingRows, error: existingError } = await auth.adminClient
      .from("sim_cards")
      .select(
        "id, license_id, numero_telefono, intestatario, operatore, data_scadenza, note, checklist_id, cliente_id, piano_attivo"
      )
      .in("license_id", licenseIds);

    if (existingError) {
      return NextResponse.json(
        { ok: false, error: `Errore caricamento SIM esistenti: ${existingError.message}` },
        { status: 500 }
      );
    }

    const existingByLicenseId = new Map<string, SimCardRow>();
    for (const row of (existingRows || []) as SimCardRow[]) {
      const licenseId = String(row.license_id || "").trim();
      if (licenseId) existingByLicenseId.set(licenseId, row);
    }

    let processed = 0;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const license of simLicenses) {
      processed += 1;
      const licenseId = String(license.id || "").trim();
      const numeroTelefono = String(license.telefono || "").trim();
      if (!licenseId || !numeroTelefono) {
        skipped += 1;
        if (licenseId) {
          errors.push(`Licenza ${licenseId} saltata: numero_telefono mancante`);
        }
        continue;
      }

      const checklistJoin = firstChecklistJoin(license.checklists);
      const payload = {
        license_id: licenseId,
        checklist_id: String(license.checklist_id || "").trim() || null,
        cliente_id: String(checklistJoin?.cliente_id || "").trim() || null,
        numero_telefono: numeroTelefono,
        intestatario: String(license.intestatario || "").trim() || null,
        operatore: String(license.gestore || "").trim() || null,
        data_scadenza: String(license.scadenza || "").trim() || null,
        note: String(license.note || "").trim() || null,
        piano_attivo: null,
      };

      const existing = existingByLicenseId.get(licenseId);
      if (!existing) {
        const { error: insertError } = await auth.adminClient.from("sim_cards").insert(payload);
        if (insertError) {
          errors.push(`Insert ${licenseId}: ${insertError.message}`);
          continue;
        }
        inserted += 1;
        continue;
      }

      const needsUpdate =
        String(existing.checklist_id || "").trim() !== String(payload.checklist_id || "").trim() ||
        String(existing.cliente_id || "").trim() !== String(payload.cliente_id || "").trim() ||
        String(existing.numero_telefono || "").trim() !== payload.numero_telefono ||
        String(existing.intestatario || "").trim() !== String(payload.intestatario || "").trim() ||
        String(existing.operatore || "").trim() !== String(payload.operatore || "").trim() ||
        String(existing.data_scadenza || "").trim() !== String(payload.data_scadenza || "").trim() ||
        String(existing.note || "").trim() !== String(payload.note || "").trim() ||
        String(existing.piano_attivo || "").trim() !== "";

      if (!needsUpdate) {
        skipped += 1;
        continue;
      }

      const { error: updateError } = await auth.adminClient
        .from("sim_cards")
        .update(payload)
        .eq("id", existing.id);

      if (updateError) {
        errors.push(`Update ${licenseId}: ${updateError.message}`);
        continue;
      }
      updated += 1;
    }

    return NextResponse.json({
      ok: true,
      processed,
      inserted,
      updated,
      skipped,
      errors,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Errore sync SIM da licenses" },
      { status: 500 }
    );
  }
}
