import type { CSSProperties } from "react";
import Link from "next/link";

export const metadata = {
  title: "Guida — AT SYSTEM",
  description: "Manuale d'uso completo di AT SYSTEM: istruzioni step-by-step per tutte le funzioni.",
};

const pageStyle: CSSProperties = {
  maxWidth: 1100,
  margin: "24px auto 64px",
  padding: "0 16px",
  color: "#0f172a",
};

const sectionStyle: CSSProperties = {
  marginTop: 16,
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#fff",
  boxShadow: "0 2px 8px rgba(15,23,42,0.06)",
};

const summaryStyle: CSSProperties = {
  padding: "14px 18px",
  cursor: "pointer",
  fontSize: 17,
  fontWeight: 800,
  listStyle: "none",
};

const bodyStyle: CSSProperties = {
  padding: "0 18px 18px",
  fontSize: 14,
  lineHeight: 1.65,
};

const stepListStyle: CSSProperties = {
  margin: "8px 0",
  paddingLeft: 22,
  display: "grid",
  gap: 6,
};

const h3Style: CSSProperties = {
  margin: "18px 0 6px",
  fontSize: 15,
  fontWeight: 800,
};

const noteStyle: CSSProperties = {
  margin: "10px 0",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #fde68a",
  background: "#fffbeb",
  fontSize: 13,
};

const tocLinkStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  textDecoration: "none",
  color: "#0f172a",
  background: "#fff",
  fontSize: 13,
  fontWeight: 700,
};

const TOC: Array<{ id: string; label: string }> = [
  { id: "accesso", label: "1. Accesso e permessi" },
  { id: "home", label: "2. Home / Cockpit" },
  { id: "clienti", label: "3. Clienti" },
  { id: "progetti", label: "4. Progetti" },
  { id: "impianti", label: "5. Impianti e seriali" },
  { id: "rinnovi", label: "6. Scadenze e rinnovi" },
  { id: "avvisi", label: "7. Avvisi email" },
  { id: "cronoprogramma", label: "8. Cronoprogramma" },
  { id: "operatori", label: "9. App operatori" },
  { id: "interventi", label: "10. Interventi e SaaS" },
  { id: "sim", label: "11. SIM" },
  { id: "fatturazione", label: "12. Fatturazione" },
  { id: "admin", label: "13. Area Admin e KPI" },
  { id: "impostazioni", label: "14. Impostazioni" },
  { id: "faq", label: "15. Problemi frequenti" },
];

export default function GuidaPage() {
  return (
    <main style={pageStyle}>
      <h1 style={{ margin: 0, fontSize: 32 }}>Guida AT SYSTEM</h1>
      <p style={{ marginTop: 8, fontSize: 14, color: "#475569" }}>
        Manuale d&apos;uso del gestionale Art Tech. Ogni sezione spiega passo-passo come usare una
        funzione del sistema. Clicca su una sezione per aprirla.
      </p>

      <nav
        aria-label="Indice della guida"
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 8,
        }}
      >
        {TOC.map((item) => (
          <a key={item.id} href={`#${item.id}`} style={tocLinkStyle}>
            {item.label}
          </a>
        ))}
      </nav>

      {/* 1. ACCESSO */}
      <details id="accesso" style={sectionStyle} open>
        <summary style={summaryStyle}>1. Accesso e permessi</summary>
        <div style={bodyStyle}>
          <h3 style={h3Style}>Login</h3>
          <ol style={stepListStyle}>
            <li>Apri <strong>atsystem.arttechworld.com</strong> e inserisci email e password nella pagina di login.</li>
            <li>Se hai dimenticato la password usa il link di reset: riceverai una email per impostarne una nuova.</li>
            <li>Dopo il login vieni indirizzato automaticamente all&apos;area corretta in base ai tuoi permessi.</li>
          </ol>
          <h3 style={h3Style}>Permessi</h3>
          <p style={{ margin: "6px 0" }}>Ogni utente ha permessi espliciti, gestiti in <em>Impostazioni → Operatori</em>:</p>
          <ul style={stepListStyle}>
            <li><strong>Accesso backoffice</strong>: abilita il gestionale completo (dashboard, progetti, rinnovi, fatturazione).</li>
            <li><strong>Accesso app operatori</strong>: abilita l&apos;app campo <em>/operatori</em> (attività, timbrature, report).</li>
            <li><strong>Accesso impostazioni</strong>: abilita l&apos;area di configurazione.</li>
          </ul>
          <div style={noteStyle}>
            Se dopo il login non vedi una sezione che ti serve, chiedi a un amministratore di verificare i tuoi
            permessi in Impostazioni → Operatori.
          </div>
        </div>
      </details>

      {/* 2. HOME */}
      <details id="home" style={sectionStyle}>
        <summary style={summaryStyle}>2. Home / Cockpit</summary>
        <div style={bodyStyle}>
          <p style={{ margin: "6px 0" }}>
            La Home è il cockpit operativo: ricerca globale, KPI, attività del cronoprogramma e form rapidi.
          </p>
          <h3 style={h3Style}>Ricerca globale</h3>
          <ol style={stepListStyle}>
            <li>Usa il campo <strong>&quot;Cerca cliente, progetto, proforma, PO, impianto, numero SIM&quot;</strong> in alto.</li>
            <li>Puoi cercare anche per seriale hardware: il risultato porta direttamente al progetto collegato.</li>
          </ol>
          <h3 style={h3Style}>Card KPI</h3>
          <ol style={stepListStyle}>
            <li>Le card (Scadenze entro 30gg, SaaS, SaaS Ultra, Art Tech Events, clienti/progetti attivi) sono <strong>cliccabili</strong>.</li>
            <li>Cliccando una card apri la vista già filtrata sui dati corrispondenti.</li>
          </ol>
          <h3 style={h3Style}>Form rapidi</h3>
          <ol style={stepListStyle}>
            <li><strong>Aggiungi attività</strong>: crea una nuova attività di cronoprogramma indicando progetto, date, descrizione, indirizzo, personale previsto, mezzi e note operative.</li>
            <li><strong>Aggiungi intervento</strong>: registra un intervento tecnico con impianto interessato, ore, personale, materiali ed eventuali allegati o link Drive/ODA.</li>
            <li>I dati salvati confluiscono nello stesso flusso del cronoprogramma: li ritrovi identici nella pagina progetto e nel cronoprogramma.</li>
          </ol>
          <h3 style={h3Style}>Dashboard progetti</h3>
          <ol style={stepListStyle}>
            <li>Dal menu apri <strong>Dashboard</strong>: elenco compatto dei progetti di tutti i clienti con filtri per stato.</li>
            <li>Il pulsante <strong>&quot;Apri dashboard estesa&quot;</strong> mostra la vista completa, da cui è possibile anche duplicare un progetto.</li>
          </ol>
        </div>
      </details>

      {/* 3. CLIENTI */}
      <details id="clienti" style={sectionStyle}>
        <summary style={summaryStyle}>3. Clienti</summary>
        <div style={bodyStyle}>
          <ol style={stepListStyle}>
            <li>Dal menu apri <strong>Clienti</strong>: riepilogo compatto di tutti i clienti con filtri.</li>
            <li>Clicca un cliente per aprire la sua scheda: anagrafica, progetti collegati, scadenze e rinnovi del cliente.</li>
            <li>Nella scheda cliente trovi anche i contratti <strong>SaaS Ultra</strong> a livello cliente: se un contratto Ultra è assegnato a un progetto specifico, compare una sola riga (quella del progetto), senza duplicati.</li>
            <li>L&apos;anagrafica completa si gestisce da <em>Impostazioni → Clienti</em>: qui crei nuovi clienti e ne modifichi email e dati di contatto.</li>
          </ol>
          <div style={noteStyle}>
            L&apos;email del cliente è fondamentale: viene usata per gli avvisi di scadenza. I clienti senza email
            sono evidenziati nell&apos;Area Admin.
          </div>
        </div>
      </details>

      {/* 4. PROGETTI */}
      <details id="progetti" style={sectionStyle}>
        <summary style={summaryStyle}>4. Progetti</summary>
        <div style={bodyStyle}>
          <p style={{ margin: "6px 0" }}>
            Il <strong>progetto</strong> è il contenitore commerciale e amministrativo (conferma d&apos;ordine,
            proforma, commessa). Un progetto può contenere <strong>più impianti</strong>, e ogni impianto mantiene il
            proprio storico tecnico.
          </p>
          <h3 style={h3Style}>Creare un nuovo progetto</h3>
          <ol style={stepListStyle}>
            <li>Dalla dashboard clicca <strong>Nuovo progetto</strong> (pagina &quot;nuova checklist&quot;).</li>
            <li>Seleziona il cliente e compila i dati commerciali: titolo, tipo progetto, proforma/PO, link proforma.</li>
            <li>Aggiungi gli impianti: ogni impianto è una riga distinta con dimensioni, codice magazzino e dati tecnici.</li>
            <li>Salva: il progetto compare in dashboard e nel cockpit del cliente.</li>
          </ol>
          <h3 style={h3Style}>La pagina progetto</h3>
          <p style={{ margin: "6px 0" }}>Aprendo un progetto trovi queste sezioni:</p>
          <ul style={stepListStyle}>
            <li><strong>PROGETTO</strong>: dati commerciali e amministrativi, stato, link proforma.</li>
            <li><strong>Scadenze / stato</strong>: stato operativo del progetto. <em>OPERATIVO</em> = attivo, <em>CHIUSO</em> = completato definitivamente.</li>
            <li><strong>Dati operativi</strong>: blocco operativo condiviso con il cronoprogramma (date, personale, mezzi, referenti, commerciale Art Tech). Qualsiasi modifica qui è immediatamente visibile anche nel cronoprogramma, e viceversa.</li>
            <li><strong>Impianti</strong>: le unità tecniche del progetto (vedi sezione 5).</li>
            <li><strong>Licenze</strong>: licenze software con scadenze e link proforma.</li>
            <li><strong>Servizi / SaaS</strong>: contratti SaaS del progetto con interventi inclusi.</li>
            <li><strong>SIM</strong>: SIM dati associate al progetto.</li>
            <li><strong>Interventi</strong>: uscite tecniche con consuntivo (vedi sezione 10).</li>
            <li><strong>Accessori / Ricambi</strong>: materiali collegati al progetto.</li>
            <li><strong>Documenti e allegati</strong>: file, link Drive e ODA fornitore.</li>
            <li><strong>Fatture emesse</strong>: elenco fatture con link PDF modificabile inline.</li>
            <li><strong>Storico note task</strong>: cronologia delle note operative.</li>
          </ul>
          <h3 style={h3Style}>Duplicare un progetto</h3>
          <ol style={stepListStyle}>
            <li>Apri la <strong>dashboard estesa</strong> e usa l&apos;azione di duplicazione sul progetto.</li>
            <li>Vengono copiati impianti, configurazioni cabinet, licenze, accessori/ricambi e link proforma; gli ID sono rigenerati.</li>
          </ol>
        </div>
      </details>

      {/* 5. IMPIANTI E SERIALI */}
      <details id="impianti" style={sectionStyle}>
        <summary style={summaryStyle}>5. Impianti e seriali hardware</summary>
        <div style={bodyStyle}>
          <p style={{ margin: "6px 0" }}>
            L&apos;<strong>impianto</strong> è l&apos;unità tecnica reale (maxischermo, ledwall, totem). Ogni impianto
            ha storico proprio di interventi, manutenzioni, ricambi, costi e seriali — anche quando più impianti
            appartengono allo stesso progetto.
          </p>
          <h3 style={h3Style}>Gestire gli impianti</h3>
          <ol style={stepListStyle}>
            <li>Nella pagina progetto, sezione <strong>Impianti</strong>, aggiungi o modifica gli impianti.</li>
            <li>Per ogni impianto puoi inserire più righe di <strong>Composizione cabinet</strong>, ciascuna con eventuale file RCFG.</li>
            <li>Premi <strong>Salva impianti</strong> per persistere le modifiche, poi ricarica per verificare.</li>
          </ol>
          <h3 style={h3Style}>Seriali hardware</h3>
          <ul style={stepListStyle}>
            <li><strong>Seriali CONTROLLO</strong> (player, modem, sending card): univoci per progetto e <strong>associabili a uno specifico impianto</strong>. Seleziona l&apos;impianto nel form del seriale e salva: l&apos;associazione resta anche dopo reload.</li>
            <li><strong>Seriali moduli LED</strong>: possono essere usati su più progetti; la scheda mostra &quot;Usato anche in…&quot;.</li>
            <li>Il campo note serve per modello/componente. Dalla Home puoi cercare un seriale e risalire al progetto.</li>
          </ul>
          <div style={noteStyle}>
            Dopo un &quot;Salva impianti&quot;, controlla che i seriali di controllo risultino ancora associati
            all&apos;impianto corretto. Se un&apos;associazione risulta persa, segnalalo subito: è un&apos;area protetta del sistema.
          </div>
        </div>
      </details>

      {/* 6. SCADENZE E RINNOVI */}
      <details id="rinnovi" style={sectionStyle}>
        <summary style={summaryStyle}>6. Scadenze e rinnovi</summary>
        <div style={bodyStyle}>
          <p style={{ margin: "6px 0" }}>
            Una tabella unica riepiloga tutte le scadenze: <strong>LICENZA, TAGLIANDO, SAAS, SAAS ULTRA, GARANZIA</strong>.
            La trovi nella scheda cliente e nella pagina progetto (&quot;Gestione completa scadenze e rinnovi&quot;).
          </p>
          <h3 style={h3Style}>Workflow di rinnovo</h3>
          <ol style={stepListStyle}>
            <li><strong>DA AVVISARE</strong>: scadenza in arrivo, cliente non ancora contattato.</li>
            <li><strong>AVVISATO</strong>: avviso email inviato (il badge mostra il numero di invii, con tooltip).</li>
            <li><strong>CONFERMATO</strong>: il cliente ha confermato il rinnovo.</li>
            <li><strong>DA FATTURARE</strong>: rinnovo confermato, in attesa di fattura.</li>
            <li><strong>FATTURATO</strong>: fattura emessa. Il rinnovo entra nella Fatturazione globale.</li>
          </ol>
          <h3 style={h3Style}>Gestire una scadenza</h3>
          <ol style={stepListStyle}>
            <li>Apri la riga della scadenza e usa la <strong>modale di modifica</strong> per aggiornare date, importi e stato.</li>
            <li>Usa <strong>Invia avviso</strong> per notificare il cliente (vedi sezione 7).</li>
            <li>Il badge <strong>&quot;Scadenze entro 30gg&quot;</strong> considera solo scadenze future.</li>
          </ol>
          <h3 style={h3Style}>SaaS Ultra</h3>
          <ul style={stepListStyle}>
            <li>Il contratto Ultra è a livello <strong>cliente</strong>; può essere assegnato a un progetto specifico.</li>
            <li>Se esiste l&apos;assegnazione a progetto, in tabella compare solo la riga del progetto (niente doppioni).</li>
          </ul>
        </div>
      </details>

      {/* 7. AVVISI EMAIL */}
      <details id="avvisi" style={sectionStyle}>
        <summary style={summaryStyle}>7. Avvisi email</summary>
        <div style={bodyStyle}>
          <h3 style={h3Style}>Inviare un avviso</h3>
          <ol style={stepListStyle}>
            <li>Dalla riga di scadenza clicca <strong>Invia avviso</strong>.</li>
            <li>Scegli la modalità: <strong>Operatore</strong> (seleziona l&apos;operatore destinatario) oppure <strong>Email manuale</strong> (inserisci nome ed email liberamente).</li>
            <li>Seleziona un <strong>preset</strong> di messaggio (oggetto e testo precompilati con i placeholder già risolti) o scrivi il testo.</li>
            <li>Invia: l&apos;email parte dal mittente <strong>progetti@maxischermiled.it</strong> e lo stato passa ad AVVISATO.</li>
          </ol>
          <h3 style={h3Style}>Preset avvisi</h3>
          <ol style={stepListStyle}>
            <li>Vai in <em>Impostazioni → Preset avvisi</em>.</li>
            <li>Crea/modifica preset per tipo (LICENZA / TAGLIANDO / GENERICO) e trigger (MANUALE / 60GG / 30GG / 15GG).</li>
            <li>Compila oggetto e corpo usando i placeholder disponibili; attiva o disattiva il preset.</li>
          </ol>
          <h3 style={h3Style}>Storico avvisi</h3>
          <ol style={stepListStyle}>
            <li>Apri la pagina <strong>Avvisi</strong> (o clicca un badge AVVISATO).</li>
            <li>Filtra per cliente, progetto, tipo e periodo; esporta in <strong>CSV</strong> se serve.</li>
          </ol>
          <h3 style={h3Style}>Regole globali avvisi</h3>
          <p style={{ margin: "6px 0" }}>
            In <em>Impostazioni → Regole globali avvisi</em> configuri i comportamenti automatici dei trigger
            60/30/15 giorni.
          </p>
        </div>
      </details>

      {/* 8. CRONOPROGRAMMA */}
      <details id="cronoprogramma" style={sectionStyle}>
        <summary style={summaryStyle}>8. Cronoprogramma</summary>
        <div style={bodyStyle}>
          <p style={{ margin: "6px 0" }}>
            Il cronoprogramma è l&apos;<strong>hub operativo</strong> del sistema: tutte le attività (installazioni,
            disinstallazioni, manutenzioni, assistenze, sopralluoghi) convergono qui.
          </p>
          <h3 style={h3Style}>Stati di un&apos;attività</h3>
          <ul style={stepListStyle}>
            <li><strong>BOZZA</strong> → <strong>DA CONFERMARE</strong> → <strong>CONFERMATA</strong> (visibile agli operatori) → <strong>SVOLTA</strong>.</li>
            <li><strong>RIMANDATA</strong>: attività riprogrammata (resta visibile agli operatori).</li>
            <li><strong>ANNULLATA</strong>: attività cancellata.</li>
          </ul>
          <h3 style={h3Style}>Attività multi-giornata (slot)</h3>
          <ol style={stepListStyle}>
            <li>Un blocco INSTALLAZIONE o DISINSTALLAZIONE può avere più <strong>giornate (slot)</strong>, ognuna con data, ore, orario, timbrature e note proprie.</li>
            <li>I dati comuni (stato, personale, mezzi, descrizione, indirizzo, referenti, commerciale) si <strong>propagano automaticamente</strong> a tutti gli slot del blocco.</li>
            <li>Un <strong>RIMANDATO</strong> riguarda solo lo slot scelto: le altre giornate restano invariate.</li>
            <li>Un <strong>FATTO</strong> chiude l&apos;intero blocco impostando SVOLTA.</li>
          </ol>
          <h3 style={h3Style}>Blocco operativo condiviso</h3>
          <div style={noteStyle}>
            Pagina progetto e cronoprogramma leggono e scrivono <strong>gli stessi dati operativi</strong>: modifichi
            da una parte, vedi il risultato dall&apos;altra. Se le due viste mostrano dati diversi sullo stesso blocco,
            segnalalo: è un&apos;anomalia.
          </div>
          <h3 style={h3Style}>Completare o rimandare un&apos;attività</h3>
          <ol style={stepListStyle}>
            <li><strong>FATTO</strong>: si apre un popup obbligatorio con esito (completato / parziale / non completato), note finali, problemi riscontrati e materiali usati.</li>
            <li><strong>RIMANDATO</strong>: si apre un popup con motivo, nuova data, ore, personale, mezzi e descrizione.</li>
          </ol>
          <h3 style={h3Style}>Allegati giornata</h3>
          <ol style={stepListStyle}>
            <li>Ogni slot ha la sua sezione <strong>Allegati giornata</strong>; esistono anche allegati a livello di blocco.</li>
            <li>Aggiungi un allegato a uno slot: resta visibile solo in quella giornata.</li>
          </ol>
        </div>
      </details>

      {/* 9. APP OPERATORI */}
      <details id="operatori" style={sectionStyle}>
        <summary style={summaryStyle}>9. App operatori (campo)</summary>
        <div style={bodyStyle}>
          <p style={{ margin: "6px 0" }}>
            L&apos;app <strong>/operatori</strong> è la vista mobile per i tecnici sul campo: mostra solo le attività
            <strong> CONFERMATE</strong> e <strong>RIMANDATE</strong> assegnate, con indirizzo in evidenza.
          </p>
          <h3 style={h3Style}>Uso quotidiano</h3>
          <ol style={stepListStyle}>
            <li>Accedi: il sistema riconosce automaticamente il tuo profilo personale (nessuna selezione manuale).</li>
            <li>Apri l&apos;attività del giorno: vedi descrizione, indirizzo, orari e referenti.</li>
            <li><strong>Timbratura</strong>: avvia il timer all&apos;inizio del lavoro; puoi mettere in pausa, riprendere e terminare. Il timer è personale: ogni operatore vede solo la propria timbratura.</li>
            <li>Durante o a fine attività aggiungi <strong>note e report</strong> (visibili anche in backoffice) e <strong>foto/allegati</strong>.</li>
            <li>A fine lavoro usa <strong>FATTO</strong> (popup con esito, problemi, materiali) oppure <strong>RIMANDATO</strong> (popup con motivo e nuova data).</li>
          </ol>
          <div style={noteStyle}>
            Le ore timbrate e i materiali registrati alimentano i consuntivi degli interventi e lo scalo dei
            pacchetti SaaS: compila sempre il popup FATTO con precisione.
          </div>
        </div>
      </details>

      {/* 10. INTERVENTI E SAAS */}
      <details id="interventi" style={sectionStyle}>
        <summary style={summaryStyle}>10. Interventi e SaaS</summary>
        <div style={bodyStyle}>
          <p style={{ margin: "6px 0" }}>
            Il contratto <strong>SaaS vive a livello progetto</strong>; gli <strong>interventi</strong> sono tracciati
            sugli impianti realmente toccati. Questo permette consuntivi corretti e lo scalo degli interventi inclusi.
          </p>
          <h3 style={h3Style}>Registrare un intervento</h3>
          <ol style={stepListStyle}>
            <li>Nella pagina progetto, sezione <strong>Interventi</strong>, clicca per aggiungere un intervento.</li>
            <li>Scegli l&apos;ambito: <strong>singolo impianto</strong>, <strong>impianti selezionati</strong> o <strong>tutti gli impianti</strong> del progetto.</li>
            <li>Compila ore impiegate, personale coinvolto, ricambi utilizzati e costi extra.</li>
            <li>Indica se l&apos;intervento è <strong>incluso</strong> nel pacchetto SaaS o <strong>da fatturare</strong>.</li>
            <li>Per gli interventi fatturati puoi inserire il <strong>link fattura PDF</strong>, modificabile anche dalla sezione &quot;Fatture emesse&quot;.</li>
          </ol>
          <h3 style={h3Style}>Consuntivo</h3>
          <ul style={stepListStyle}>
            <li>Il riepilogo <strong>inclusi usati / da fatturare</strong> nella pagina progetto è calcolato sugli interventi reali registrati.</li>
            <li>Gli interventi da fatturare confluiscono automaticamente nella <strong>Fatturazione globale</strong>.</li>
          </ul>
        </div>
      </details>

      {/* 11. SIM */}
      <details id="sim" style={sectionStyle}>
        <summary style={summaryStyle}>11. SIM</summary>
        <div style={bodyStyle}>
          <h3 style={h3Style}>Censimento SIM</h3>
          <ol style={stepListStyle}>
            <li>Dal menu apri <strong>SIM</strong>: elenco completo delle SIM dati con numero, operatore, costi e progetto associato.</li>
            <li>SIM associata: il nome progetto è cliccabile, con link rapido <strong>&quot;Vai al progetto →&quot;</strong>.</li>
            <li>SIM libera: usa <strong>&quot;Associa a progetto →&quot;</strong> per collegarla a un progetto dalla dashboard.</li>
          </ol>
          <h3 style={h3Style}>Fatturazione SIM</h3>
          <ol style={stepListStyle}>
            <li>La pagina <strong>Fatturazione SIM</strong> gestisce i canoni periodici delle SIM.</li>
            <li>Le righe SIM confluiscono anche nella Fatturazione globale.</li>
          </ol>
        </div>
      </details>

      {/* 12. FATTURAZIONE */}
      <details id="fatturazione" style={sectionStyle}>
        <summary style={summaryStyle}>12. Fatturazione globale</summary>
        <div style={bodyStyle}>
          <p style={{ margin: "6px 0" }}>
            La <strong>Fatturazione globale</strong> aggrega in un&apos;unica vista tutto ciò che è da fatturare:
            <strong> SIM, interventi, rinnovi e SaaS</strong>.
          </p>
          <h3 style={h3Style}>Stati e pagamenti</h3>
          <ul style={stepListStyle}>
            <li>Stato fatturazione: <strong>DA FATTURARE</strong> → <strong>FATTURATO</strong>. &quot;Scaduta&quot; è solo un&apos;evidenza visiva.</li>
            <li>Il pagamento è separato dallo stato: badge <strong>PAGATO / NON PAGATO</strong> con azione <strong>&quot;Segna pagata&quot;</strong> persistente.</li>
            <li>La sezione <strong>&quot;SCADUTE NON PAGATE&quot;</strong> raccoglie le fatture emesse, scadute e non incassate (escluse dall&apos;elenco &quot;da fatturare&quot;).</li>
          </ul>
          <h3 style={h3Style}>Flusso consigliato</h3>
          <ol style={stepListStyle}>
            <li>Controlla la sezione &quot;da fatturare&quot; e prepara le fatture in gestionale contabile.</li>
            <li>Segna la riga come <strong>FATTURATO</strong> (e inserisci il link PDF dove previsto).</li>
            <li>All&apos;incasso usa <strong>&quot;Segna pagata&quot;</strong>.</li>
            <li>Tieni d&apos;occhio &quot;SCADUTE NON PAGATE&quot; per i solleciti.</li>
          </ol>
        </div>
      </details>

      {/* 13. ADMIN E KPI */}
      <details id="admin" style={sectionStyle}>
        <summary style={summaryStyle}>13. Area Admin e KPI operativi</summary>
        <div style={bodyStyle}>
          <h3 style={h3Style}>Area Admin</h3>
          <p style={{ margin: "6px 0" }}>La pagina <strong>Admin</strong> riunisce le code di lavoro da presidiare:</p>
          <ul style={stepListStyle}>
            <li><strong>Interventi da chiudere</strong> e <strong>interventi entro 7 giorni</strong>.</li>
            <li><strong>Fatture da emettere</strong>.</li>
            <li><strong>Consegne entro 7 giorni</strong>.</li>
            <li><strong>Noleggi attivi</strong> e <strong>smontaggi noleggi entro 7 giorni</strong>.</li>
            <li><strong>Scadenze</strong> e <strong>clienti senza email</strong> (da completare per abilitare gli avvisi).</li>
          </ul>
          <h3 style={h3Style}>KPI operativi</h3>
          <p style={{ margin: "6px 0" }}>
            La pagina <strong>KPI Operativi</strong> mostra gli indicatori di carico e andamento delle attività
            (ore, attività svolte, personale impiegato) per il coordinamento operativo.
          </p>
          <h3 style={h3Style}>Scadenze documenti e corsi</h3>
          <p style={{ margin: "6px 0" }}>
            La pagina <strong>Scadenze documenti e corsi</strong> traccia le scadenze interne del personale
            (documenti, corsi, certificazioni), configurabili da <em>Impostazioni → Documenti</em>.
          </p>
        </div>
      </details>

      {/* 14. IMPOSTAZIONI */}
      <details id="impostazioni" style={sectionStyle}>
        <summary style={summaryStyle}>14. Impostazioni</summary>
        <div style={bodyStyle}>
          <p style={{ margin: "6px 0" }}>L&apos;area Impostazioni raccoglie configurazione e anagrafiche:</p>
          <ul style={stepListStyle}>
            <li><strong>Operatori</strong>: utenti del sistema e permessi (backoffice, app operatori, impostazioni).</li>
            <li><strong>Personale</strong>: anagrafica del personale tecnico pianificabile nel cronoprogramma.</li>
            <li><strong>Aziende</strong>: anagrafica aziende/fornitori.</li>
            <li><strong>Clienti</strong>: anagrafica clienti completa.</li>
            <li><strong>Catalogo</strong>: catalogo prodotti e componenti.</li>
            <li><strong>Preset avvisi</strong> e <strong>Regole globali avvisi</strong>: template e automatismi email.</li>
            <li><strong>Checklist attività</strong>: modelli di checklist operative.</li>
            <li><strong>Documenti</strong>: tipologie di documenti/scadenze del personale.</li>
            <li><strong>Alert fatture</strong>: notifiche sulle fatture.</li>
            <li><strong>Area cliente</strong>: configurazione del portale cliente.</li>
            <li><strong>Import progetti</strong>: importazione massiva di progetti.</li>
          </ul>
        </div>
      </details>

      {/* 15. FAQ */}
      <details id="faq" style={sectionStyle}>
        <summary style={summaryStyle}>15. Problemi frequenti</summary>
        <div style={bodyStyle}>
          <ul style={stepListStyle}>
            <li>
              <strong>Non vedo il backoffice / l&apos;app operatori.</strong> Mancano i permessi: un amministratore deve
              abilitarli in Impostazioni → Operatori.
            </li>
            <li>
              <strong>L&apos;avviso email non risulta inviato.</strong> Verifica l&apos;email del cliente e riprova; il
              log completo è nello Storico avvisi. Se l&apos;errore persiste, segnala al referente tecnico.
            </li>
            <li>
              <strong>Il progetto mostra dati operativi diversi dal cronoprogramma.</strong> Non dovrebbe succedere:
              i dati sono condivisi. Ricarica la pagina; se il problema resta, segnalalo subito.
            </li>
            <li>
              <strong>Un seriale di controllo ha perso l&apos;impianto associato.</strong> Riassocia il seriale e
              segnala il caso: l&apos;associazione deve sopravvivere a salvataggi e ricaricamenti.
            </li>
            <li>
              <strong>Ho rimandato una giornata e ne è cambiata un&apos;altra.</strong> Il rimando deve essere
              slot-specifico: segnala l&apos;anomalia indicando progetto e giornate coinvolte.
            </li>
            <li>
              <strong>Una scadenza compare due volte (Ultra).</strong> La riga globale deve sparire se esiste la riga
              assegnata al progetto: segnala il doppione.
            </li>
          </ul>
          <p style={{ margin: "12px 0 0" }}>
            Per tutto il resto: <Link href="/" style={{ fontWeight: 700 }}>torna alla Home</Link> o contatta il
            referente di sistema.
          </p>
        </div>
      </details>
    </main>
  );
}
