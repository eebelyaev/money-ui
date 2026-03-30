/**
 * Развёртка снимков остатков в строки как в Telegram (money: PrepareContractsHistory).
 * На одну запись снимка — до трёх строк: начисление на тело, выдача, платёж.
 */

import { roundToNearestTen } from './format'

export const CLOSE_TO_ZERO = 1e-6

const DEPTH_HISTORY_IN_YEARS = 2

export type HistoryRowType = 'Accrued' | 'Issued' | 'Payment'

/** Строка как в view.HistoryBalance (money): дата, тип, сумма операции, остаток тела; суммы как в TG — до 10 ₽. */
export type ContractsHistoryRow = {
  docDateYmd: string
  type: HistoryRowType
  amount: number
  balance: number
}

/** Окно отображения строк истории: последние 3/6 мес, 1 год, либо весь период (без 2-летнего лимита как в TG). */
export type ContractsHistoryPeriod = '3m' | '6m' | '1y' | 'all'

export type SnapshotForHistory = {
  doc_date: string
  principal: number
  principal_issued: number
  total_paid: number
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

/** Текущий календарный день (локально), без времени — для глубины истории как «сегодня». */
export function startOfToday(d: Date = new Date()): Date {
  return stripTime(d)
}

/** Локальная полночь для YYYY-MM-DD */
export function parseYmdLocal(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.trim())
  if (!m) return new Date(NaN)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0)
}

function makeDate(y: number, month1to12: number, day: number): Date {
  return new Date(y, month1to12 - 1, day, 0, 0, 0, 0)
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  x.setDate(x.getDate() + days)
  return x
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** YYYY-MM-DD для даты «сегодня минус N месяцев/год» (локальный календарь). */
function cutoffYmdFromCur(curDate: Date, period: Exclude<ContractsHistoryPeriod, 'all'>): string {
  const d = stripTime(new Date(curDate.getTime()))
  if (period === '3m') {
    d.setMonth(d.getMonth() - 3)
  } else if (period === '6m') {
    d.setMonth(d.getMonth() - 6)
  } else {
    d.setFullYear(d.getFullYear() - 1)
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function filterRowsByDisplayPeriod(
  rows: ContractsHistoryRow[],
  curDate: Date,
  period: ContractsHistoryPeriod,
): ContractsHistoryRow[] {
  if (period === 'all') return rows
  const cut = cutoffYmdFromCur(curDate, period)
  return rows.filter((r) => r.docDateYmd >= cut)
}

class ContractDateChecker {
  constructor(private readonly contractDate: Date) {}

  startPeriodDate(d: Date): Date {
    const ch = stripTime(this.contractDate)
    const day = stripTime(d)
    if (ch.getTime() > day.getTime()) {
      throw new Error('Contract date is greater than date')
    }

    const contractDay = ch.getDate()
    const dDay = day.getDate()

    if (contractDay <= dDay) {
      return makeDate(day.getFullYear(), day.getMonth() + 1, contractDay)
    }

    const dNext = addDays(day, 1)
    if (day.getMonth() !== dNext.getMonth()) {
      return day
    }

    const d0 = addDays(day, -day.getDate())
    if (d0.getDate() <= contractDay) {
      return d0
    }

    return makeDate(d0.getFullYear(), d0.getMonth() + 1, contractDay)
  }

  isStartPeriodDate(d: Date): boolean {
    return sameCalendarDay(this.startPeriodDate(d), stripTime(d))
  }

  isBalanceHistoryVisible(curDate: Date, bhDate: Date): boolean {
    const cur = stripTime(curDate)
    const bh = stripTime(bhDate)
    const ch = stripTime(this.contractDate)
    if (bh.getTime() > cur.getTime() || ch.getTime() > bh.getTime()) {
      throw new Error('Wrong dates')
    }

    const yd = cur.getFullYear() - bh.getFullYear()
    const hidden =
      yd > DEPTH_HISTORY_IN_YEARS ||
      (yd === DEPTH_HISTORY_IN_YEARS && cur.getMonth() >= bh.getMonth())

    return sameCalendarDay(ch, bh) || !hidden
  }
}

/**
 * @param curDate «Сегодня» для фильтра глубины истории (как в money — дата просмотра).
 * @param contractDocYmd дата договора YYYY-MM-DD
 * @param snapshots снимки по договору, поля как у API money-ui / balance_history в money
 * @param period «3/6 мес», «1 год» обрезают строки по дате; «весь период» отключает 2-летний лимит TG и не режет по дате.
 */
export function prepareContractsHistory(
  curDate: Date,
  contractDocYmd: string,
  snapshots: SnapshotForHistory[],
  period: ContractsHistoryPeriod = '3m',
): ContractsHistoryRow[] {
  if (!snapshots.length) return []

  const sorted = [...snapshots].sort((a, b) => a.doc_date.localeCompare(b.doc_date))
  const checker = new ContractDateChecker(parseYmdLocal(contractDocYmd))
  const cur = stripTime(curDate)

  const out: ContractsHistoryRow[] = []
  let lastPrincipalBalance = 0

  for (const s of sorted) {
    const docYmd = s.doc_date.trim().slice(0, 10)
    const bhDate = parseYmdLocal(docYmd)

    const principalBalance = s.principal
    const issuedLoan = s.principal_issued
    const payment = s.total_paid

    if (period !== 'all' && !checker.isBalanceHistoryVisible(cur, bhDate)) {
      lastPrincipalBalance = principalBalance
      continue
    }

    const startBalance = principalBalance - issuedLoan + payment

    if (
      checker.isStartPeriodDate(bhDate) &&
      startBalance - lastPrincipalBalance > CLOSE_TO_ZERO
    ) {
      const amount = roundToNearestTen(startBalance - lastPrincipalBalance)
      const balance = roundToNearestTen(startBalance)
      out.push({ docDateYmd: docYmd, type: 'Accrued', amount, balance })
    }

    if (issuedLoan > CLOSE_TO_ZERO) {
      const amount = roundToNearestTen(issuedLoan)
      const balance = roundToNearestTen(startBalance + issuedLoan)
      out.push({ docDateYmd: docYmd, type: 'Issued', amount, balance })
    }

    if (payment > CLOSE_TO_ZERO) {
      const amount = roundToNearestTen(payment)
      const balance = roundToNearestTen(principalBalance)
      out.push({ docDateYmd: docYmd, type: 'Payment', amount, balance })
    }

    lastPrincipalBalance = principalBalance
  }

  return filterRowsByDisplayPeriod(out, curDate, period)
}

export const historyTypeEmoji: Record<HistoryRowType, string> = {
  Accrued: '🔺',
  Issued: '🔸',
  Payment: '🔹',
}

export const historyTypeLabel: Record<HistoryRowType, string> = {
  Accrued: 'Начисление',
  Issued: 'Выдача',
  Payment: 'Платёж',
}

/** Визуальный вариант знака у суммы: направление и тип операции. */
export type HistoryAmountSignVariant = 'minus-payment' | 'plus-accrued' | 'plus-issued'

export function historyAmountSignVariant(type: HistoryRowType): HistoryAmountSignVariant {
  switch (type) {
    case 'Payment':
      return 'minus-payment'
    case 'Accrued':
      return 'plus-accrued'
    case 'Issued':
      return 'plus-issued'
  }
}
