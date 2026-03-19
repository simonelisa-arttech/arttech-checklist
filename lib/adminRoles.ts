const ADMIN_ROLES = ["AMMINISTRAZIONE", "ADMIN"] as const;
const SETTINGS_ROLES = ["AMMINISTRAZIONE", "ADMIN", "MAGAZZINO", "TECNICO_SW"] as const;

export function isAdminRole(role: string | null | undefined) {
  const normalized = String(role || "").trim().toUpperCase();
  return ADMIN_ROLES.includes(normalized as (typeof ADMIN_ROLES)[number]);
}

export function canAccessSettingsRole(role: string | null | undefined) {
  const normalized = String(role || "").trim().toUpperCase();
  return SETTINGS_ROLES.includes(normalized as (typeof SETTINGS_ROLES)[number]);
}

export { ADMIN_ROLES, SETTINGS_ROLES };
