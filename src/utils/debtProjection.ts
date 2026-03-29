/** Ставка из API: доля (0.12) или проценты (12). */
export function annualRateDecimal(rate: number): number {
  if (!Number.isFinite(rate) || rate < 0) return 0
  return rate > 1 ? rate / 100 : rate
}

function utcMidnightYmd(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.trim())
  if (!m) return NaN
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** Календарных дней от даты снимка до указанной даты (неотрицательно). Снимок за день D; доначисление — за дни после D до «сегодня». */
export function calendarDaysFromSnapshotToDate(snapshotYmd: string, endYmd: string): number {
  const a = utcMidnightYmd(snapshotYmd)
  const b = utcMidnightYmd(endYmd)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.round((b - a) / 86400000))
}

export function localTodayYmd(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Остаток после последнего снимка: к процентам на дату снимка добавляется простое начисление на тело
 * за календарные дни до endYmd (включительно по дням после даты снимка).
 */
export function projectDebtAfterLastSnapshot(input: {
  principal: number
  interestBalance: number
  annualRateDecimal: number
  lastSnapshotYmd: string
  endYmd: string
}): {
  principal: number
  interest: number
  total: number
  extraInterest: number
  accrualDays: number
} {
  const { principal, interestBalance, annualRateDecimal: rate, lastSnapshotYmd, endYmd } = input
  const accrualDays = calendarDaysFromSnapshotToDate(lastSnapshotYmd, endYmd)
  const extraInterest = principal * (rate / 365) * accrualDays
  const interest = interestBalance + extraInterest
  return {
    principal,
    interest,
    total: principal + interest,
    extraInterest,
    accrualDays,
  }
}
