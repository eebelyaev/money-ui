import { Fragment, useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SnapshotHistoryTable } from '../components/SnapshotHistoryTable'
import { api } from '../api/client'
import type { SnapshotRow } from '../types/snapshot'
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

export type { SnapshotRow }

export function ClientPage() {
  const { personId, role } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const baseId = useId()
  const [rows, setRows] = useState<OpenClientContract[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [expandedContractId, setExpandedContractId] = useState<number | null>(null)
  const [snapshots, setSnapshots] = useState<SnapshotRow[] | null>(null)
  const [snapLoading, setSnapLoading] = useState(false)

  const contractsTitleId = `${baseId}-contracts-heading`

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const list = (await api<OpenClientContract[]>('GET', '/me/contracts')) ?? []
      if (!Array.isArray(list)) {
        setErr('Неожиданный ответ')
        return
      }
      const sorted = [...list].sort((a, b) => {
        const da = a.doc_date.trim().slice(0, 10)
        const db = b.doc_date.trim().slice(0, 10)
        const byDate = da.localeCompare(db)
        if (byDate !== 0) return byDate
        return a.contract_id - b.contract_id
      })
      setRows(sorted)
      setExpandedContractId(null)
      setSnapshots(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role === 'client' && personId) load().catch(() => {})
  }, [role, personId, load])

  const contractsTotals = useMemo(() => {
    if (!rows?.length) return { totalDebt: 0, count: 0 }
    return {
      totalDebt: rows.reduce((acc, r) => acc + r.total_debt, 0),
      count: rows.length,
    }
  }, [rows])

  const fetchSnapshots = async (contractId: number) => {
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

  const onHistoryClick = (contractId: number) => {
    if (expandedContractId === contractId) {
      setExpandedContractId(null)
      setSnapshots(null)
      return
    }
    setExpandedContractId(contractId)
    void fetchSnapshots(contractId)
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
      <h1 className="sr-only">Мои договоры</h1>

      {err && (
        <p className="alert alert--error" role="alert">
          {err}
        </p>
      )}

      <section className="card" aria-labelledby={contractsTitleId}>
        <div className="card__head">
          <h2 className="card__title" id={contractsTitleId}>
            Договоры
          </h2>
          <button type="button" className="btn btn--secondary" onClick={() => load()} disabled={loading}>
            {loading ? (
              <span className="loading-inline">
                <span className="spinner" aria-hidden />
                Обновление…
              </span>
            ) : (
              'Обновить'
            )}
          </button>
        </div>
        {loading && !rows ? (
          <p>Загрузка…</p>
        ) : !rows || rows.length === 0 ? (
          <p className="field-hint">Нет открытых договоров.</p>
        ) : (
          <div className="table-wrap">
            <table className="data data--tight">
              <thead>
                <tr>
                  <th scope="col">№</th>
                  <th scope="col">Дата</th>
                  <th scope="col" className="num">
                    Ставка
                  </th>
                  <th scope="col" className="num">
                    Долг
                  </th>
                  <th scope="col" className="cell-actions">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const titleId = `${baseId}-history-title-${r.contract_id}`
                  const panelId = `${baseId}-history-panel-${r.contract_id}`
                  const isOpen = expandedContractId === r.contract_id
                  return (
                    <Fragment key={r.contract_id}>
                      <tr>
                        <td className="font-mono tabular-nums">{r.contract_id}</td>
                        <td>{formatDateIso(r.doc_date)}</td>
                        <td className="num">{formatPercent(r.interest_rate)}</td>
                        <td className="num">{formatMoney(r.total_debt)}</td>
                        <td className="cell-actions">
                          <button
                            type="button"
                            className="btn btn--primary btn--sm"
                            onClick={() => navigate('/contracts/' + r.contract_id)}
                          >
                            Открыть
                          </button>{' '}
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            aria-expanded={isOpen}
                            aria-controls={panelId}
                            onClick={() => onHistoryClick(r.contract_id)}
                          >
                            История
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="table-accordion__row">
                          <td colSpan={5} className="accordion-panel">
                            <div id={panelId} role="region" aria-labelledby={titleId}>
                              <h3 className="accordion-panel__title" id={titleId}>
                                История остатков по договору №{r.contract_id}
                              </h3>
                              {snapLoading ? (
                                <p>Загрузка…</p>
                              ) : snapshots && snapshots.length === 0 ? (
                                <p className="field-hint">Нет снимков.</p>
                              ) : (
                                <SnapshotHistoryTable
                                  contractDocYmd={r.doc_date.trim().slice(0, 10)}
                                  snapshots={snapshots}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="data-table-foot">
                  <th scope="row" colSpan={3}>
                    Итого
                  </th>
                  <td className="num">{formatMoney(contractsTotals.totalDebt)}</td>
                  <td className="cell-actions">
                    <span className="data-table-foot__meta">{contractsTotals.count} дог.</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
