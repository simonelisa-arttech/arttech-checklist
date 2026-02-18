const ADMIN_ROLES = ["AMMINISTRAZIONE", "ADMIN"] as const;

export function isAdminRole(role: string | null | undefined) {
  const normalized = String(role || "").trim().toUpperCase();
  return ADMIN_ROLES.includes(normalized as (typeof ADMIN_ROLES)[number]);
}

export { ADMIN_ROLES };
