const ADMIN_ROLE_SET = new Set([
  "ROLE_MASTER",
  "ROLE_MANAGER",
  "ROLE_ADMIN",
  "MASTER",
  "MANAGER",
  "ADMIN",
]);

function normalizeRole(role?: string | null) {
  return role?.trim().toUpperCase() ?? "";
}

export function isAdminRole(role?: string | null) {
  return ADMIN_ROLE_SET.has(normalizeRole(role));
}
