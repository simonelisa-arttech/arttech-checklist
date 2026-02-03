export type SendAlertPayload = {
  canale:
    | "manual_task"
    | "fatturazione_row"
    | "fatturazione_bulk"
    | "rinnovo_stage1"
    | "rinnovo_stage2"
    | "manual"
    | string;
  subject?: string;
  message?: string;
  text?: string;
  html?: string;
  to_email?: string | null;
  to_nome?: string | null;
  to_operatore_id?: string | null;
  from_operatore_id?: string | null;
  cliente?: string | null;
  checklist_id?: string | null;
  tagliando_id?: string | null;
  scadenza?: string | null;
  modalita?: string | null;
  note?: string | null;
  tipo?: string | null;
  task_id?: string | null;
  task_template_id?: string | null;
  intervento_id?: string | null;
  rinnovo_id?: string | null;
  meta?: any;
  send_email?: boolean;
};

export async function sendAlert(payload: SendAlertPayload) {
  const res = await fetch("/api/send-alert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }
  if (!res.ok) {
    const msg = data?.log_id
      ? "Email non inviata, log salvato."
      : data?.error || "Errore invio alert";
    throw new Error(msg);
  }
  return data;
}
