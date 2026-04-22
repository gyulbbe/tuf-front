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

export function canManageOwnedResource(options: {
  ownerUserId?: number | null;
  role?: string | null;
  userPk?: number | null;
}) {
  if (isAdminRole(options.role)) {
    return true;
  }

  return (
    typeof options.ownerUserId === "number" &&
    typeof options.userPk === "number" &&
    options.ownerUserId === options.userPk
  );
}
