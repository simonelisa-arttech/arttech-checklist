import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

export const runtime = "nodejs";

type ChecklistRow = {
  id: string;
  cliente: string | null;
  nome_checklist: string | null;
  stato_progetto: string | null;
  noleggio_vendita: string | null;
  data_disinstallazione: string | null;
};

type ChecklistRowRaw = {
  id: string;
  cliente: string | null;
  nome_checklist: string | null;
  stato_progetto: string | null;
  noleggio_vendita: string | null;
  data_disinstallazione?: string | null;
};

function toIsoDay(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);
  const inSevenDays = new Date(today);
  inSevenDays.setDate(inSevenDays.getDate() + 7);
  const inSevenDaysIso = inSevenDays.toISOString().slice(0, 10);

  let data: ChecklistRow[] = [];
  let error: { message: string } | null = null;

  let res: any = await auth.adminClient
    .from("checklists")
    .select("id, cliente, nome_checklist, stato_progetto, noleggio_vendita, data_disinstallazione")
    .eq("stato_progetto", "CONSEGNATO")
    .eq("noleggio_vendita", "NOLEGGIO")
    .order("data_disinstallazione", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  let missingDataDisinstallazione = false;
  if (res.error && String(res.error.message || "").toLowerCase().includes("data_disinstallazione")) {
    missingDataDisinstallazione = true;
    res = await auth.adminClient
      .from("checklists")
      .select("id, cliente, nome_checklist, stato_progetto, noleggio_vendita")
      .eq("stato_progetto", "CONSEGNATO")
      .eq("noleggio_vendita", "NOLEGGIO")
      .order("created_at", { ascending: false });
  }

  error = res.error ? { message: res.error.message } : null;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rawRows: ChecklistRowRaw[] = Array.isArray(res.data)
    ? res.data.map((row: any) => ({
        id: row.id,
        cliente: row.cliente ?? null,
        nome_checklist: row.nome_checklist ?? null,
        stato_progetto: row.stato_progetto ?? null,
        noleggio_vendita: row.noleggio_vendita ?? null,
        data_disinstallazione: row.data_disinstallazione ?? null,
      }))
    : [];

  data = rawRows.map((row) => ({
    id: row.id,
    cliente: row.cliente,
    nome_checklist: row.nome_checklist,
    stato_progetto: row.stato_progetto,
    noleggio_vendita: row.noleggio_vendita,
    data_disinstallazione: missingDataDisinstallazione ? null : row.data_disinstallazione ?? null,
  }));

  const rows = data
    .map((row) => {
      const dataDisinstallazione = toIsoDay(row.data_disinstallazione);
      const isNoleggioAttivo = !dataDisinstallazione || dataDisinstallazione >= todayIso;
      const disinstallazioneImminente =
        !!dataDisinstallazione &&
        dataDisinstallazione >= todayIso &&
        dataDisinstallazione <= inSevenDaysIso;
      return {
        id: row.id,
        nome_checklist: row.nome_checklist || "—",
        cliente: row.cliente || "—",
        data_disinstallazione: dataDisinstallazione,
        disinstallazioneImminente,
        isNoleggioAttivo,
      };
    })
    .filter((row) => row.isNoleggioAttivo)
    .map(({ isNoleggioAttivo: _active, ...row }) => row);

  return NextResponse.json(rows);
}
