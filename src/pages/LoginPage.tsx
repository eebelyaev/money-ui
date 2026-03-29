import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authLogin, roleFromLoginResponse } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { Role } from '../auth/storage'

export function LoginPage() {
  const { loginWithSession, loginDevHeaders } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [devOpen, setDevOpen] = useState(false)
  const [devPersonId, setDevPersonId] = useState('')
  const [devRole, setDevRole] = useState<Role>('banker')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    const id = identifier.trim()
    if (!id || !password) {
      setErr('Укажите телефон или логин и пароль')
      return
    }
    setLoading(true)
    try {
      const res = await authLogin(id, password)
      const r = roleFromLoginResponse(res)
      loginWithSession({
        accessToken: res.access_token,
        personId: res.person_id,
        role: r,
      })
      navigate('/', { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const onDevSubmit = (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    const id = parseInt(devPersonId.trim(), 10)
    if (!id || id < 1) {
      setErr('Укажите положительный числовой person id')
      return
    }
    loginDevHeaders(id, devRole)
    navigate('/', { replace: true })
  }

  return (
    <>
      <h1 className="page-title">Вход</h1>
      <p className="page-intro">
        Вход по номеру телефона или логину (username) и паролю. Активная роль сессии задаётся сервером по ролям из базы (при
        нескольких ролях выбор детерминированный). В запросах передаётся <span className="font-mono">Authorization: Bearer …</span>
      </p>
      <form className="card" onSubmit={onSubmit} style={{ maxWidth: '24rem' }}>
        <div className="field-row" style={{ marginBottom: '1rem' }}>
          <label className="field-label" htmlFor="login-identifier">
            Телефон или логин
          </label>
          <input
            id="login-identifier"
            className="input"
            autoComplete="username"
            placeholder="+7 … или username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>
        <div className="field-row" style={{ marginBottom: '1rem' }}>
          <label className="field-label" htmlFor="login-pass">
            Пароль
          </label>
          <input
            id="login-pass"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {err && !devOpen && (
          <p className="alert alert--error" role="alert">
            {err}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Вход…' : 'Войти'}
        </button>
      </form>

      <p className="field-hint" style={{ marginTop: 'var(--space-5)' }}>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDevOpen((o) => !o)}>
          {devOpen ? 'Скрыть' : 'Показать'} вход без пароля (только для разработки)
        </button>
      </p>

      {devOpen && (
        <form className="card" onSubmit={onDevSubmit} style={{ maxWidth: '24rem', marginTop: 'var(--space-3)' }}>
          <p className="field-hint" style={{ marginTop: 0 }}>
            Заголовки <span className="font-mono">X-Person-Id</span> и <span className="font-mono">X-Role</span> без JWT.
          </p>
          <div className="field-row" style={{ marginBottom: '1rem' }}>
            <label className="field-label" htmlFor="dev-role">
              Роль
            </label>
            <select
              id="dev-role"
              className="input"
              value={devRole}
              onChange={(e) => setDevRole(e.target.value as Role)}
            >
              <option value="banker">Банкир</option>
              <option value="client">Клиент</option>
              <option value="admin">Администратор</option>
            </select>
          </div>
          <div className="field-row" style={{ marginBottom: '1rem' }}>
            <label className="field-label" htmlFor="dev-pid">
              Person ID
            </label>
            <input
              id="dev-pid"
              className="input"
              type="number"
              min={1}
              value={devPersonId}
              onChange={(e) => setDevPersonId(e.target.value)}
              required
            />
          </div>
          {err && devOpen && (
            <p className="alert alert--error" role="alert">
              {err}
            </p>
          )}
          <button type="submit" className="btn btn--secondary">
            Войти (dev)
          </button>
        </form>
      )}
    </>
  )
}
