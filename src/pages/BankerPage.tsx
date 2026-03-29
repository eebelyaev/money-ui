import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../context/ToastContext'

type ContractRow = {
  id: number
  client_id: number
  banker_id: number
  doc_date: string
  amount: number
  interest_rate: number
}

export function BankerPage() {
  const { personId, role, logout } = useAuth()
  const toast = useToast()
  const [contracts, setContracts] = useState<ContractRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  const [recalcClient, setRecalcClient] = useState<number | null>(null)
  const [recalcFrom, setRecalcFrom] = useState('')

  const load = useCallback(async () => {
    if (!personId) return
    setLoading(true)
    setMsg(null)
    try {
      const rows = (await api<ContractRow[]>('GET', '/contracts')) ?? []
      if (!Array.isArray(rows)) {
        setMsg('Неожиданный ответ')
        return
      }
      setContracts(rows)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [personId])

  useEffect(() => {
    if (role === 'banker' && personId) load().catch(() => {})
  }, [role, personId, load])

  const clients = useMemo(() => {
    const m = new Map<number, true>()
    for (const c of contracts ?? []) {
      m.set(c.client_id, true)
    }
    return Array.from(m.keys()).sort((a, b) => a - b)
  }, [contracts])

  const runRecalc = async () => {
    if (recalcClient === null || !recalcFrom) return
    const from_date = recalcFrom
    try {
      const rows =
        (await api<ContractRow[]>(
          'GET',
          '/contracts?banker=' +
            encodeURIComponent(String(personId)) +
            '&client=' +
            encodeURIComponent(String(recalcClient)),
        )) ?? []
      if (!Array.isArray(rows) || rows.length === 0) {
        toast.show('Нет договоров для этого клиента', 'error')
        setRecalcClient(null)
        return
      }
      for (const c of rows) {
        await api('POST', '/contracts/' + c.id + '/recalculate', { from_date })
      }
      toast.show('Пересчёт выполнен для ' + rows.length + ' договор(ов)')
    } catch (e) {
      toast.show(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setRecalcClient(null)
      setRecalcFrom('')
    }
  }

  if (role !== 'banker' || !personId) {
    return (
      <p className="alert alert--error">
        Нужна роль банкира. <Link to="/login">Войти</Link>
      </p>
    )
  }

  return (
    <>
      <h1 className="page-title">Банкир</h1>
      <p className="page-intro">
        Ваш person.id: <span className="font-mono">{personId}</span>.{' '}
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => logout()}>
          Выйти
        </button>
      </p>

      <div className="toolbar">
        <Link to="/" className="btn btn--secondary">
          Полная главная (справочники, договоры)
        </Link>
        <button type="button" className="btn btn--secondary" onClick={() => load()} disabled={loading}>
          Обновить
        </button>
      </div>

      {msg && (
        <p className="alert alert--error" role="alert">
          {msg}
        </p>
      )}

      <section className="card">
        <h2 className="card__title">Клиенты по договорам</h2>
        {loading && !contracts ? (
          <p>Загрузка…</p>
        ) : clients.length === 0 ? (
          <p className="field-hint">Нет договоров. Создайте договор на главной.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">ID клиента</th>
                  <th scope="col" className="cell-actions">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {clients.map((cid) => (
                  <tr key={cid}>
                    <td className="font-mono tabular-nums">{cid}</td>
                    <td className="cell-actions">
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setRecalcClient(cid)}>
                        Пересчёт итогов…
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {recalcClient !== null && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3 className="section-title">Пересчёт для клиента {recalcClient}</h3>
          <p className="field-hint">Для каждого договора с этим клиентом будет вызван пересчёт с указанной даты.</p>
          <div className="field-grid" style={{ maxWidth: '16rem' }}>
            <div className="field-row">
              <label className="field-label" htmlFor="rec-from-b">
                from_date
              </label>
              <input
                id="rec-from-b"
                className="input"
                type="date"
                value={recalcFrom}
                onChange={(e) => setRecalcFrom(e.target.value)}
              />
            </div>
            <div className="field-row field-row--inline">
              <button type="button" className="btn btn--primary" onClick={() => void runRecalc()}>
                Запустить
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setRecalcClient(null)
                  setRecalcFrom('')
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
