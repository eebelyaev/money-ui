import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatDateIso, formatMoney, formatPercent } from '../utils/format'

export type OpenClientContract = {
  contract_id: number
  doc_date: string
  interest_rate: number
  principal: number
  interest: number
  total_debt: number
  has_snapshot: boolean
}

export type SnapshotRow = {
  doc_date: string
  principal: number
  interest: number
  principal_issued: number
  accrued_interest: number
  total_paid: number
}

export function ClientPage() {
  const { personId, role, logout } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<OpenClientContract[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [historyFor, setHistoryFor] = useState<number | null>(null)
  const [snapshots, setSnapshots] = useState<SnapshotRow[] | null>(null)
  const [snapLoading, setSnapLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const list = (await api<OpenClientContract[]>('GET', '/me/contracts')) ?? []
      if (!Array.isArray(list)) {
        setErr('Неожиданный ответ')
        return
      }
      setRows(list)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role === 'client' && personId) load().catch(() => {})
  }, [role, personId, load])

  const loadHistory = async (contractId: number) => {
    setHistoryFor(contractId)
    setSnapshots(null)
    setSnapLoading(true)
    try {
      const list = (await api<SnapshotRow[]>('GET', '/contracts/' + contractId + '/snapshots')) ?? []
      if (!Array.isArray(list)) {
        toast.show('Не удалось загрузить историю', 'error')
        return
      }
      setSnapshots(list)
    } catch (e) {
      toast.show(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setSnapLoading(false)
    }
  }

  if (role !== 'client' || !personId) {
    return (
      <p className="alert alert--error">
        Нужна роль клиента. <Link to="/login">Войти</Link>
      </p>
    )
  }

  return (
    <>
      <h1 className="page-title">Мои договоры</h1>
      <p className="page-intro">
        Person.id: <span className="font-mono">{personId}</span>.{' '}
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => logout()}>
          Выйти
        </button>
      </p>

      <div className="toolbar">
        <button type="button" className="btn btn--secondary" onClick={() => load()} disabled={loading}>
          Обновить
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => toast.show('Договор создаёт банкир. Обратитесь к банкиру или на главную.')}
        >
          Новый договор
        </button>
      </div>

      {err && (
        <p className="alert alert--error" role="alert">
          {err}
        </p>
      )}

      <section className="card">
        <h2 className="card__title">Открытые договоры</h2>
        {loading && !rows ? (
          <p>Загрузка…</p>
        ) : !rows || rows.length === 0 ? (
          <p className="field-hint">Нет открытых договоров.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">№</th>
                  <th scope="col">Дата</th>
                  <th scope="col" className="num">
                    Ставка
                  </th>
                  <th scope="col" className="num">
                    Тело
                  </th>
                  <th scope="col" className="num">
                    Всего долг
                  </th>
                  <th scope="col" className="cell-actions">
                    История
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.contract_id}>
                    <td className="font-mono tabular-nums">{r.contract_id}</td>
                    <td>{formatDateIso(r.doc_date)}</td>
                    <td className="num">{formatPercent(r.interest_rate)}</td>
                    <td className="num">{formatMoney(r.principal)}</td>
                    <td className="num">{formatMoney(r.total_debt)}</td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => loadHistory(r.contract_id)}
                      >
                        История
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {historyFor !== null && (
        <section className="card" style={{ marginTop: '1rem' }}>
          <h2 className="card__title">История остатков по договору #{historyFor}</h2>
          {snapLoading ? (
            <p>Загрузка…</p>
          ) : snapshots && snapshots.length === 0 ? (
            <p className="field-hint">Нет снимков.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">Дата</th>
                    <th scope="col" className="num">
                      Тело
                    </th>
                    <th scope="col" className="num">
                      Проценты
                    </th>
                    <th scope="col" className="num">
                      Выпущено
                    </th>
                    <th scope="col" className="num">
                      Начислено
                    </th>
                    <th scope="col" className="num">
                      Платежи
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(snapshots ?? []).map((s) => (
                    <tr key={s.doc_date}>
                      <td>{formatDateIso(s.doc_date)}</td>
                      <td className="num">{formatMoney(s.principal)}</td>
                      <td className="num">{formatMoney(s.interest)}</td>
                      <td className="num">{formatMoney(s.principal_issued)}</td>
                      <td className="num">{formatMoney(s.accrued_interest)}</td>
                      <td className="num">{formatMoney(s.total_paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  )
}
