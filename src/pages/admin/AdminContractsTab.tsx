import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useToast } from '../../context/ToastContext'
import { formatDateIso, formatMoney, formatPercent } from '../../utils/format'
import type { AdminContractRow, AdminPerson } from './adminTypes'
import { sortById } from './sort'

function personLabel(p: { first_name?: string; last_name?: string }): string {
  const s = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  return s || '—'
}

/** Подпись в списках: ФИО и id для однозначности. */
function personSelectLabel(p: AdminPerson): string {
  const name = personLabel(p)
  return name === '—' ? `Участник · id ${p.id}` : `${name} · id ${p.id}`
}

type Props = {
  showErr: (e: unknown) => void
}

export function AdminContractsTab({ showErr }: Props) {
  const toast = useToast()
  const { personId, role } = useAuth()
  const editTitleId = useId()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [persons, setPersons] = useState<AdminPerson[] | null>(null)
  const [contracts, setContracts] = useState<AdminContractRow[] | null>(null)

  /** Пустая строка — все договоры; иначе id участника (банкир или клиент). */
  const [fPersonId, setFPersonId] = useState('')
  /** '' = все; open / closed — см. query `status` в API. */
  const [fStatus, setFStatus] = useState<'open' | 'closed' | ''>('')

  const [showContractForm, setShowContractForm] = useState(false)
  const [cClient, setCClient] = useState('')
  const [cBanker, setCBanker] = useState('')
  const [cDate, setCDate] = useState('')
  const [cAmount, setCAmount] = useState('')
  const [cRate, setCRate] = useState('')

  const [editRow, setEditRow] = useState<AdminContractRow | null>(null)
  const [editDocDate, setEditDocDate] = useState('')
  const [editBankerId, setEditBankerId] = useState('')
  const [editClientId, setEditClientId] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editRate, setEditRate] = useState('')
  const [editCloseDate, setEditCloseDate] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [confirmContract, setConfirmContract] = useState<number | null>(null)

  const loadPersons = useCallback(async () => {
    try {
      const rows = (await api<AdminPerson[]>('GET', '/persons')) ?? []
      if (Array.isArray(rows)) setPersons(sortById(rows))
    } catch (e) {
      showErr(e)
    }
  }, [showErr])

  const contractQuery = useCallback(() => {
    const q = new URLSearchParams()
    const p = fPersonId.trim()
    if (p) q.set('person', p)
    if (fStatus === 'open' || fStatus === 'closed') q.set('status', fStatus)
    const s = q.toString()
    return s ? '?' + s : ''
  }, [fPersonId, fStatus])

  const loadContracts = useCallback(async () => {
    const q = contractQuery()
    setLoading(true)
    try {
      const rows = (await api<AdminContractRow[]>('GET', '/contracts' + q)) ?? []
      if (!Array.isArray(rows)) {
        showErr('unexpected response')
        return
      }
      setContracts(sortById(rows))
    } catch (e) {
      showErr(e)
    } finally {
      setLoading(false)
    }
  }, [contractQuery, showErr])

  useEffect(() => {
    void loadPersons()
  }, [loadPersons])

  useEffect(() => {
    void loadContracts()
  }, [loadContracts])

  const mePerson = personId ? persons?.find((p) => p.id === personId) : undefined

  /** Только ФИО для таблицы договоров (без id в подписи). */
  const contractPersonNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const p of persons ?? []) {
      m.set(p.id, personLabel(p))
    }
    return m
  }, [persons])

  const onCreateContract = async () => {
    const client_id = parseInt(cClient, 10)
    const banker_id = role === 'admin' ? parseInt(cBanker.trim(), 10) : personId ?? 0
    const doc_date = cDate
    const amount = parseFloat(cAmount)
    const interest_rate = parseFloat(cRate)
    if (!banker_id || banker_id < 1) {
      showErr(new Error(role === 'admin' ? 'Укажите ID банкира' : 'Нужен вход банкира (person id)'))
      return
    }
    setSubmitting(true)
    try {
      await api('POST', '/contracts', { client_id, banker_id, doc_date, amount, interest_rate })
      toast.show('Договор создан')
      setShowContractForm(false)
      await loadContracts()
    } catch (e) {
      showErr(e)
    } finally {
      setSubmitting(false)
    }
  }

  const onDeleteContract = async (id: number) => {
    setSubmitting(true)
    try {
      await api('DELETE', '/contracts/' + id)
      toast.show('Договор удалён')
      await loadContracts()
    } catch (e) {
      showErr(e)
    } finally {
      setSubmitting(false)
      setConfirmContract(null)
    }
  }

  const openEditContract = (r: AdminContractRow) => {
    setEditRow(r)
    setEditDocDate(r.doc_date.trim().slice(0, 10))
    setEditBankerId(String(r.banker_id))
    setEditClientId(String(r.client_id))
    setEditAmount(String(r.amount))
    const pct = r.interest_rate <= 1 ? r.interest_rate * 100 : r.interest_rate
    setEditRate(String(pct))
    setEditCloseDate(r.close_date ? r.close_date.trim().slice(0, 10) : '')
  }

  const onSaveEditContract = async () => {
    if (!editRow) return
    setEditSaving(true)
    try {
      const amount = parseFloat(editAmount)
      const rateVal = parseFloat(editRate)
      const cid = parseInt(editClientId, 10)
      if (!Number.isFinite(amount) || !Number.isFinite(rateVal) || !Number.isFinite(cid) || cid < 1) {
        showErr(new Error('Проверьте сумму, ставку и ID клиента'))
        return
      }
      const interest_rate = editRow.interest_rate <= 1 ? rateVal / 100 : rateVal
      const body: Record<string, unknown> = {
        amount,
        interest_rate,
        client_id: cid,
      }
      if (!editCloseDate.trim()) {
        body.clear_close_date = true
      } else {
        body.close_date = editCloseDate.trim()
      }
      if (role === 'admin') {
        const dd = editDocDate.trim()
        const bid = parseInt(editBankerId, 10)
        if (!dd || dd.length !== 10) {
          showErr(new Error('Укажите дату документа'))
          return
        }
        if (!Number.isFinite(bid) || bid < 1) {
          showErr(new Error('Укажите ID банкира'))
          return
        }
        body.doc_date = dd
        body.banker_id = bid
      }
      await api('PATCH', '/contracts/' + editRow.id, body)
      toast.show('Договор обновлён')
      setEditRow(null)
      await loadContracts()
    } catch (e) {
      showErr(e)
    } finally {
      setEditSaving(false)
    }
  }

  useEffect(() => {
    if (!editRow) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !editSaving) setEditRow(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editRow, editSaving])

  return (
    <>
      <div className="toolbar">
        <button type="button" className="btn btn--primary" onClick={() => setShowContractForm(true)} disabled={loading}>
          Новый договор
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => loadContracts()} disabled={loading}>
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

      <div className={showContractForm ? 'card' : 'hidden'}>
        <h2 className="section-title">Новый договор</h2>
        <div className="field-grid">
          <div className="field-row">
            <label className="field-label" htmlFor="adm-c-client">
              Клиент
            </label>
            <select
              id="adm-c-client"
              className="input"
              value={cClient}
              onChange={(e) => setCClient(e.target.value)}
              required
            >
              <option value="">Выберите клиента</option>
              {sortById(persons ?? []).map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {personLabel(p)}
                  </option>
                ))}
            </select>
          </div>
          <div className="field-row">
            <label className="field-label" htmlFor={role === 'admin' ? 'adm-c-banker' : 'adm-c-banker-display'}>
              Банкир
            </label>
            {role === 'admin' ? (
              <input
                id="adm-c-banker"
                className="input"
                type="number"
                min={1}
                placeholder="ID банкира"
                value={cBanker}
                onChange={(e) => setCBanker(e.target.value)}
                required
              />
            ) : (
              <p id="adm-c-banker-display" className="field-hint" style={{ marginTop: 0, fontSize: 'var(--text-base)' }}>
                {mePerson ? personLabel(mePerson) : personId ? `ID ${personId}` : '—'}
                {personId ? (
                  <span className="font-mono tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                    {' '}
                    (id {personId})
                  </span>
                ) : null}
              </p>
            )}
          </div>
          <div className="field-row">
            <label className="field-label" htmlFor="adm-c-date">
              Дата документа
            </label>
            <input id="adm-c-date" className="input" type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} required />
          </div>
          <div className="field-row">
            <label className="field-label" htmlFor="adm-c-amount">
              Сумма
            </label>
            <input id="adm-c-amount" className="input" type="number" step="any" value={cAmount} onChange={(e) => setCAmount(e.target.value)} required />
          </div>
          <div className="field-row">
            <label className="field-label" htmlFor="adm-c-rate">
              Ставка, %
            </label>
            <input id="adm-c-rate" className="input" type="number" step="any" min={0} max={100} value={cRate} onChange={(e) => setCRate(e.target.value)} required />
          </div>
          <div className="field-row field-row--inline">
            <button type="button" className="btn btn--primary" onClick={() => onCreateContract()} disabled={submitting}>
              {submitting ? 'Сохранение…' : 'Создать'}
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => setShowContractForm(false)} disabled={submitting}>
              Отмена
            </button>
          </div>
        </div>
      </div>

      <p className="field-hint">
        Участник — все договоры, где он банкир или клиент. Без выбора — полный список. Закрытость — дополнительный отбор.
      </p>
      <div className="field-row field-row--filters" style={{ marginBottom: '1rem' }}>
        <div className="field-row">
          <label className="field-label" htmlFor="adm-f-person">
            Участник
          </label>
          <select
            id="adm-f-person"
            className="input"
            value={fPersonId}
            onChange={(e) => setFPersonId(e.target.value)}
          >
            <option value="">Все договоры</option>
            {sortById(persons ?? []).map((p) => (
              <option key={p.id} value={String(p.id)}>
                {personSelectLabel(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <label className="field-label" htmlFor="adm-f-status">
            Закрытость
          </label>
          <select
            id="adm-f-status"
            className="input"
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value as '' | 'open' | 'closed')}
          >
            <option value="">Все</option>
            <option value="open">Только открытые</option>
            <option value="closed">Только закрытые</option>
          </select>
        </div>
      </div>

      {loading && contracts === null ? (
        <div className="card" aria-hidden>
          <div className="skeleton" style={{ width: '100%', height: '12rem' }} />
        </div>
      ) : contracts?.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">Нет договоров</p>
        </div>
      ) : (
        <div className="table-wrap">
          <p className="table-wrap__hint">Прокрутите таблицу горизонтально на узком экране.</p>
          <table className="data data--tight">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Дата</th>
                <th scope="col">Банкир</th>
                <th scope="col">Клиент</th>
                <th scope="col" className="num">
                  Сумма
                </th>
                <th scope="col" className="num">
                  %
                </th>
                <th scope="col">Закрытие</th>
                <th scope="col" className="cell-actions">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {(contracts ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="font-mono tabular-nums">{r.id}</td>
                  <td>{formatDateIso(r.doc_date)}</td>
                  <td>{contractPersonNameById.get(r.banker_id) ?? '—'}</td>
                  <td>{contractPersonNameById.get(r.client_id) ?? '—'}</td>
                  <td className="num">{formatMoney(r.amount)}</td>
                  <td className="num">{formatPercent(r.interest_rate)}</td>
                  <td>{r.close_date ? formatDateIso(r.close_date) : '—'}</td>
                  <td className="cell-actions">
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => openEditContract(r)} disabled={submitting}>
                      Изменить
                    </button>{' '}
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmContract(r.id)} disabled={submitting}>
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editRow && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={() => {
            if (!editSaving) setEditRow(null)
          }}
        >
          <div
            className="dialog dialog--form dialog--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby={editTitleId}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id={editTitleId} className="dialog__title">
              Договор №{editRow.id}
            </h2>
            <div className="field-grid">
              {role === 'admin' && (
                <>
                  <div className="field-row">
                    <label className="field-label" htmlFor="adm-ed-doc">
                      Дата документа
                    </label>
                    <input id="adm-ed-doc" className="input" type="date" value={editDocDate} onChange={(e) => setEditDocDate(e.target.value)} />
                  </div>
                  <div className="field-row">
                    <label className="field-label" htmlFor="adm-ed-banker">
                      ID банкира
                    </label>
                    <input id="adm-ed-banker" className="input" type="number" min={1} value={editBankerId} onChange={(e) => setEditBankerId(e.target.value)} />
                  </div>
                </>
              )}
              <div className="field-row">
                <label className="field-label" htmlFor="adm-ed-client">
                  ID клиента
                </label>
                <input id="adm-ed-client" className="input" type="number" min={1} value={editClientId} onChange={(e) => setEditClientId(e.target.value)} />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-ed-amount">
                  Сумма (тело)
                </label>
                <input id="adm-ed-amount" className="input" type="number" step="any" min={0} value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-ed-rate">
                  Ставка, % (годовых)
                </label>
                <input id="adm-ed-rate" className="input" type="number" step="any" min={0} value={editRate} onChange={(e) => setEditRate(e.target.value)} />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-ed-close">
                  Дата закрытия
                </label>
                <input id="adm-ed-close" className="input" type="date" value={editCloseDate} onChange={(e) => setEditCloseDate(e.target.value)} />
                <p className="field-hint">Очистите поле и сохраните, чтобы снять дату закрытия.</p>
              </div>
            </div>
            <div className="dialog__actions" style={{ marginTop: 'var(--space-4)' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setEditRow(null)} disabled={editSaving}>
                Отмена
              </button>
              <button type="button" className="btn btn--primary" onClick={() => onSaveEditContract()} disabled={editSaving}>
                {editSaving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmContract !== null}
        title="Удалить договор?"
        message={
          confirmContract !== null
            ? `Договор ${confirmContract} и связанные платежи будут удалены каскадом.`
            : ''
        }
        confirmLabel="Удалить"
        danger
        onCancel={() => setConfirmContract(null)}
        onConfirm={() => {
          if (confirmContract !== null) void onDeleteContract(confirmContract)
        }}
      />
    </>
  )
}
