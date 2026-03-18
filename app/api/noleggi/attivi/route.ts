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

  const { data, error } = await auth.adminClient
    .from("checklists")
    .select("id, cliente, nome_checklist, stato_progetto, noleggio_vendita, data_disinstallazione")
    .eq("stato_progetto", "CONSEGNATO")
    .eq("noleggio_vendita", "NOLEGGIO")
    .order("data_disinstallazione", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data || []) as ChecklistRow[])
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
