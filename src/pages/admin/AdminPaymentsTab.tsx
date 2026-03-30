import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useToast } from '../../context/ToastContext'
import { formatDateIso, formatMoney } from '../../utils/format'
import type { AdminPaymentRow, AdminPerson } from './adminTypes'
import { sortById } from './sort'

function personLabel(p: { first_name?: string; last_name?: string }): string {
  const s = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  return s || '—'
}

/** Подпись в списках: имя и фамилия; при пустых полях — id. */
function personSelectLabel(p: AdminPerson): string {
  const name = personLabel(p)
  return name === '—' ? `Участник · id ${p.id}` : name
}

function paymentsListPath(f: { contractId: string; payerId: string; from: string; to: string }): string {
  const q = new URLSearchParams()
  if (f.contractId.trim()) q.set('contract_id', f.contractId.trim())
  if (f.payerId.trim()) q.set('payer_id', f.payerId.trim())
  if (f.from.trim() && f.to.trim()) {
    q.set('from_date', f.from.trim())
    q.set('to_date', f.to.trim())
  }
  const s = q.toString()
  return s ? '/payments?' + s : '/payments'
}

type Props = {
  showErr: (e: unknown) => void
}

export function AdminPaymentsTab({ showErr }: Props) {
  const toast = useToast()
  const createTitleId = useId()
  const editTitleId = useId()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [rows, setRows] = useState<AdminPaymentRow[] | null>(null)
  const [persons, setPersons] = useState<AdminPerson[] | null>(null)

  const [fContractId, setFContractId] = useState('')
  const [fPayerId, setFPayerId] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [cContractId, setCContractId] = useState('')
  const [cPayerId, setCPayerId] = useState('')
  const [cAmount, setCAmount] = useState('')
  const [cDate, setCDate] = useState('')
  const [cComment, setCComment] = useState('')

  const [editRow, setEditRow] = useState<AdminPaymentRow | null>(null)
  const [ePayerId, setEPayerId] = useState('')
  const [eAmount, setEAmount] = useState('')
  const [eDate, setEDate] = useState('')
  const [eComment, setEComment] = useState('')

  const [confirmId, setConfirmId] = useState<number | null>(null)

  const loadPersons = useCallback(async () => {
    try {
      const list = (await api<AdminPerson[]>('GET', '/persons')) ?? []
      if (Array.isArray(list)) setPersons(sortById(list))
    } catch (e) {
      showErr(e)
    }
  }, [showErr])

  const payerNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const p of persons ?? []) {
      m.set(p.id, personSelectLabel(p))
    }
    return m
  }, [persons])

  const loadList = useCallback(async () => {
    if ((fFrom.trim() && !fTo.trim()) || (!fFrom.trim() && fTo.trim())) {
      showErr(new Error('Укажите оба поля периода (с даты / по дату) или ни одного'))
      return
    }
    setLoading(true)
    setRows(null)
    try {
      const path = paymentsListPath({
        contractId: fContractId,
        payerId: fPayerId,
        from: fFrom,
        to: fTo,
      })
      const list = (await api<AdminPaymentRow[]>('GET', path)) ?? []
      if (!Array.isArray(list)) {
        showErr('unexpected response')
        return
      }
      setRows(sortById(list))
    } catch (e) {
      showErr(e)
    } finally {
      setLoading(false)
    }
  }, [fContractId, fPayerId, fFrom, fTo, showErr])

  useEffect(() => {
    void loadPersons()
  }, [loadPersons])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const list = (await api<AdminPaymentRow[]>('GET', '/payments')) ?? []
        if (!alive) return
        if (!Array.isArray(list)) {
          showErr('unexpected response')
          return
        }
        setRows(sortById(list))
      } catch (e) {
        if (alive) showErr(e)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [showErr])

  const onCreate = async () => {
    const contract_id = parseInt(cContractId, 10)
    const payer_id = parseInt(cPayerId, 10)
    const amount = parseFloat(cAmount)
    const date = cDate.trim()
    const comment = cComment.trim()
    if (!contract_id || !payer_id || !Number.isFinite(amount) || !date) {
      showErr(new Error('Заполните договор, плательщика, сумму и дату'))
      return
    }
    setSubmitting(true)
    try {
      await api('POST', '/payments', { contract_id, payer_id, amount, date, comment })
      toast.show('Платёж создан')
      setCreateOpen(false)
      setCContractId('')
      setCPayerId('')
      setCAmount('')
      setCDate('')
      setCComment('')
      await loadList()
    } catch (e) {
      showErr(e)
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = (r: AdminPaymentRow) => {
    setEditRow(r)
    setEPayerId(String(r.payer_id))
    setEAmount(String(r.amount))
    setEDate(r.date.trim().slice(0, 10))
    setEComment(r.comment ?? '')
  }

  const onSaveEdit = async () => {
    if (!editRow) return
    const payer_id = parseInt(ePayerId, 10)
    const amount = parseFloat(eAmount)
    const date = eDate.trim()
    if (!payer_id || !Number.isFinite(amount) || !date) {
      showErr(new Error('Проверьте плательщика, сумму и дату'))
      return
    }
    setSubmitting(true)
    try {
      await api('PATCH', '/payments/' + editRow.id, {
        payer_id,
        amount,
        date,
        comment: eComment.trim(),
      })
      toast.show('Платёж обновлён')
      setEditRow(null)
      await loadList()
    } catch (e) {
      showErr(e)
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = async (id: number) => {
    setSubmitting(true)
    try {
      await api('DELETE', '/payments/' + id)
      toast.show('Платёж удалён')
      await loadList()
    } catch (e) {
      showErr(e)
    } finally {
      setSubmitting(false)
      setConfirmId(null)
    }
  }

  return (
    <>
      <div className="toolbar toolbar--admin-contracts" style={{ marginBottom: '1rem' }}>
        <div className="toolbar__btns">
          <button type="button" className="btn btn--primary" onClick={() => setCreateOpen(true)}>
            Новый платёж
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => loadList()} disabled={loading}>
            {loading ? (
              <span className="loading-inline">
                <span className="spinner" aria-hidden />
                Обновление…
              </span>
            ) : (
              'Обновить список'
            )}
          </button>
        </div>
        <div className="toolbar__filters toolbar__filters--admin-payments">
          <div className="field-row field-row--pay-filter">
            <label className="field-label" htmlFor="adm-pay-cid">
              ID договора
            </label>
            <input id="adm-pay-cid" className="input" type="number" min={1} placeholder="все" value={fContractId} onChange={(e) => setFContractId(e.target.value)} />
          </div>
          <div className="field-row field-row--pay-filter">
            <label className="field-label" htmlFor="adm-pay-pid">
              Клиент
            </label>
            <select
              id="adm-pay-pid"
              className="input"
              value={fPayerId}
              onChange={(e) => setFPayerId(e.target.value)}
            >
              <option value="">Все</option>
              {sortById(persons ?? []).map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {personSelectLabel(p)}
                </option>
              ))}
            </select>
          </div>
          <div className="field-row field-row--pay-filter">
            <label className="field-label" htmlFor="adm-pay-from">
              С даты
            </label>
            <input id="adm-pay-from" className="input" type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          </div>
          <div className="field-row field-row--pay-filter">
            <label className="field-label" htmlFor="adm-pay-to">
              По дату
            </label>
            <input id="adm-pay-to" className="input" type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
          </div>
        </div>
      </div>

      {loading && rows === null ? (
        <div className="card" aria-hidden style={{ marginTop: '1rem' }}>
          <div className="skeleton" style={{ width: '100%', height: '10rem' }} />
        </div>
      ) : rows !== null && rows.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '1rem' }}>
          <p className="empty-state__title">Нет платежей</p>
        </div>
      ) : rows !== null && rows.length > 0 ? (
        <div className="table-wrap" style={{ marginTop: '1rem' }}>
          <table className="data data--tight">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Дата</th>
                <th scope="col" className="num">
                  Договор
                </th>
                <th scope="col">Плательщик</th>
                <th scope="col" className="num">
                  Сумма
                </th>
                <th scope="col">Комментарий</th>
                <th scope="col" className="cell-actions">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono tabular-nums">{r.id}</td>
                  <td>{formatDateIso(r.date)}</td>
                  <td className="num">{r.contract_id}</td>
                  <td>{payerNameById.get(r.payer_id) ?? `id ${r.payer_id}`}</td>
                  <td className="num">{formatMoney(r.amount)}</td>
                  <td>{r.comment}</td>
                  <td className="cell-actions">
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => openEdit(r)} disabled={submitting}>
                      Изменить
                    </button>{' '}
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmId(r.id)} disabled={submitting}>
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {createOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => !submitting && setCreateOpen(false)}>
          <div className="dialog dialog--form" role="dialog" aria-modal="true" aria-labelledby={createTitleId} onMouseDown={(e) => e.stopPropagation()}>
            <h2 id={createTitleId} className="dialog__title">
              Новый платёж
            </h2>
            <div className="field-grid">
              <div className="field-row">
                <label className="field-label" htmlFor="adm-pc-cid">
                  ID договора
                </label>
                <input id="adm-pc-cid" className="input" type="number" min={1} value={cContractId} onChange={(e) => setCContractId(e.target.value)} />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-pc-pid">
                  Плательщик
                </label>
                <select
                  id="adm-pc-pid"
                  className="input"
                  value={cPayerId}
                  onChange={(e) => setCPayerId(e.target.value)}
                  required
                >
                  <option value="">Выберите плательщика</option>
                  {sortById(persons ?? []).map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {personSelectLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-pc-amt">
                  Сумма
                </label>
                <input id="adm-pc-amt" className="input" type="number" step="any" value={cAmount} onChange={(e) => setCAmount(e.target.value)} />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-pc-date">
                  Дата
                </label>
                <input id="adm-pc-date" className="input" type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-pc-com">
                  Комментарий
                </label>
                <input id="adm-pc-com" className="input" value={cComment} onChange={(e) => setCComment(e.target.value)} />
              </div>
            </div>
            <div className="dialog__actions" style={{ marginTop: 'var(--space-4)' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setCreateOpen(false)} disabled={submitting}>
                Отмена
              </button>
              <button type="button" className="btn btn--primary" onClick={() => onCreate()} disabled={submitting}>
                {submitting ? 'Сохранение…' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editRow && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => !submitting && setEditRow(null)}>
          <div className="dialog dialog--form" role="dialog" aria-modal="true" aria-labelledby={editTitleId} onMouseDown={(e) => e.stopPropagation()}>
            <h2 id={editTitleId} className="dialog__title">
              Платёж #{editRow.id}
            </h2>
            <p className="field-hint">Договор: {editRow.contract_id} (смена договора — через БД или расширение API)</p>
            <div className="field-grid">
              <div className="field-row">
                <label className="field-label" htmlFor="adm-pe-pid">
                  Плательщик
                </label>
                <select
                  id="adm-pe-pid"
                  className="input"
                  value={ePayerId}
                  onChange={(e) => setEPayerId(e.target.value)}
                  required
                >
                  {editRow != null && !persons?.some((p) => p.id === editRow.payer_id) ? (
                    <option value={String(editRow.payer_id)}>{`id ${editRow.payer_id} (нет в списке)`}</option>
                  ) : null}
                  {sortById(persons ?? []).map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {personSelectLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-pe-amt">
                  Сумма
                </label>
                <input id="adm-pe-amt" className="input" type="number" step="any" value={eAmount} onChange={(e) => setEAmount(e.target.value)} />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-pe-date">
                  Дата
                </label>
                <input id="adm-pe-date" className="input" type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-pe-com">
                  Комментарий
                </label>
                <input id="adm-pe-com" className="input" value={eComment} onChange={(e) => setEComment(e.target.value)} />
              </div>
            </div>
            <div className="dialog__actions" style={{ marginTop: 'var(--space-4)' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setEditRow(null)} disabled={submitting}>
                Отмена
              </button>
              <button type="button" className="btn btn--primary" onClick={() => onSaveEdit()} disabled={submitting}>
                {submitting ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmId !== null}
        title="Удалить платёж?"
        message={confirmId !== null ? `Платёж id ${confirmId} будет удалён без восстановления.` : ''}
        confirmLabel="Удалить"
        danger
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          if (confirmId !== null) void onDelete(confirmId)
        }}
      />
    </>
  )
}
