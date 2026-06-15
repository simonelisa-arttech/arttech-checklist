• Rendere ALLOWED_ORIGINS obbligatorio in produzione in /api/send-alert e rimuovere qualsiasi “token UI” dal client finché non c’è Auth.
• Quando Resend fallisce: non usare canali *_error, ma loggare stesso canale e marcare fallimento con email_status=FAILED (se colonna esiste) oppure prefisso [EMAIL_FAILED] nel messaggio.

## Assistenza / screening (aperti dal 2026-06-15)
• Redirect ledcare.it → https://www.ledcareservice.com — da impostare nel pannello Aruba di ledcare.it (l'estensione Chrome non accedeva a quella sezione; serve login/azione manuale di Simone).
• Aggiornare la voce "Assistenza" nel menu di maxischermiled.it: oggi punta alla vecchia homepage maxischermo.biz, deve puntare al nuovo dominio assistenza (ledcareservice.com). Modifica a sito pubblico → richiede approvazione.
• Decidere se sostituire la homepage di maxischermo.biz con la nuova landing (oggi su /assistenza.html). Consiglio: aspettare il collaudo dei tier con 2-3 clienti reali prima di sostituire; reversibile.
• Collaudo automatismo tier: testare /registrazione e il riconoscimento tier (expired/standard/plus/premium/ultra/events) con 2-3 clienti veri prima di togliere i canali tradizionali dalla landing.
