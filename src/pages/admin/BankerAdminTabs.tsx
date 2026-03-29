import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { AdminContractsTab } from './AdminContractsTab'
import { AdminPaymentsTab } from './AdminPaymentsTab'
import { AdminPersonsTab } from './AdminPersonsTab'

type Tab = 'persons' | 'contracts' | 'payments'

export function BankerAdminTabs() {
  const baseId = useId()
  const [tab, setTab] = useState<Tab>('persons')
  const [msg, setMsg] = useState<{ type: 'err'; text: string } | null>(null)

  const showErr = (e: unknown) => {
    const t =
      e && typeof e === 'object' && 'message' in e && typeof (e as Error).message === 'string'
        ? (e as Error).message
        : String(e)
    setMsg({ type: 'err', text: t })
  }

  useEffect(() => {
    setMsg(null)
  }, [tab])

  const tabIds = {
    persons: `${baseId}-tab-persons`,
    contracts: `${baseId}-tab-contracts`,
    payments: `${baseId}-tab-payments`,
  }
  const panelIds = {
    persons: `${baseId}-panel-persons`,
    contracts: `${baseId}-panel-contracts`,
    payments: `${baseId}-panel-payments`,
  }

  const tabOrder: Tab[] = ['persons', 'contracts', 'payments']

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
        persons: tabIds.persons,
        contracts: tabIds.contracts,
        payments: tabIds.payments,
      }
      document.getElementById(idMap[next])?.focus()
    })
  }

  return (
    <>
      <section className="banker-admin-tabs">
        <div role="tablist" className="tabs" aria-label="Разделы" onKeyDown={onTabsKeyDown}>
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
            persons
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
            contracts
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
            payments
          </button>
        </div>

        {msg?.type === 'err' && (
          <div className="alert alert--error alert--persistent" role="alert">
            {msg.text}
          </div>
        )}

        {tab === 'persons' && (
          <div id={panelIds.persons} role="tabpanel" aria-labelledby={tabIds.persons} className="panel loading-panel">
            <AdminPersonsTab showErr={showErr} />
          </div>
        )}

        {tab === 'contracts' && (
          <div id={panelIds.contracts} role="tabpanel" aria-labelledby={tabIds.contracts} className="panel loading-panel">
            <AdminContractsTab showErr={showErr} />
          </div>
        )}

        {tab === 'payments' && (
          <div id={panelIds.payments} role="tabpanel" aria-labelledby={tabIds.payments} className="panel loading-panel">
            <AdminPaymentsTab showErr={showErr} />
          </div>
        )}
      </section>
    </>
  )
}
