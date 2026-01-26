• Rendere ALLOWED_ORIGINS obbligatorio in produzione in /api/send-alert e rimuovere qualsiasi “token UI” dal client finché non c’è Auth.
• Quando Resend fallisce: non usare canali *_error, ma loggare stesso canale e marcare fallimento con email_status=FAILED (se colonna esiste) oppure prefisso [EMAIL_FAILED] nel messaggio.
