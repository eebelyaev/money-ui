import type { ContractsHistoryPeriod } from '../utils/contractsHistory'

const OPTIONS: { value: ContractsHistoryPeriod; label: string }[] = [
  { value: '3m', label: '3 месяца' },
  { value: '6m', label: '6 месяцев' },
  { value: '1y', label: '1 год' },
  { value: 'all', label: 'весь период' },
]

type Props = {
  value: ContractsHistoryPeriod
  onChange: (v: ContractsHistoryPeriod) => void
  /** Для связи с подписью в тулбаре */
  ariaLabelledBy?: string
}

export function ContractsHistoryPeriodToggle({ value, onChange, ariaLabelledBy }: Props) {
  return (
    <div
      className="contracts-history-period-toggle"
      role="radiogroup"
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabelledBy ? undefined : 'Период истории остатков'}
    >
      {OPTIONS.map(({ value: v, label }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={
            'contracts-history-period-toggle__btn' +
            (value === v ? ' contracts-history-period-toggle__btn--active' : '')
          }
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
