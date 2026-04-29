import { isSupabaseConfigured } from "@/lib/supabaseClient";
import ConfigMancante from "@/components/ConfigMancante";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string; next?: string }>;
}) {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const resolvedSearchParams = await searchParams;
  const redirectTo = resolvedSearchParams?.redirect || resolvedSearchParams?.next || "/";
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background:
          "linear-gradient(180deg, #f8fafc 0%, #f8fafc 220px, #eef2f7 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          display: "grid",
          justifyItems: "center",
        }}
      >
        <div
          style={{
            display: "grid",
            justifyItems: "center",
            gap: 10,
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          <img
            src="/at-logo.png"
            alt="Art Tech"
            style={{ width: "100%", maxWidth: 120, height: "auto", objectFit: "contain" }}
          />
          <div style={{ fontSize: 30, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>
            AT SYSTEM
          </div>
          <div style={{ fontSize: 14, color: "#6b7280" }}>Accesso area operativa</div>
        </div>
        <LoginForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}
