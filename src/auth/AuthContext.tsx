import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearAuth,
  getStoredPersonId,
  getStoredRole,
  setAuth,
  setAuthSession,
  type AuthSession,
  type Role,
} from './storage'

type AuthState = {
  personId: number | null
  role: Role | null
}

type AuthContextValue = AuthState & {
  /** Сессия с JWT после успешного POST /auth/login. */
  loginWithSession: (session: AuthSession) => void
  /** Режим разработки: без токена, только id и роль в sessionStorage. */
  loginDevHeaders: (personId: number, role: Role) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readInitial(): AuthState {
  const pid = getStoredPersonId()
  const role = getStoredRole()
  return {
    personId: pid ? parseInt(pid, 10) : null,
    role: role ?? null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(readInitial)

  const loginWithSession = useCallback((session: AuthSession) => {
    setAuthSession(session)
    setState({ personId: session.personId, role: session.role })
  }, [])

  const loginDevHeaders = useCallback((personId: number, role: Role) => {
    setAuth(personId, role)
    setState({ personId, role })
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    setState({ personId: null, role: null })
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      loginWithSession,
      loginDevHeaders,
      logout,
    }),
    [state, loginWithSession, loginDevHeaders, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
