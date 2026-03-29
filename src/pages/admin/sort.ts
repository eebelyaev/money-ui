/** Стабильная сортировка копии массива по возрастанию id (справочники в админке). */
export function sortById<T extends { id: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.id - b.id)
}

/** Снимки без поля id — порядок по дате документа. */
export function sortSnapshotsByDocDate<T extends { doc_date: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.doc_date.localeCompare(b.doc_date))
}
