import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { clearAuth, getStoredPersonId, getStoredRole, setAuth, type Role } from './storage'

type AuthState = {
  personId: number | null
  role: Role | null
}

type AuthContextValue = AuthState & {
  login: (personId: number, role: Role) => void
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

  const login = useCallback((personId: number, role: Role) => {
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
      login,
      logout,
    }),
    [state, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
