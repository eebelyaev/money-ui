import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { Role } from '../auth/storage'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [personId, setPersonId] = useState('')
  const [role, setRole] = useState<Role>('banker')
  const [err, setErr] = useState<string | null>(null)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    const id = parseInt(personId.trim(), 10)
    if (!id || id < 1) {
      setErr('Укажите положительный числовой person id')
      return
    }
    login(id, role)
    navigate(role === 'banker' ? '/banker' : '/client', { replace: true })
  }

  return (
    <>
      <h1 className="page-title">Вход</h1>
      <p className="page-intro">
        Укажите ваш <span className="font-mono">person.id</span> из базы и роль. Заголовки{' '}
        <span className="font-mono">X-Person-Id</span> и <span className="font-mono">X-Role</span> передаются в API
        calculations.
      </p>
      <form className="card" onSubmit={onSubmit} style={{ maxWidth: '24rem' }}>
        <div className="field-row" style={{ marginBottom: '1rem' }}>
          <label className="field-label" htmlFor="login-role">
            Роль
          </label>
          <select
            id="login-role"
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="banker">Банкир</option>
            <option value="client">Клиент</option>
          </select>
        </div>
        <div className="field-row" style={{ marginBottom: '1rem' }}>
          <label className="field-label" htmlFor="login-pid">
            Person ID
          </label>
          <input
            id="login-pid"
            className="input"
            type="number"
            min={1}
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            required
          />
        </div>
        {err && (
          <p className="alert alert--error" role="alert">
            {err}
          </p>
        )}
        <button type="submit" className="btn btn--primary">
          Войти
        </button>
      </form>
    </>
  )
}
