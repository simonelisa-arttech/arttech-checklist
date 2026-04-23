export type BillingItem = {
  id: string;
  source: "SIM" | "INTERVENTO" | "RINNOVO" | "SAAS";
  clienteNome: string;
  progettoNome?: string;
  descrizione: string;
  importo?: number;
  stato: "DA_FATTURARE" | "FATTURATO";
  paymentStatus?: "NON_PAGATO" | "PAGATO";
  dataCompetenza?: string;
  dataScadenza?: string;
  riferimentoId?: string;
};

export function getBillingStatoPriority(stato: BillingItem["stato"] | "SCADUTA") {
  switch (stato) {
    case "SCADUTA":
      return 4;
    case "DA_FATTURARE":
      return 3;
    case "FATTURATO":
      return 1;
    default:
      return 0;
  }
}
