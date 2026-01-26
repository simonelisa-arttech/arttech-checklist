"use client";

export default function ConfigMancante() {
  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Configurazione mancante</h1>
      <p style={{ marginTop: 0 }}>
        Imposta le variabili in <code>.env.local</code>:
      </p>
      <ul>
        <li>NEXT_PUBLIC_SUPABASE_URL</li>
        <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
      </ul>
      <p style={{ fontSize: 13, opacity: 0.7 }}>
        Dopo aver salvato il file, riavvia il server di sviluppo.
      </p>
    </div>
  );
}
