import { Fragment, useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SnapshotHistoryTable } from '../components/SnapshotHistoryTable'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../context/ToastContext'
import type { OpenClientContract } from './ClientPage'
import type { SnapshotRow } from '../types/snapshot'
import { formatDateIso, formatMoney, formatPercent } from '../utils/format'

type BankerClientSummary = {
  client_id: number
  first_name?: string
  last_name?: string
  contracts_count: number
  total_debt: number
}

export function BankerHomePage() {
  const { personId, role } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const baseId = useId()

  const [clients, setClients] = useState<BankerClientSummary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [expandedClientId, setExpandedClientId] = useState<number | null>(null)
  const [contractsByClient, setContractsByClient] = useState<Record<number, OpenClientContract[] | null>>({})
  const [loadingContracts, setLoadingContracts] = useState(false)

  const [expandedContractId, setExpandedContractId] = useState<number | null>(null)
  const [snapshots, setSnapshots] = useState<SnapshotRow[] | null>(null)
  const [snapLoading, setSnapLoading] = useState(false)

  const loadClients = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const rows = (await api<BankerClientSummary[]>('GET', '/banker/clients/summary')) ?? []
      if (!Array.isArray(rows)) {
        setErr('Неожиданный ответ')
        return
      }
      const sorted = [...rows].sort((a, b) => b.total_debt - a.total_debt)
      setClients(sorted)
      setExpandedClientId(null)
      setContractsByClient({})
      setExpandedContractId(null)
      setSnapshots(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role === 'banker' && personId) loadClients().catch(() => {})
  }, [role, personId, loadClients])

  const fetchOpenContracts = async (clientId: number) => {
    setLoadingContracts(true)
    try {
      const list =
        (await api<OpenClientContract[]>('GET', '/banker/clients/' + clientId + '/open-contracts')) ?? []
      if (!Array.isArray(list)) {
        toast.show('Не удалось загрузить договоры', 'error')
        return
      }
      setContractsByClient((prev) => ({ ...prev, [clientId]: list }))
    } catch (e) {
      toast.show(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setLoadingContracts(false)
    }
  }

  const onContractsClick = (clientId: number) => {
    if (expandedClientId === clientId) {
      setExpandedClientId(null)
      setExpandedContractId(null)
      setSnapshots(null)
      return
    }
    setExpandedClientId(clientId)
    setExpandedContractId(null)
    setSnapshots(null)
    setContractsByClient((prev) => ({ ...prev, [clientId]: null }))
    void fetchOpenContracts(clientId)
  }

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

  if (role !== 'banker' || !personId) {
    return (
      <p className="alert alert--error">
        Нужна роль банкира. <Link to="/login">Войти</Link>
      </p>
    )
  }

  const contractsPanelId = `${baseId}-contracts-panel`
  const clientsTitleId = `${baseId}-clients-heading`

  const clientsTotals = useMemo(() => {
    if (!clients?.length) return { totalDebt: 0, contractsCount: 0 }
    return clients.reduce(
      (acc, c) => ({
        totalDebt: acc.totalDebt + c.total_debt,
        contractsCount: acc.contractsCount + c.contracts_count,
      }),
      { totalDebt: 0, contractsCount: 0 },
    )
  }, [clients])

  return (
    <>
      <h1 className="sr-only">Главная</h1>

      {err && (
        <p className="alert alert--error" role="alert">
          {err}
        </p>
      )}

      <section className="card" aria-labelledby={clientsTitleId}>
        <div className="card__head">
          <h2 className="card__title" id={clientsTitleId}>
            Клиенты
          </h2>
          <button type="button" className="btn btn--secondary" onClick={() => loadClients()} disabled={loading}>
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
        {loading && !clients ? (
          <p>Загрузка…</p>
        ) : !clients || clients.length === 0 ? (
          <p className="field-hint">Нет клиентов с открытыми договорами в вашем портфеле.</p>
        ) : (
          <div className="table-wrap">
            <table className="data data--tight">
              <thead>
                <tr>
                  <th scope="col">Имя</th>
                  <th scope="col" className="num">
                    Всего долг
                  </th>
                  <th scope="col" className="cell-actions">
                    Договоры
                  </th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const isClientOpen = expandedClientId === c.client_id
                  const contracts = contractsByClient[c.client_id]
                  const regionId = `${contractsPanelId}-${c.client_id}`
                  return (
                    <Fragment key={c.client_id}>
                      <tr>
                        <td>
                          {[c.first_name, c.last_name].filter(Boolean).join(' ').trim() || '—'}
                        </td>
                        <td className="num">{formatMoney(c.total_debt)}</td>
                        <td className="cell-actions">
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            aria-expanded={isClientOpen}
                            aria-controls={regionId}
                            onClick={() => onContractsClick(c.client_id)}
                          >
                            Договоры
                          </button>
                        </td>
                      </tr>
                      {isClientOpen && (
                        <tr className="table-accordion__row">
                          <td colSpan={3} className="accordion-panel accordion-panel--nested">
                            <div id={regionId} role="region" aria-label={'Договоры клиента ' + c.client_id}>
                              {loadingContracts && contracts === null ? (
                                <p>Загрузка…</p>
                              ) : contracts && contracts.length === 0 ? (
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
                                      {[...(contracts ?? [])]
                                        .sort((a, b) => b.total_debt - a.total_debt)
                                        .map((r) => {
                                        const titleId = `${baseId}-hist-title-${r.contract_id}`
                                        const panelId = `${baseId}-hist-panel-${r.contract_id}`
                                        const histOpen = expandedContractId === r.contract_id
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
                                                  aria-expanded={histOpen}
                                                  aria-controls={panelId}
                                                  onClick={() => onHistoryClick(r.contract_id)}
                                                >
                                                  История
                                                </button>
                                              </td>
                                            </tr>
                                            {histOpen && (
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
                                  </table>
                                </div>
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
                  <th scope="row">Итого</th>
                  <td className="num">{formatMoney(clientsTotals.totalDebt)}</td>
                  <td className="cell-actions">
                    <span className="data-table-foot__meta">{clientsTotals.contractsCount} дог.</span>
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
