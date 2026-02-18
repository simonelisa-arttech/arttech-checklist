"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type LoginFormProps = {
  redirectTo: string;
};

export default function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryMsg, setRecoveryMsg] = useState<string | null>(null);
  const buildStamp = "AUTH BUILD PROD DOMAIN";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    console.log("LOGIN handler called");
    setError(null);
    setRecoveryMsg(null);
    setLoading(true);

    const res = await fetch("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data?.error || "Credenziali non valide";
      console.error("Login server-side error:", message);
      setError(message);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  async function onRecovery() {
    setError(null);
    setRecoveryMsg(null);
    if (!email.trim()) {
      setError("Inserisci prima l'email.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: "https://atsystem.arttechworld.com/auth/callback",
    });
    if (error) {
      setError(error.message);
      return;
    }
    setRecoveryMsg("Email di recupero inviata. Controlla la posta.");
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 6 }}>Login</h1>
      <div style={{ marginBottom: 8, fontSize: 11, opacity: 0.7 }}>
        {buildStamp}
      </div>
      <div style={{ marginBottom: 20, fontSize: 12, opacity: 0.7 }}>
        Accedi con email e password
      </div>
      <form onSubmit={handleLogin} style={{ display: "grid", gap: 12 }}>
        <label>
          Email<br />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: 10 }}
          />
        </label>
        <label>
          Password<br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: 10 }}
          />
        </label>
        {error && <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>}
        {recoveryMsg && (
          <div style={{ color: "#166534", fontSize: 13 }}>{recoveryMsg}</div>
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
          {loading ? "Accesso..." : "Accedi"}
        </button>
        <button
          type="button"
          onClick={onRecovery}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "white",
            color: "#111",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Password dimenticata
        </button>
      </form>
    </div>
  );
}
