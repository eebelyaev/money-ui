import { useCallback, useEffect, useId, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../context/ToastContext'
import { formatDateIso, formatMoney, formatPercent } from '../utils/format'

type Tab = 'summary' | 'persons' | 'contracts' | 'payments'

type PaymentRow = {
  id: number
  contract_id?: number
  payer_id: number
  amount: number
  date: string
  comment: string
}

type ClientSummary = {
  client_id: number
  first_name?: string
  last_name?: string
  contracts_count: number
  total_debt: number
}

type Person = {
  id: number
  first_name: string
  last_name: string
  tg_id: number
  tg_login: string
}

type ContractRow = {
  id: number
  client_id: number
  banker_id: number
  doc_date: string
  amount: number
  interest_rate: number
}

export function HomePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const baseId = useId()
  const [tab, setTab] = useState<Tab>('summary')
  const [msg, setMsg] = useState<{ type: 'err'; text: string } | null>(null)

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [confirmPerson, setConfirmPerson] = useState<number | null>(null)
  const [confirmContract, setConfirmContract] = useState<number | null>(null)

  const showErr = useCallback((e: unknown) => {
    const t =
      e && typeof e === 'object' && 'message' in e && typeof (e as Error).message === 'string'
        ? (e as Error).message
        : String(e)
    setMsg({ type: 'err', text: t })
  }, [])

  const [summaryRows, setSummaryRows] = useState<ClientSummary[] | null>(null)
  const [persons, setPersons] = useState<Person[] | null>(null)
  const [contracts, setContracts] = useState<ContractRow[] | null>(null)

  const [pFn, setPfn] = useState('')
  const [pLn, setPln] = useState('')
  const [pTg, setPtg] = useState('')
  const [pLogin, setPlogin] = useState('')

  const [fBanker, setFBanker] = useState('')
  const [fClient, setFClient] = useState('')

  const [showContractForm, setShowContractForm] = useState(false)
  const [cClient, setCClient] = useState('')
  const [cBanker, setCBanker] = useState('')
  const [cDate, setCDate] = useState('')
  const [cAmount, setCAmount] = useState('')
  const [cRate, setCRate] = useState('')

  const [payContractId, setPayContractId] = useState('')
  const [payFrom, setPayFrom] = useState('')
  const [payTo, setPayTo] = useState('')
  const [paymentRows, setPaymentRows] = useState<PaymentRow[] | null>(null)

  const loadSummary = useCallback(async () => {
    setLoading(true)
    try {
      const rows = (await api<ClientSummary[]>('GET', '/clients/summary')) ?? []
      if (!Array.isArray(rows)) {
        showErr('unexpected response')
        return
      }
      setSummaryRows(rows)
    } catch (e) {
      showErr(e)
    } finally {
      setLoading(false)
    }
  }, [showErr])

  const loadPersons = useCallback(async () => {
    setLoading(true)
    try {
      const rows = (await api<Person[]>('GET', '/persons')) ?? []
      if (!Array.isArray(rows)) {
        showErr('unexpected response')
        return
      }
      setPersons(rows)
    } catch (e) {
      showErr(e)
    } finally {
      setLoading(false)
    }
  }, [showErr])

  const contractQuery = useCallback(() => {
    const b = fBanker.trim()
    const c = fClient.trim()
    if (!b && !c) return ''
    if (!b && c) throw new Error('Укажите banker_id вместе с client_id')
    let q = '?banker=' + encodeURIComponent(b)
    if (c) q += '&client=' + encodeURIComponent(c)
    return q
  }, [fBanker, fClient])

  const loadContracts = useCallback(async () => {
    let q = ''
    try {
      q = contractQuery()
    } catch (e) {
      showErr(e)
      return
    }
    setLoading(true)
    try {
      const rows = (await api<ContractRow[]>('GET', '/contracts' + q)) ?? []
      if (!Array.isArray(rows)) {
        showErr('unexpected response')
        return
      }
      setContracts(rows)
    } catch (e) {
      showErr(e)
    } finally {
      setLoading(false)
    }
  }, [contractQuery, showErr])

  useEffect(() => {
    if (tab === 'summary') loadSummary().catch(() => {})
  }, [tab, loadSummary])

  useEffect(() => {
    if (tab === 'persons') loadPersons().catch(() => {})
  }, [tab, loadPersons])

  useEffect(() => {
    if (tab === 'contracts') loadContracts().catch(() => {})
  }, [tab, fBanker, fClient, loadContracts])

  const paymentsListPath = useCallback(() => {
    const cid = parseInt(payContractId.trim(), 10)
    if (!cid || cid < 1) throw new Error('Укажите корректный ID договора')
    const f = payFrom.trim()
    const t = payTo.trim()
    if (!f && !t) return '/contracts/' + cid + '/payments'
    if (f && t)
      return (
        '/contracts/' +
        cid +
        '/payments?from_date=' +
        encodeURIComponent(f) +
        '&to_date=' +
        encodeURIComponent(t)
      )
    throw new Error('Укажите оба поля периода или ни одного')
  }, [payContractId, payFrom, payTo])

  const loadPaymentList = useCallback(async () => {
    let path: string
    try {
      path = paymentsListPath()
    } catch (e) {
      showErr(e)
      return
    }
    setPaymentRows(null)
    setLoading(true)
    try {
      const rows = (await api<PaymentRow[]>('GET', path)) ?? []
      if (!Array.isArray(rows)) {
        showErr('unexpected response')
        return
      }
      setPaymentRows(rows)
    } catch (e) {
      showErr(e)
    } finally {
      setLoading(false)
    }
  }, [paymentsListPath, showErr])

  useEffect(() => {
    setMsg(null)
  }, [tab])

  const onCreatePerson = async () => {
    const first_name = pFn.trim()
    const last_name = pLn.trim()
    const tg_id = parseInt(pTg, 10)
    const tg_login = pLogin.trim()
    setSubmitting(true)
    try {
      await api('POST', '/persons', { first_name, last_name, tg_id, tg_login })
      toast.show('Участник создан')
      await loadPersons()
    } catch (e) {
      showErr(e)
    } finally {
      setSubmitting(false)
    }
  }

  const onDeletePerson = async (id: number) => {
    setSubmitting(true)
    try {
      await api('DELETE', '/persons/' + id)
      toast.show('Участник удалён')
      await loadPersons()
    } catch (e) {
      showErr(e)
    } finally {
      setSubmitting(false)
      setConfirmPerson(null)
    }
  }

  const onCreateContract = async () => {
    const client_id = parseInt(cClient, 10)
    const banker_id = parseInt(cBanker, 10)
    const doc_date = cDate
    const amount = parseFloat(cAmount)
    const interest_rate = parseFloat(cRate)
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

  const tabIds = {
    summary: `${baseId}-tab-summary`,
    persons: `${baseId}-tab-persons`,
    contracts: `${baseId}-tab-contracts`,
    payments: `${baseId}-tab-payments`,
  }
  const panelIds = {
    summary: `${baseId}-panel-summary`,
    persons: `${baseId}-panel-persons`,
    contracts: `${baseId}-panel-contracts`,
    payments: `${baseId}-panel-payments`,
  }

  const tabOrder: Tab[] = ['summary', 'persons', 'contracts', 'payments']

  const onTabsKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const i = tabOrder.indexOf(tab)
    if (i < 0) return
    const next =
      e.key === 'ArrowRight'
        ? tabOrder[(i + 1) % tabOrder.length]
        : tabOrder[(i - 1 + tabOrder.length) % tabOrder.length]
    setTab(next)
    window.requestAnimationFrame(() => {
      const idMap: Record<Tab, string> = {
        summary: tabIds.summary,
        persons: tabIds.persons,
        contracts: tabIds.contracts,
        payments: tabIds.payments,
      }
      document.getElementById(idMap[next])?.focus()
    })
  }

  return (
    <>
      <h1 className="page-title">Главная</h1>
      <p className="page-intro">
        Сводка по клиентам, участники, договоры и платежи. Данные загружаются с сервиса calculations.
      </p>

      <div role="tablist" className="tabs" aria-label="Разделы" onKeyDown={onTabsKeyDown}>
        <button
          type="button"
          role="tab"
          id={tabIds.summary}
          aria-selected={tab === 'summary'}
          aria-controls={panelIds.summary}
          tabIndex={tab === 'summary' ? 0 : -1}
          className="tabs__tab"
          onClick={() => setTab('summary')}
        >
          Сводка клиентов
        </button>
        <button
          type="button"
          role="tab"
          id={tabIds.persons}
          aria-selected={tab === 'persons'}
          aria-controls={panelIds.persons}
          tabIndex={tab === 'persons' ? 0 : -1}
          className="tabs__tab"
          onClick={() => setTab('persons')}
        >
          Участники
        </button>
        <button
          type="button"
          role="tab"
          id={tabIds.contracts}
          aria-selected={tab === 'contracts'}
          aria-controls={panelIds.contracts}
          tabIndex={tab === 'contracts' ? 0 : -1}
          className="tabs__tab"
          onClick={() => setTab('contracts')}
        >
          Договоры
        </button>
        <button
          type="button"
          role="tab"
          id={tabIds.payments}
          aria-selected={tab === 'payments'}
          aria-controls={panelIds.payments}
          tabIndex={tab === 'payments' ? 0 : -1}
          className="tabs__tab"
          onClick={() => setTab('payments')}
        >
          Платежи
        </button>
      </div>

      {msg?.type === 'err' && (
        <div className="alert alert--error alert--persistent" role="alert">
          {msg.text}
          <div className="toolbar" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                if (tab === 'summary') loadSummary().catch(showErr)
                else if (tab === 'persons') loadPersons().catch(showErr)
                else if (tab === 'contracts') loadContracts().catch(showErr)
                else loadPaymentList().catch(showErr)
              }}
            >
              Повторить запрос
            </button>
          </div>
        </div>
      )}

      {tab === 'summary' && (
        <div
          id={panelIds.summary}
          role="tabpanel"
          aria-labelledby={tabIds.summary}
          className="panel loading-panel"
          aria-busy={loading}
        >
          <div className="toolbar">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => loadSummary().catch(showErr)}
              disabled={loading}
            >
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

          {loading && summaryRows === null ? (
            <div className="card" aria-hidden>
              <div className="skeleton" style={{ width: '100%', height: '12rem' }} />
            </div>
          ) : summaryRows?.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon" aria-hidden>
                📊
              </div>
              <p className="empty-state__title">Нет данных</p>
              <p className="empty-state__text">Сводка пуста. Добавьте договоры и участников.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">ID клиента</th>
                    <th scope="col">Имя</th>
                    <th scope="col" className="num">
                      Договоров
                    </th>
                    <th scope="col" className="num">
                      Долг
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(summaryRows ?? []).map((r) => (
                    <tr key={r.client_id}>
                      <td className="font-mono tabular-nums">{r.client_id}</td>
                      <td>{(r.first_name ?? '') + ' ' + (r.last_name ?? '')}</td>
                      <td className="num">{r.contracts_count}</td>
                      <td className="num">{formatMoney(r.total_debt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'persons' && (
        <div
          id={panelIds.persons}
          role="tabpanel"
          aria-labelledby={tabIds.persons}
          className="panel loading-panel"
          aria-busy={loading}
        >
          <div className="toolbar">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => loadPersons().catch(showErr)}
              disabled={loading}
            >
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

          <fieldset className="form-fieldset">
            <legend>Новый участник</legend>
            <div className="field-grid">
              <div className="field-row">
                <label className="field-label" htmlFor="p-fn">
                  Имя
                </label>
                <input
                  id="p-fn"
                  className="input"
                  value={pFn}
                  onChange={(e) => setPfn(e.target.value)}
                  required
                  autoComplete="given-name"
                />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="p-ln">
                  Фамилия
                </label>
                <input
                  id="p-ln"
                  className="input"
                  value={pLn}
                  onChange={(e) => setPln(e.target.value)}
                  required
                  autoComplete="family-name"
                />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="p-tg">
                  Telegram ID
                </label>
                <input
                  id="p-tg"
                  className="input"
                  type="number"
                  inputMode="numeric"
                  value={pTg}
                  onChange={(e) => setPtg(e.target.value)}
                  required
                />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="p-login">
                  Логин Telegram
                </label>
                <input
                  id="p-login"
                  className="input"
                  placeholder="необязательно"
                  value={pLogin}
                  onChange={(e) => setPlogin(e.target.value)}
                  autoComplete="username"
                />
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => onCreatePerson()}
                  disabled={submitting}
                >
                  {submitting ? 'Сохранение…' : 'Создать'}
                </button>
              </div>
            </div>
          </fieldset>

          {loading && persons === null ? (
            <div className="card" aria-hidden>
              <div className="skeleton" style={{ width: '100%', height: '10rem' }} />
            </div>
          ) : persons?.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon" aria-hidden>
                👤
              </div>
              <p className="empty-state__title">Нет участников</p>
              <p className="empty-state__text">Заполните форму выше, чтобы добавить первого участника.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Имя</th>
                    <th scope="col" className="num">
                      Telegram ID
                    </th>
                    <th scope="col">Логин</th>
                    <th scope="col" className="cell-actions">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(persons ?? []).map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono tabular-nums">{r.id}</td>
                      <td>
                        {r.first_name} {r.last_name}
                      </td>
                      <td className="num">{r.tg_id}</td>
                      <td>{r.tg_login}</td>
                      <td className="cell-actions">
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => setConfirmPerson(r.id)}
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
        </div>
      )}

      {tab === 'contracts' && (
        <div
          id={panelIds.contracts}
          role="tabpanel"
          aria-labelledby={tabIds.contracts}
          className="panel loading-panel"
          aria-busy={loading}
        >
          <div className="toolbar">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => loadContracts().catch(showErr)}
              disabled={loading}
            >
              {loading ? (
                <span className="loading-inline">
                  <span className="spinner" aria-hidden />
                  Обновление…
                </span>
              ) : (
                'Обновить список'
              )}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setShowContractForm(true)}
              disabled={loading}
            >
              Создать договор
            </button>
          </div>

          <div className={showContractForm ? 'card' : 'hidden'}>
            <h2 className="section-title">Новый договор</h2>
            <div className="field-grid">
              <div className="field-row">
                <label className="field-label" htmlFor="c-client">
                  ID клиента
                </label>
                <input
                  id="c-client"
                  className="input"
                  type="number"
                  min={1}
                  value={cClient}
                  onChange={(e) => setCClient(e.target.value)}
                  required
                />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="c-banker">
                  ID банкира
                </label>
                <input
                  id="c-banker"
                  className="input"
                  type="number"
                  min={1}
                  value={cBanker}
                  onChange={(e) => setCBanker(e.target.value)}
                  required
                />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="c-date">
                  Дата документа
                </label>
                <input
                  id="c-date"
                  className="input"
                  type="date"
                  value={cDate}
                  onChange={(e) => setCDate(e.target.value)}
                  required
                />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="c-amount">
                  Сумма
                </label>
                <input
                  id="c-amount"
                  className="input"
                  type="number"
                  step="any"
                  value={cAmount}
                  onChange={(e) => setCAmount(e.target.value)}
                  required
                />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="c-rate">
                  Ставка, %
                </label>
                <input
                  id="c-rate"
                  className="input"
                  type="number"
                  step="any"
                  min={0}
                  max={100}
                  value={cRate}
                  onChange={(e) => setCRate(e.target.value)}
                  required
                />
              </div>
              <div className="field-row field-row--inline">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => onCreateContract()}
                  disabled={submitting}
                >
                  {submitting ? 'Сохранение…' : 'Создать'}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setShowContractForm(false)}
                  disabled={submitting}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>

          <p className="field-hint">
            Фильтр списка (по желанию): нельзя указать только клиента без банкира — API вернёт ошибку.
          </p>
          <div className="field-row field-row--filters" style={{ marginBottom: '1rem' }}>
            <div className="field-row">
              <label className="field-label" htmlFor="f-banker">
                ID банкира
              </label>
              <input
                id="f-banker"
                className="input"
                type="number"
                min={1}
                placeholder="все"
                value={fBanker}
                onChange={(e) => setFBanker(e.target.value)}
              />
            </div>
            <div className="field-row">
              <label className="field-label" htmlFor="f-client">
                ID клиента
              </label>
              <input
                id="f-client"
                className="input"
                type="number"
                min={1}
                placeholder="вместе с банкиром"
                value={fClient}
                onChange={(e) => setFClient(e.target.value)}
              />
            </div>
          </div>

          {loading && contracts === null ? (
            <div className="card" aria-hidden>
              <div className="skeleton" style={{ width: '100%', height: '12rem' }} />
            </div>
          ) : contracts?.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon" aria-hidden>
                📄
              </div>
              <p className="empty-state__title">Нет договоров</p>
              <p className="empty-state__text">
                Создайте договор кнопкой выше или снимите фильтр по банкиру/клиенту.
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <p className="table-wrap__hint">Прокрутите таблицу горизонтально на узком экране.</p>
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col" className="num">
                      Клиент
                    </th>
                    <th scope="col" className="num">
                      Банкир
                    </th>
                    <th scope="col">Дата</th>
                    <th scope="col" className="num">
                      Сумма
                    </th>
                    <th scope="col" className="num">
                      %
                    </th>
                    <th scope="col" className="cell-actions">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(contracts ?? []).map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono tabular-nums">{r.id}</td>
                      <td className="num">{r.client_id}</td>
                      <td className="num">{r.banker_id}</td>
                      <td>{formatDateIso(r.doc_date)}</td>
                      <td className="num">{formatMoney(r.amount)}</td>
                      <td className="num">{formatPercent(r.interest_rate)}</td>
                      <td className="cell-actions">
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          onClick={() => navigate('/contracts/' + r.id)}
                        >
                          Открыть
                        </button>{' '}
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => setConfirmContract(r.id)}
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
        </div>
      )}

      {tab === 'payments' && (
        <div
          id={panelIds.payments}
          role="tabpanel"
          aria-labelledby={tabIds.payments}
          className="panel loading-panel"
          aria-busy={loading}
        >
          <p className="field-hint">
            Платежи привязаны к договору. Укажите ID договора; период — необязательно (заполните оба поля дат или
            оставьте пустыми для всех платежей по договору). Создание, изменение и удаление — в карточке договора.
          </p>
          <div className="field-row field-row--filters" style={{ marginBottom: '1rem' }}>
            <div className="field-row">
              <label className="field-label" htmlFor="home-pay-cid">
                ID договора
              </label>
              <input
                id="home-pay-cid"
                className="input"
                type="number"
                min={1}
                value={payContractId}
                onChange={(e) => setPayContractId(e.target.value)}
              />
            </div>
            <div className="field-row">
              <label className="field-label" htmlFor="home-pay-from">
                С даты
              </label>
              <input
                id="home-pay-from"
                className="input"
                type="date"
                value={payFrom}
                onChange={(e) => setPayFrom(e.target.value)}
              />
            </div>
            <div className="field-row">
              <label className="field-label" htmlFor="home-pay-to">
                По дату
              </label>
              <input
                id="home-pay-to"
                className="input"
                type="date"
                value={payTo}
                onChange={(e) => setPayTo(e.target.value)}
              />
            </div>
          </div>
          <div className="toolbar">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => loadPaymentList().catch(showErr)}
              disabled={loading}
            >
              {loading ? (
                <span className="loading-inline">
                  <span className="spinner" aria-hidden />
                  Загрузка…
                </span>
              ) : (
                'Загрузить список'
              )}
            </button>
            {(() => {
              const cid = parseInt(payContractId.trim(), 10)
              if (!cid || cid < 1) return null
              return (
                <button type="button" className="btn btn--primary" onClick={() => navigate('/contracts/' + cid)}>
                  Открыть договор (платежи)
                </button>
              )
            })()}
          </div>

          {loading && paymentRows === null ? (
            <div className="card" aria-hidden style={{ marginTop: '1rem' }}>
              <div className="skeleton" style={{ width: '100%', height: '10rem' }} />
            </div>
          ) : paymentRows !== null && paymentRows.length === 0 ? (
            <div className="empty-state" style={{ marginTop: '1rem' }}>
              <div className="empty-state__icon" aria-hidden>
                💳
              </div>
              <p className="empty-state__title">Нет платежей</p>
              <p className="empty-state__text">За выбранные условия платежей нет. Смените период или добавьте платёж в договоре.</p>
            </div>
          ) : paymentRows !== null && paymentRows.length > 0 ? (
            <div className="table-wrap" style={{ marginTop: '1rem' }}>
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
                  </tr>
                </thead>
                <tbody>
                  {paymentRows.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono tabular-nums">{r.id}</td>
                      <td className="num">{r.payer_id}</td>
                      <td className="num">{formatMoney(r.amount)}</td>
                      <td>{formatDateIso(r.date)}</td>
                      <td>{r.comment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="field-hint" style={{ marginTop: '1rem' }}>
              Введите ID договора и нажмите «Загрузить список».
            </p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmPerson !== null}
        title="Удалить участника?"
        message={
          confirmPerson !== null
            ? `Участник с id ${confirmPerson} будет удалён без восстановления.`
            : ''
        }
        confirmLabel="Удалить"
        danger
        onCancel={() => setConfirmPerson(null)}
        onConfirm={() => {
          if (confirmPerson !== null) void onDeletePerson(confirmPerson)
        }}
      />

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
