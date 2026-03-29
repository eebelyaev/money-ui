const LOCALE = 'ru-RU'

/** Как в истории остатков / legacy money: округление вверх до 10 ₽. */
export function roundToNearestTen(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.ceil(n / 10) * 10
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/** Суммы долга/остатков в UI — с тем же округлением, что и строки истории (до 10 ₽). */
export function formatMoneyRounded(value: number): string {
  return formatMoney(roundToNearestTen(value))
}

/** API хранит долю (напр. 0.12); в UI показываем проценты (12,00 %). */
export function formatPercent(value: number): string {
  return (
    new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value * 100) + ' %'
  )
}

/** Дата из API (префикс YYYY-MM-DD или полный ISO): отображение «01.02.2026». */
export function formatDateIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim())
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}
