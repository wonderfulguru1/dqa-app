export const ROLES = {
  HQ: 'hq',
  STATE_ADMIN: 'state_admin',
  FIELD: 'field',
}

/** HQ dashboard + field entry under /hq (not assessor /field shell). */
export function isHqDashboardRole(role) {
  return role === ROLES.HQ || role === ROLES.STATE_ADMIN
}

/** Upload preloads, manage users, bulk delete. */
export function canAccessDataManagement(role) {
  return role === ROLES.HQ
}

/** Limit API data and preloads to assigned state. */
export function isStateScoped(role) {
  return role === ROLES.FIELD || role === ROLES.STATE_ADMIN
}
