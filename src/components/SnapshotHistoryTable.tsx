import { useId, useMemo, useState } from 'react'
import type { SnapshotRow } from '../types/snapshot'
import type { ContractsHistoryPeriod } from '../utils/contractsHistory'
import {
  historyAmountSignVariant,
  historyTypeEmoji,
  historyTypeLabel,
  prepareContractsHistory,
  startOfToday,
} from '../utils/contractsHistory'
import { formatDateIso, formatMoney } from '../utils/format'
import { ContractsHistoryPeriodToggle } from './ContractsHistoryPeriodToggle'

type Props = {
  contractDocYmd: string
  snapshots: SnapshotRow[] | null | undefined
  period?: ContractsHistoryPeriod
  onPeriodChange?: (p: ContractsHistoryPeriod) => void
  /** false — переключатель периода рендерится снаружи (тулбар карточки) */
  showPeriodToggle?: boolean
}

export function SnapshotHistoryTable({
  contractDocYmd,
  snapshots,
  period: periodProp,
  onPeriodChange,
  showPeriodToggle = true,
}: Props) {
  const periodLabelId = useId()
  const isControlled = periodProp !== undefined && onPeriodChange !== undefined
  const [internalPeriod, setInternalPeriod] = useState<ContractsHistoryPeriod>('3m')
  const period = isControlled ? periodProp : internalPeriod
  const setPeriod = isControlled ? onPeriodChange : setInternalPeriod

  const rows = useMemo(() => {
    if (!snapshots?.length) return []
    return prepareContractsHistory(startOfToday(), contractDocYmd, snapshots, period)
  }, [contractDocYmd, snapshots, period])

  if (!snapshots?.length) {
    return null
  }

  if (rows.length === 0) {
    return (
      <>
        {showPeriodToggle ? (
          <div className="contracts-history-period-wrap">
            <span className="contracts-history-period-wrap__label" id={periodLabelId}>
              Период
            </span>
            <ContractsHistoryPeriodToggle
              value={period}
              onChange={setPeriod}
              ariaLabelledBy={periodLabelId}
            />
          </div>
        ) : null}
        <p className="field-hint">
          {period === 'all'
            ? 'Нет строк для отображения (возможно, снимки за пределами окна истории, как в Telegram-боте).'
            : 'В выбранном периоде нет операций. Попробуйте другой период или «весь период».'}
        </p>
      </>
    )
  }

  return (
    <>
      {showPeriodToggle ? (
        <div className="contracts-history-period-wrap">
          <span className="contracts-history-period-wrap__label" id={periodLabelId}>
            Период
          </span>
          <ContractsHistoryPeriodToggle value={period} onChange={setPeriod} ariaLabelledBy={periodLabelId} />
        </div>
      ) : null}
      <div className="table-wrap">
      <table className="data contracts-history-table">
        <thead>
          <tr>
            <th scope="col">Дата</th>
            <th scope="col">Операция</th>
            <th scope="col" className="contracts-history-col-dir">
              <abbr title="Направление движения по телу">Напр.</abbr>
            </th>
            <th scope="col" className="num">
              Сумма
            </th>
            <th scope="col" className="num">
              Остаток тела
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const signVariant = historyAmountSignVariant(row.type)
            const rowTone =
              signVariant === 'minus-payment'
                ? 'decrease'
                : signVariant === 'plus-accrued'
                  ? 'accrued'
                  : 'increase'
            const signLabel =
              signVariant === 'minus-payment'
                ? 'Уменьшение долга (платёж)'
                : signVariant === 'plus-accrued'
                  ? 'Увеличение (начисление на тело)'
                  : 'Увеличение (выдача)'
            const dirGlyph =
              signVariant === 'minus-payment' ? '↓' : signVariant === 'plus-accrued' ? '+' : '↑'
            return (
            <tr
              key={`${row.docDateYmd}-${row.type}-${i}`}
              className={'contracts-history-row contracts-history-row--' + rowTone}
            >
              <td>{formatDateIso(row.docDateYmd)}</td>
              <td>
                <span className="contracts-history-table__icon" aria-hidden title={historyTypeLabel[row.type]}>
                  {historyTypeEmoji[row.type]}
                </span>{' '}
                {historyTypeLabel[row.type]}
              </td>
              <td className="contracts-history-col-dir">
                <span className="contracts-history-dir-glyph" title={signLabel} aria-label={signLabel}>
                  {dirGlyph}
                </span>
              </td>
              <td className="num">{formatMoney(row.amount)}</td>
              <td className="num">{formatMoney(row.balance)}</td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    </>
  )
}
