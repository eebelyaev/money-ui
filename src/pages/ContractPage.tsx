import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../context/ToastContext'
import { formatDateIso, formatMoney, formatPercent } from '../utils/format'

type Contract = {
  id: number
  client_id: number
  banker_id: number
  doc_date: string
  amount: number
  interest_rate: number
}

type Payment = {
  id: number
  contract_id?: number
  payer_id: number
  amount: number
  date: string
  comment: string
}

function payerRoleLabel(payerId: number, con: Contract | null): string {
  if (!con) return String(payerId)
  if (payerId === con.banker_id) return 'Банкир'
  if (payerId === con.client_id) return 'Клиент'
  return String(payerId)
}

export function ContractPage() {
  const { id } = useParams<{ id: string }>()
  const contractId = parseInt(id ?? '', 10)
  const toast = useToast()

  const [msg, setMsg] = useState<{ type: 'err'; text: string } | null>(null)
  const showErr = useCallback((e: unknown) => {
    const t =
      e && typeof e === 'object' && 'message' in e && typeof (e as Error).message === 'string'
        ? (e as Error).message
        : String(e)
    setMsg({ type: 'err', text: t })
  }, [])

  const [loadingContract, setLoadingContract] = useState(true)
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [contract, setContract] = useState<Contract | null>(null)
  const [payments, setPayments] = useState<Payment[] | null>(null)

  const [pf, setPf] = useState('')
  const [pt, setPt] = useState('')
  const [payPayer, setPayPayer] = useState('')
  const [payAmt, setPayAmt] = useState('')
  const [payDate, setPayDate] = useState('')
  const [payCom, setPayCom] = useState('')
  const [recFrom, setRecFrom] = useState('')

  const [confirmPayment, setConfirmPayment] = useState<number | null>(null)
  const [confirmRecalc, setConfirmRecalc] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [ePayer, setEpayer] = useState('')
  const [eAmt, setEamt] = useState('')
  const [eDate, setEdate] = useState('')
  const [eCom, setEcom] = useState('')

  const paymentsPath = useCallback(() => {
    if (!contractId || contractId < 1) return ''
    if (!pf && !pt) return '/contracts/' + contractId + '/payments'
    if (pf && pt)
      return (
        '/contracts/' +
        contractId +
        '/payments?from_date=' +
        encodeURIComponent(pf) +
        '&to_date=' +
        encodeURIComponent(pt)
      )
    throw new Error('Укажите оба поля «с» и «по» или очистите оба')
  }, [contractId, pf, pt])

  const loadContract = useCallback(async () => {
    if (!contractId || contractId < 1) return
    setLoadingContract(true)
    try {
      const c = await api<Contract>('GET', '/contracts/' + contractId)
      if (c) {
        setContract(c)
        setPayPayer(String(c.client_id))
      }
    } catch (e) {
      showErr(e)
    } finally {
      setLoadingContract(false)
    }
  }, [contractId, showErr])

  const loadPayments = useCallback(async () => {
    if (!contractId || contractId < 1) return
    let path: string
    try {
      path = paymentsPath()
    } catch (e) {
      showErr(e)
      return
    }
    setLoadingPayments(true)
    try {
      const rows = (await api<Payment[]>('GET', path)) ?? []
      if (!Array.isArray(rows)) {
        showErr('unexpected payments response')
        return
      }
      setPayments(rows)
    } catch (e) {
      showErr(e)
    } finally {
      setLoadingPayments(false)
    }
  }, [contractId, paymentsPath, showErr])

  useEffect(() => {
    if (!contractId || contractId < 1) return
    loadContract().catch(() => {})
    loadPayments().catch(() => {})
  }, [contractId, loadContract, loadPayments])

  const onLoadPaymentsClick = () => {
    loadPayments().catch(showErr)
  }

  const onAddPayment = async () => {
    const payer_id = parseInt(payPayer, 10)
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
      await loadPayments()
    } catch (e) {
      showErr(e)
    } finally {
      setSubmitting(false)
    }
  }

  const onDeletePayment = async (pid: number) => {
    setSubmitting(true)
    try {
      await api('DELETE', '/payments/' + pid)
      toast.show('Платёж удалён')
      if (editingId === pid) setEditingId(null)
      await loadPayments()
    } catch (e) {
      showErr(e)
    } finally {
      setSubmitting(false)
      setConfirmPayment(null)
    }
  }

  const beginEdit = (p: Payment) => {
    const iso = p.date.trim().slice(0, 10)
    setEditingId(p.id)
    setEpayer(String(p.payer_id))
    setEamt(String(p.amount))
    setEdate(iso)
    setEcom(p.comment ?? '')
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const onSaveEdit = async () => {
    if (editingId === null) return
    const payer_id = parseInt(ePayer, 10)
    const amount = parseFloat(eAmt)
    const date = eDate
    const comment = eCom.trim()
    if (!date || date.length !== 10) {
      showErr(new Error('Укажите дату в формате ГГГГ-ММ-ДД'))
      return
    }
    if (!Number.isFinite(payer_id) || payer_id < 1) {
      showErr(new Error('Укажите корректный ID плательщика'))
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showErr(new Error('Сумма должна быть больше нуля'))
      return
    }
    setSubmitting(true)
    try {
      await api('PATCH', '/payments/' + editingId, {
        payer_id,
        amount,
        date,
        comment,
      })
      toast.show('Платёж обновлён')
      setEditingId(null)
      await loadPayments()
    } catch (e) {
      showErr(e)
    } finally {
      setSubmitting(false)
    }
  }

  const onRecalc = async () => {
    const from_date = recFrom
    if (!from_date) {
      showErr(new Error('Укажите дату начала пересчёта'))
      return
    }
    setSubmitting(true)
    try {
      await api('POST', '/contracts/' + contractId + '/recalculate', { from_date })
      toast.show('Пересчёт выполнен')
    } catch (e) {
      showErr(e)
    } finally {
      setSubmitting(false)
      setConfirmRecalc(false)
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

  const busy = loadingContract || loadingPayments

  return (
    <>
      <nav className="breadcrumbs" aria-label="Навигация">
        <Link to="/">Главная</Link>
        <span className="breadcrumbs__sep" aria-hidden>
          /
        </span>
        <span aria-current="page">Договор #{contractId}</span>
      </nav>

      <h1 className="page-title">Договор #{contractId}</h1>
      <p className="page-intro">Платежи и пересчёт снимков по договору.</p>

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
              onClick={() => loadPayments().catch(showErr)}
            >
              Обновить платежи
            </button>
          </div>
        </div>
      )}

      <section className="card" aria-busy={loadingContract}>
        <h2 className="card__title">Карточка договора</h2>
        {loadingContract && !contract ? (
          <div className="loading-inline" style={{ minHeight: '6rem' }}>
            <span className="spinner spinner--lg" aria-hidden />
            <span>Загрузка…</span>
          </div>
        ) : contract ? (
          <div className="contract-summary">
            <div className="stat">
              <p className="stat__label">Клиент</p>
              <p className="stat__value font-mono tabular-nums">{contract.client_id}</p>
            </div>
            <div className="stat">
              <p className="stat__label">Банкир</p>
              <p className="stat__value font-mono tabular-nums">{contract.banker_id}</p>
            </div>
            <div className="stat">
              <p className="stat__label">Дата документа</p>
              <p className="stat__value" style={{ fontSize: 'var(--text-lg)' }}>
                {formatDateIso(contract.doc_date)}
              </p>
            </div>
            <div className="stat stat--highlight">
              <p className="stat__label">Сумма</p>
              <p className="stat__value">{formatMoney(contract.amount)}</p>
            </div>
            <div className="stat stat--highlight">
              <p className="stat__label">Ставка</p>
              <p className="stat__value">{formatPercent(contract.interest_rate)}</p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="card" aria-busy={loadingPayments}>
        <h2 className="card__title">Платежи</h2>

        <div className="panel">
          <h3 className="section-title">Период отбора</h3>
          <p className="field-hint">Заполните оба поля или ни одного — иначе запрос к API будет отклонён.</p>
          <div className="field-row field-row--filters" style={{ marginBottom: '1rem' }}>
            <div className="field-row">
              <label className="field-label" htmlFor="pay-from">
                С даты
              </label>
              <input id="pay-from" className="input" type="date" value={pf} onChange={(e) => setPf(e.target.value)} />
            </div>
            <div className="field-row">
              <label className="field-label" htmlFor="pay-to">
                По дату
              </label>
              <input id="pay-to" className="input" type="date" value={pt} onChange={(e) => setPt(e.target.value)} />
            </div>
          </div>
          <div className="toolbar">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onLoadPaymentsClick}
              disabled={busy || submitting}
            >
              {loadingPayments ? (
                <span className="loading-inline">
                  <span className="spinner" aria-hidden />
                  Загрузка…
                </span>
              ) : (
                'Загрузить платежи'
              )}
            </button>
          </div>
        </div>

        {loadingPayments && payments === null ? (
          <div className="skeleton" style={{ width: '100%', height: '8rem', marginTop: '1rem' }} aria-hidden />
        ) : payments?.length === 0 ? (
          <div className="empty-state" style={{ marginTop: '1rem' }}>
            <div className="empty-state__icon" aria-hidden>
              💳
            </div>
            <p className="empty-state__title">Нет платежей</p>
            <p className="empty-state__text">Добавьте платёж ниже или смените период отбора.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col" className="num">
                    Плательщик
                  </th>
                  <th scope="col" className="num">
                    Сумма
                  </th>
                  <th scope="col">Дата</th>
                  <th scope="col">Комментарий</th>
                  <th scope="col" className="cell-actions">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {(payments ?? []).map((r) => (
                  <tr key={r.id} className={editingId === r.id ? 'is-editing' : undefined}>
                    <td className="font-mono tabular-nums">{r.id}</td>
                    <td>{payerRoleLabel(r.payer_id, contract)}</td>
                    <td className="num">{formatMoney(r.amount)}</td>
                    <td>{formatDateIso(r.date)}</td>
                    <td>{r.comment}</td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => beginEdit(r)}
                        disabled={submitting}
                      >
                        Изменить
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => setConfirmPayment(r.id)}
                        disabled={submitting}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editingId !== null && (
          <div className="card" style={{ marginTop: 'var(--space-5)' }}>
            <h3 className="section-title">Редактирование платежа #{editingId}</h3>
            <p className="field-hint">Изменения отправляются на сервер (PATCH). Дата — в формате для API (поле ниже использует календарь).</p>
            <div className="field-grid">
              <div className="field-row">
                <label className="field-label" htmlFor="edit-payer">
                  ID плательщика
                </label>
                <input
                  id="edit-payer"
                  className="input"
                  type="number"
                  min={1}
                  value={ePayer}
                  onChange={(e) => setEpayer(e.target.value)}
                />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="edit-amt">
                  Сумма
                </label>
                <input
                  id="edit-amt"
                  className="input"
                  type="number"
                  step="any"
                  min={0}
                  value={eAmt}
                  onChange={(e) => setEamt(e.target.value)}
                />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="edit-date">
                  Дата
                </label>
                <input id="edit-date" className="input" type="date" value={eDate} onChange={(e) => setEdate(e.target.value)} />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="edit-com">
                  Комментарий
                </label>
                <input id="edit-com" className="input" value={eCom} onChange={(e) => setEcom(e.target.value)} />
              </div>
              <div className="field-row field-row--inline">
                <button type="button" className="btn btn--primary" onClick={() => onSaveEdit()} disabled={submitting}>
                  {submitting ? 'Сохранение…' : 'Сохранить'}
                </button>
                <button type="button" className="btn btn--secondary" onClick={cancelEdit} disabled={submitting}>
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="panel" style={{ marginTop: 'var(--space-6)' }}>
          <h3 className="section-title">Новый платёж</h3>
          <div className="field-grid">
            <div className="field-row">
              <label className="field-label" htmlFor="pay-payer">
                ID плательщика
              </label>
              <input
                id="pay-payer"
                className="input"
                type="number"
                min={1}
                value={payPayer}
                onChange={(e) => setPayPayer(e.target.value)}
              />
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
            <div>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => onAddPayment()}
                disabled={submitting}
              >
                {submitting ? 'Сохранение…' : 'Добавить платёж'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="card danger-zone">
        <h2 className="card__title">Пересчёт снимков</h2>
        <p className="field-hint">
          Снимки с датой документа не раньше указанной даты по этому договору будут удалены и пересобраны. Операция
          необратима при потере данных в снимках — убедитесь в дате.
        </p>
        <div className="field-grid" style={{ maxWidth: '20rem' }}>
          <div className="field-row">
            <label className="field-label" htmlFor="rec-from">
              Пересчитать с даты
            </label>
            <input
              id="rec-from"
              className="input"
              type="date"
              value={recFrom}
              onChange={(e) => setRecFrom(e.target.value)}
              required
            />
          </div>
          <div>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                if (!recFrom) {
                  showErr(new Error('Укажите дату начала пересчёта'))
                  return
                }
                setConfirmRecalc(true)
              }}
              disabled={submitting}
            >
              Пересчитать
            </button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirmPayment !== null}
        title="Удалить платёж?"
        message={
          confirmPayment !== null
            ? `Платёж ${confirmPayment} будет удалён без восстановления.`
            : ''
        }
        confirmLabel="Удалить"
        danger
        onCancel={() => setConfirmPayment(null)}
        onConfirm={() => {
          if (confirmPayment !== null) void onDeletePayment(confirmPayment)
        }}
      />

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
    </>
  )
}
