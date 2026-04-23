export type BillingItem = {
  id: string;
  source: "SIM" | "INTERVENTO" | "RINNOVO" | "SAAS";
  clienteNome: string;
  progettoNome?: string;
  descrizione: string;
  importo?: number;
  stato: "DA_FATTURARE" | "EMESSA" | "PAGATA" | "SCADUTA";
  dataCompetenza?: string;
  dataScadenza?: string;
  riferimentoId?: string;
};

export function getBillingStatoPriority(stato: BillingItem["stato"]) {
  switch (stato) {
    case "SCADUTA":
      return 4;
    case "DA_FATTURARE":
      return 3;
    case "EMESSA":
      return 2;
    case "PAGATA":
      return 1;
    default:
      return 0;
  }
}
