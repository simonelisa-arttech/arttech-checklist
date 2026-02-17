"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password || password.length < 8) {
      setError("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== confirm) {
      setError("Le password non coincidono.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.replace("/login"), 1200);
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 6 }}>Reimposta password</h1>
      <div style={{ marginBottom: 20, fontSize: 12, opacity: 0.7 }}>
        Inserisci una nuova password
      </div>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          Nuova password<br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: 10 }}
          />
        </label>
        <label>
          Conferma password<br />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            style={{ width: "100%", padding: 10 }}
          />
        </label>
        {error && <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>}
        {success && (
          <div style={{ color: "#166534", fontSize: 13 }}>
            Password aggiornata. Reindirizzamento...
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            cursor: "pointer",
          }}
        >
          {loading ? "Salvataggio..." : "Salva password"}
        </button>
      </form>
    </div>
  );
}
