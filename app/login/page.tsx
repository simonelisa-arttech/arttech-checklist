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
  return <LoginForm redirectTo={redirectTo} />;
}
