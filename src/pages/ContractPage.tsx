import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ContractsHistoryPeriodToggle } from '../components/ContractsHistoryPeriodToggle'
import { SnapshotHistoryTable } from '../components/SnapshotHistoryTable'
import { useToast } from '../context/ToastContext'
import type { SnapshotRow } from '../types/snapshot'
import { annualRateDecimal, localTodayYmd, projectDebtAfterLastSnapshot } from '../utils/debtProjection'
import { formatDateIso, formatMoney, formatMoneyRounded, formatPercent } from '../utils/format'
import type { ContractsHistoryPeriod } from '../utils/contractsHistory'

type Contract = {
  id: number
  client_id: number
  banker_id: number
  doc_date: string
  amount: number
  interest_rate: number
  close_date?: string | null
  /** Остаток долга (тело + проценты) по последнему снимку; иначе как у API — сумма договора. */
  total_debt?: number
  balance_principal?: number
  balance_interest?: number
  has_snapshot?: boolean
}

const DEBT_ZERO_EPS = 0.01

function lastSnapshotYmd(snapshots: SnapshotRow[]): string | null {
  if (!snapshots.length) return null
  let last = snapshots[0].doc_date.trim().slice(0, 10)
  for (let i = 1; i < snapshots.length; i++) {
    const d = snapshots[i].doc_date.trim().slice(0, 10)
    if (d > last) last = d
  }
  return last.length === 10 ? last : null
}

type Person = {
  id: number
  first_name: string
  last_name: string
  tg_id: number
  tg_login: string
  roles?: string[]
}

function personLabel(p: { first_name?: string; last_name?: string } | null | undefined): string {
  if (!p) return '—'
  const s = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  return s || '—'
}

export function ContractPage() {
  const { id } = useParams<{ id: string }>()
  const contractId = parseInt(id ?? '', 10)
  const toast = useToast()
  const { role } = useAuth()
  const isClientViewer = role === 'client'
  const isBankerViewer = role === 'banker' || role === 'admin'

  const [msg, setMsg] = useState<{ type: 'err'; text: string } | null>(null)
  const showErr = useCallback((e: unknown) => {
    const t =
      e && typeof e === 'object' && 'message' in e && typeof (e as Error).message === 'string'
        ? (e as Error).message
        : String(e)
    setMsg({ type: 'err', text: t })
  }, [])

  const [loadingContract, setLoadingContract] = useState(true)
  const [snapLoading, setSnapLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [contract, setContract] = useState<Contract | null>(null)
  const [snapshots, setSnapshots] = useState<SnapshotRow[] | null>(null)

  const [payPayerRole, setPayPayerRole] = useState<'client' | 'banker'>('client')
  const [payAmt, setPayAmt] = useState('')
  const [payDate, setPayDate] = useState('')
  const [payCom, setPayCom] = useState('')
  const [recFrom, setRecFrom] = useState('')

  const [newPaymentOpen, setNewPaymentOpen] = useState(false)
  const newPaymentTitleId = useId()
  const [histPeriod, setHistPeriod] = useState<ContractsHistoryPeriod>('3m')
  const [historyOpen, setHistoryOpen] = useState(false)
  const historyPanelId = useId()
  const historyHeadId = useId()

  const [confirmRecalc, setConfirmRecalc] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [pendingCloseYmd, setPendingCloseYmd] = useState<string | null>(null)

  const [persons, setPersons] = useState<Person[] | null>(null)
  /** Имена по id договора: надёжно для клиента, когда GET /persons недоступен или урезан. */
  const [partyById, setPartyById] = useState<Record<number, Person>>({})

  const personById = useMemo(() => {
    const m = new Map<number, Person>()
    for (const p of persons ?? []) m.set(p.id, p)
    return m
  }, [persons])

  const loadPersons = useCallback(async () => {
    try {
      const rows = (await api<Person[]>('GET', '/persons')) ?? []
      if (Array.isArray(rows)) setPersons(rows)
    } catch {
      /* список имён необязателен для карточки */
    }
  }, [])

  useEffect(() => {
    loadPersons().catch(() => {})
  }, [loadPersons])

  useEffect(() => {
    if (!contract) return
    const ids = [...new Set([contract.client_id, contract.banker_id])]
    let cancelled = false
    void (async () => {
      const updates: Record<number, Person> = {}
      await Promise.all(
        ids.map(async (id) => {
          try {
            const p = await api<Person>('GET', '/persons/' + id)
            if (p && typeof (p as Person).id === 'number') updates[id] = p as Person
          } catch {
            /* нет доступа или нет записи */
          }
        }),
      )
      if (!cancelled) setPartyById((prev) => ({ ...prev, ...updates }))
    })()
    return () => {
      cancelled = true
    }
  }, [contract?.id, contract?.client_id, contract?.banker_id])

  const resolveParty = useCallback(
    (pid: number) => partyById[pid] ?? personById.get(pid),
    [partyById, personById],
  )

  const loadContract = useCallback(async () => {
    if (!contractId || contractId < 1) return
    setLoadingContract(true)
    try {
      const c = await api<Contract>('GET', '/contracts/' + contractId)
      if (c) {
        setContract(c)
      }
    } catch (e) {
      showErr(e)
    } finally {
      setLoadingContract(false)
    }
  }, [contractId, showErr])

  const loadSnapshots = useCallback(async () => {
    if (!contractId || contractId < 1) return
    setSnapLoading(true)
    try {
      const list = (await api<SnapshotRow[]>('GET', '/contracts/' + contractId + '/snapshots')) ?? []
      if (!Array.isArray(list)) {
        showErr('Неожиданный ответ истории остатков')
        return
      }
      setSnapshots(list)
    } catch (e) {
      showErr(e)
    } finally {
      setSnapLoading(false)
    }
  }, [contractId, showErr])

  useEffect(() => {
    if (!contractId || contractId < 1) return
    loadContract().catch(() => {})
    loadSnapshots().catch(() => {})
  }, [contractId, loadContract, loadSnapshots])

  const onAddPayment = async () => {
    if (!contract) {
      showErr(new Error('Договор не загружен'))
      return
    }
    const payer_id = payPayerRole === 'client' ? contract.client_id : contract.banker_id
    const amount = parseFloat(payAmt)
    const date = payDate
    const comment = payCom.trim()
    setSubmitting(true)
    try {
      await api('POST', '/payments', {
        contract_id: contractId,
        payer_id,
        amount,
        date,
        comment,
      })
      toast.show('Платёж создан')
      setNewPaymentOpen(false)
      setPayAmt('')
      setPayDate('')
      setPayCom('')
      await loadContract()
      await loadSnapshots()
    } catch (e) {
      showErr(e)
    } finally {
      setSubmitting(false)
    }
  }

  const onNewPaymentClick = () => {
    setNewPaymentOpen(true)
  }

  useEffect(() => {
    if (!newPaymentOpen) return
    const t = window.setTimeout(() => document.getElementById('pay-amt')?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [newPaymentOpen])

  useEffect(() => {
    if (newPaymentOpen && isClientViewer) setPayPayerRole('client')
  }, [newPaymentOpen, isClientViewer])

  useEffect(() => {
    if (!newPaymentOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) setNewPaymentOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newPaymentOpen, submitting])

  const onRecalc = async () => {
    const from_date = recFrom
    if (!from_date) {
      showErr(new Error('Укажите дату начала пересчёта'))
      return
    }
    setMsg(null)
    setSubmitting(true)
    try {
      await api('POST', '/contracts/' + contractId + '/recalculate', { from_date })
      toast.show('Пересчёт выполнен')
      await loadContract()
      await loadSnapshots()
    } catch (e) {
      showErr(e)
    } finally {
      setSubmitting(false)
      setConfirmRecalc(false)
    }
  }

  const cardDebt = useMemo(() => {
    if (!contract) return null
    const todayYmd = localTodayYmd()
    if (snapshots && snapshots.length > 0) {
      const last = [...snapshots].reduce((a, b) => (a.doc_date >= b.doc_date ? a : b))
      const p = projectDebtAfterLastSnapshot({
        principal: last.principal,
        interestBalance: last.interest,
        annualRateDecimal: annualRateDecimal(contract.interest_rate),
        lastSnapshotYmd: last.doc_date.trim().slice(0, 10),
        endYmd: todayYmd,
      })
      return {
        kind: 'projected' as const,
        total: p.total,
        principal: p.principal,
        interest: p.interest,
        extraInterest: p.extraInterest,
        accrualDays: p.accrualDays,
        lastSnapshotYmd: last.doc_date.trim().slice(0, 10),
      }
    }
    return {
      kind: 'api' as const,
      total: contract.total_debt ?? contract.amount,
      hasSnapshot: contract.has_snapshot === true,
      principal: contract.balance_principal,
      interest: contract.balance_interest,
      snapshotsPending: snapLoading && snapshots === null,
    }
  }, [contract, snapshots, snapLoading])

  const debtIsZero = useMemo(() => {
    if (!contract) return false
    const t = cardDebt?.total ?? contract.total_debt ?? contract.amount
    return Math.abs(t) < DEBT_ZERO_EPS
  }, [contract, cardDebt])

  const onCloseContractPrepare = () => {
    if (!contract) return
    if (contract.close_date) {
      showErr(new Error('Договор уже закрыт.'))
      return
    }
    if (!debtIsZero) {
      showErr(new Error('Закрыть можно только при нулевом остатке долга.'))
      return
    }
    if (!snapshots?.length) {
      showErr(new Error('Нет снимков — сначала дождитесь загрузки истории или нажмите «Обновить историю».'))
      return
    }
    const closeYmd = lastSnapshotYmd(snapshots)
    if (!closeYmd) {
      showErr(new Error('Не удалось определить дату последнего снимка.'))
      return
    }
    setPendingCloseYmd(closeYmd)
    setConfirmClose(true)
  }

  const onCloseContractConfirm = async () => {
    if (!pendingCloseYmd) return
    setSubmitting(true)
    try {
      await api('PATCH', '/contracts/' + contractId, { close_date: pendingCloseYmd })
      toast.show('Договор закрыт')
      setConfirmClose(false)
      setPendingCloseYmd(null)
      await loadContract()
      await loadSnapshots()
    } catch (e) {
      showErr(e)
    } finally {
      setSubmitting(false)
    }
  }

  if (!contractId || contractId < 1) {
    return (
      <>
        <nav className="breadcrumbs" aria-label="Навигация">
          <Link to="/">Главная</Link>
        </nav>
        <p className="alert alert--error" role="alert">
          Укажите числовой id в адресе: <span className="font-mono">/contracts/&lt;id&gt;</span>
        </p>
      </>
    )
  }

  const contractPageTitle =
    contract != null
      ? `Договор №${contractId} от ${formatDateIso(contract.doc_date)}`
      : `Договор №${contractId}`

  return (
    <>
      <nav className="breadcrumbs" aria-label="Навигация">
        <Link to="/">Главная</Link>
        <span className="breadcrumbs__sep" aria-hidden>
          /
        </span>
        <span aria-current="page">{contractPageTitle}</span>
      </nav>

      <h1 className="page-title">{contractPageTitle}</h1>
      {!isClientViewer && (
        <p className="page-intro">
          История остатков по снимкам и пересчёт; новый платёж — из карточки договора.
        </p>
      )}

      {msg?.type === 'err' && (
        <div className="alert alert--error alert--persistent" role="alert">
          {msg.text}
          <div className="toolbar" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => loadContract().catch(showErr)}>
              Обновить договор
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => loadSnapshots().catch(showErr)}
            >
              Обновить историю
            </button>
          </div>
        </div>
      )}

      <section className="card contract-card" aria-busy={loadingContract}>
        <div className="contract-card__head">
          <h2 className="card__title">Карточка договора</h2>
          {contract && !isClientViewer && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={onNewPaymentClick}
              disabled={loadingContract || submitting || !!contract.close_date}
            >
              Новый платёж
            </button>
          )}
        </div>
        {loadingContract && !contract ? (
          <div className="loading-inline" style={{ minHeight: '6rem' }}>
            <span className="spinner spinner--lg" aria-hidden />
            <span>Загрузка…</span>
          </div>
        ) : contract ? (
          <>
            <dl className="contract-spec">
              {!isClientViewer && (
                <div className="contract-spec__row">
                  <dt>Клиент</dt>
                  <dd>
                    <span className="contract-spec__value">{personLabel(resolveParty(contract.client_id))}</span>
                  </dd>
                </div>
              )}
              {!isBankerViewer && (
                <div className="contract-spec__row">
                  <dt>Банкир</dt>
                  <dd>
                    <span className="contract-spec__value">{personLabel(resolveParty(contract.banker_id))}</span>
                  </dd>
                </div>
              )}
              {contract.close_date && (
                <div className="contract-spec__row">
                  <dt>Закрыт</dt>
                  <dd>
                    <span className="contract-spec__value">{formatDateIso(contract.close_date)}</span>
                  </dd>
                </div>
              )}
              <div className="contract-spec__row">
                <dt>Процентная ставка</dt>
                <dd>
                  <span className="contract-spec__value">{formatPercent(contract.interest_rate)}</span>
                </dd>
              </div>
              <div className="contract-spec__row contract-spec__row--debt">
                <dt>Текущая сумма долга</dt>
                <dd>
                  <span className="contract-spec__value contract-spec__value--amount">
                    {formatMoneyRounded(cardDebt?.total ?? (contract.total_debt ?? contract.amount))}
                  </span>
                  {cardDebt?.kind === 'api' && contract.has_snapshot === false && (
                    <p className="field-hint contract-spec__hint">
                      Снимков начислений ещё нет — показана сумма по договору (тело).
                    </p>
                  )}
                  {cardDebt?.kind === 'api' &&
                    cardDebt.snapshotsPending &&
                    contract.has_snapshot === true &&
                    contract.balance_principal != null &&
                    contract.balance_interest != null && (
                      <p className="field-hint contract-spec__hint">
                        Тело {formatMoneyRounded(contract.balance_principal)} + проценты{' '}
                        {formatMoneyRounded(contract.balance_interest)} (по
                        данным API; после загрузки снимков — оценка до сегодня).
                      </p>
                    )}
                  {cardDebt?.kind === 'api' &&
                    !cardDebt.snapshotsPending &&
                    contract.has_snapshot === true &&
                    contract.balance_principal != null &&
                    contract.balance_interest != null && (
                      <p className="field-hint contract-spec__hint">
                        Тело {formatMoneyRounded(contract.balance_principal)} + проценты{' '}
                        {formatMoneyRounded(contract.balance_interest)}
                      </p>
                    )}
                  {cardDebt?.kind === 'projected' && (
                    <p className="field-hint contract-spec__hint">
                      Тело {formatMoneyRounded(cardDebt.principal)} + проценты {formatMoneyRounded(cardDebt.interest)}.
                      {cardDebt.accrualDays > 0 ? (
                        <>
                          {' '}
                          К процентам по последнему снимку ({formatDateIso(cardDebt.lastSnapshotYmd)}) добавлено доначисление
                          на тело {formatMoney(cardDebt.extraInterest)} за {cardDebt.accrualDays} календ. дн. до сегодня (
                          {formatPercent(annualRateDecimal(contract.interest_rate))} годовых, ACT/365).
                        </>
                      ) : (
                        <> По последнему снимку на {formatDateIso(cardDebt.lastSnapshotYmd)} доначислений до сегодня нет.</>
                      )}
                    </p>
                  )}
                </dd>
              </div>
            </dl>

            {!isClientViewer && (
              <div className="contract-card__recalc">
                <div className="contract-recalc-row">
                  <label className="field-label contract-recalc-row__label" htmlFor="rec-from">
                    Пересчитать с даты
                  </label>
                  <input
                    id="rec-from"
                    className="input contract-recalc-row__date"
                    type="date"
                    value={recFrom}
                    onChange={(e) => setRecFrom(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn--danger contract-recalc-row__btn"
                    onClick={() => {
                      if (!recFrom) {
                        showErr(new Error('Укажите дату начала пересчёта'))
                        return
                      }
                      setMsg(null)
                      setConfirmRecalc(true)
                    }}
                    disabled={submitting || !!contract.close_date}
                  >
                    Пересчитать
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary contract-recalc-row__btn"
                    onClick={onCloseContractPrepare}
                    disabled={
                      submitting ||
                      !!contract.close_date ||
                      !debtIsZero ||
                      loadingContract ||
                      snapLoading ||
                      !snapshots?.length
                    }
                    title={
                      contract.close_date
                        ? 'Договор уже закрыт'
                        : !debtIsZero
                          ? 'Остаток долга должен быть нулевым'
                          : !snapshots?.length
                            ? 'Нужна загруженная история снимков'
                            : 'Закрыть договор: дата закрытия = дата последнего снимка'
                    }
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </section>

      <section className="card" aria-busy={snapLoading}>
        <div className="toolbar contract-history-toolbar">
          <button
            type="button"
            id={historyHeadId}
            className="contract-history-toggle"
            aria-expanded={historyOpen}
            aria-controls={historyPanelId}
            onClick={() => setHistoryOpen((o) => !o)}
          >
            <h2 className="card__title contract-history-toggle__title">История остатков</h2>
            <span className="contract-history-toggle__chevron" aria-hidden>
              {historyOpen ? '▼' : '▶'}
            </span>
          </button>
          {historyOpen && (
            <div className="contract-history-toolbar__actions">
              <ContractsHistoryPeriodToggle value={histPeriod} onChange={setHistPeriod} />
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => loadSnapshots().catch(showErr)}
                disabled={snapLoading || loadingContract}
              >
                {snapLoading ? (
                  <span className="loading-inline">
                    <span className="spinner" aria-hidden />
                    Загрузка…
                  </span>
                ) : (
                  'Обновить историю'
                )}
              </button>
            </div>
          )}
        </div>
        {historyOpen && (
          <div
            id={historyPanelId}
            role="region"
            aria-labelledby={historyHeadId}
            style={{ marginTop: 'var(--space-3)' }}
          >
            {snapLoading && snapshots === null ? (
              <div className="loading-inline" style={{ minHeight: '4rem' }}>
                <span className="spinner spinner--lg" aria-hidden />
                <span>Загрузка…</span>
              </div>
            ) : snapshots && snapshots.length === 0 ? (
              <p className="field-hint">Нет снимков.</p>
            ) : contract ? (
              <SnapshotHistoryTable
                contractDocYmd={contract.doc_date.trim().slice(0, 10)}
                snapshots={snapshots}
                period={histPeriod}
                onPeriodChange={setHistPeriod}
                showPeriodToggle={false}
              />
            ) : (
              <p className="field-hint">Загрузите карточку договора.</p>
            )}
          </div>
        )}
      </section>

      {newPaymentOpen && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={() => {
            if (!submitting) setNewPaymentOpen(false)
          }}
        >
          <div
            className="dialog dialog--form"
            role="dialog"
            aria-modal="true"
            aria-labelledby={newPaymentTitleId}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id={newPaymentTitleId} className="dialog__title">
              Новый платёж
            </h2>
            <div className="field-grid">
              <div className="field-row">
                <span className="field-label" id="pay-payer-label">
                  Плательщик
                </span>
                {isClientViewer ? (
                  <p className="field-hint" style={{ marginTop: 0, marginBottom: 0 }}>
                    Учитывается как платёж с вашей стороны (уменьшение долга).
                  </p>
                ) : (
                  <>
                    <div
                      className="payment-payer-toggle"
                      role="radiogroup"
                      aria-labelledby="pay-payer-label"
                    >
                      <button
                        type="button"
                        className={
                          'payment-payer-toggle__btn' +
                          (payPayerRole === 'client' ? ' payment-payer-toggle__btn--active' : '')
                        }
                        role="radio"
                        aria-checked={payPayerRole === 'client'}
                        onClick={() => setPayPayerRole('client')}
                      >
                        <span className="payment-payer-toggle__sign" aria-hidden>
                          −
                        </span>
                        <span className="payment-payer-toggle__main">Клиент</span>
                        <span className="payment-payer-toggle__sub">возврат</span>
                      </button>
                      <button
                        type="button"
                        className={
                          'payment-payer-toggle__btn' +
                          (payPayerRole === 'banker' ? ' payment-payer-toggle__btn--active' : '')
                        }
                        role="radio"
                        aria-checked={payPayerRole === 'banker'}
                        onClick={() => setPayPayerRole('banker')}
                      >
                        <span className="payment-payer-toggle__sign" aria-hidden>
                          +
                        </span>
                        <span className="payment-payer-toggle__main">Банкир</span>
                        <span className="payment-payer-toggle__sub">зачисление</span>
                      </button>
                    </div>
                    <p className="field-hint" style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
                      «−» — платёж клиента (уменьшение долга), «+» — ввод средств банкира на договор.
                    </p>
                  </>
                )}
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="pay-amt">
                  Сумма
                </label>
                <input
                  id="pay-amt"
                  className="input"
                  type="number"
                  step="any"
                  min={0}
                  value={payAmt}
                  onChange={(e) => setPayAmt(e.target.value)}
                />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="pay-date">
                  Дата
                </label>
                <input id="pay-date" className="input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="pay-com">
                  Комментарий
                </label>
                <input id="pay-com" className="input" value={payCom} onChange={(e) => setPayCom(e.target.value)} />
              </div>
            </div>
            <div className="dialog__actions" style={{ marginTop: 'var(--space-4)' }}>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setNewPaymentOpen(false)}
                disabled={submitting}
              >
                Отмена
              </button>
              <button type="button" className="btn btn--primary" onClick={() => onAddPayment()} disabled={submitting}>
                {submitting ? 'Сохранение…' : 'Добавить платёж'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!isClientViewer && (
        <ConfirmDialog
          open={confirmRecalc}
          title="Запустить пересчёт?"
          message={
            recFrom
              ? `Будут пересобраны снимки с даты ${formatDateIso(recFrom)} (включительно по правилам договора). Продолжить?`
              : ''
          }
          confirmLabel="Пересчитать"
          danger
          onCancel={() => setConfirmRecalc(false)}
          onConfirm={() => {
            void onRecalc()
          }}
        />
      )}

      <ConfirmDialog
        open={confirmClose}
        title="Закрыть договор?"
        message={
          pendingCloseYmd
            ? `Будет установлена дата закрытия ${formatDateIso(pendingCloseYmd)} (по последнему снимку). Продолжить?`
            : ''
        }
        confirmLabel="Закрыть"
        danger
        onCancel={() => {
          setConfirmClose(false)
          setPendingCloseYmd(null)
        }}
        onConfirm={() => {
          void onCloseContractConfirm()
        }}
      />
    </>
  )
}
