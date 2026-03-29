const K_PID = 'money_auth_person_id'
const K_ROLE = 'money_auth_role'

export type Role = 'banker' | 'client'

export function getStoredPersonId(): string | null {
  return sessionStorage.getItem(K_PID)
}

export function getStoredRole(): Role | null {
  const r = sessionStorage.getItem(K_ROLE)
  if (r === 'banker' || r === 'client') return r
  return null
}

export function setAuth(personId: number, role: Role) {
  sessionStorage.setItem(K_PID, String(personId))
  sessionStorage.setItem(K_ROLE, role)
}

export function clearAuth() {
  sessionStorage.removeItem(K_PID)
  sessionStorage.removeItem(K_ROLE)
}

export function authHeaders(): Record<string, string> {
  const pid = getStoredPersonId()
  const role = getStoredRole()
  const h: Record<string, string> = {}
  if (pid) h['X-Person-Id'] = pid
  if (role) h['X-Role'] = role
  return h
}
