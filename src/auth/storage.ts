const K_TOKEN = 'money_auth_access_token'
const K_PID = 'money_auth_person_id'
const K_ROLE = 'money_auth_role'
/** Включён на странице администрирования: API calculations снимает ограничение «только мои договоры» для banker. */
const K_ADMIN_BROWSE = 'money_admin_browse'

export type Role = 'banker' | 'client' | 'admin'

export function getStoredAccessToken(): string | null {
  return sessionStorage.getItem(K_TOKEN)
}

export function getStoredPersonId(): string | null {
  return sessionStorage.getItem(K_PID)
}

export function getStoredRole(): Role | null {
  const r = sessionStorage.getItem(K_ROLE)
  if (r === 'banker' || r === 'client' || r === 'admin') return r
  return null
}

export type AuthSession = {
  accessToken: string
  personId: number
  role: Role
}

/** Сохранить сессию после POST /auth/login (JWT + выбранная роль). */
export function setAuthSession(session: AuthSession) {
  localStorage.removeItem(K_ADMIN_BROWSE)
  sessionStorage.setItem(K_TOKEN, session.accessToken)
  sessionStorage.setItem(K_PID, String(session.personId))
  sessionStorage.setItem(K_ROLE, session.role)
}

/** Устаревший режим без пароля: только заголовки X-Person-Id / X-Role (dev). */
export function setAuth(personId: number, role: Role) {
  sessionStorage.removeItem(K_TOKEN)
  localStorage.removeItem(K_ADMIN_BROWSE)
  sessionStorage.setItem(K_PID, String(personId))
  sessionStorage.setItem(K_ROLE, role)
}

export function clearAuth() {
  sessionStorage.removeItem(K_TOKEN)
  sessionStorage.removeItem(K_PID)
  sessionStorage.removeItem(K_ROLE)
  localStorage.removeItem(K_ADMIN_BROWSE)
}

export function activateAdminBrowseContext() {
  localStorage.setItem(K_ADMIN_BROWSE, '1')
}

export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {}
  const token = getStoredAccessToken()
  if (token) {
    h['Authorization'] = `Bearer ${token}`
  } else {
    const pid = getStoredPersonId()
    const role = getStoredRole()
    if (pid) h['X-Person-Id'] = pid
    if (role) h['X-Role'] = role
  }
  if (localStorage.getItem(K_ADMIN_BROWSE) === '1') {
    h['X-Admin-Context'] = '1'
  }
  return h
}
