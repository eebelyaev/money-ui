/** Снимок остатков по договору (GET /contracts/:id/snapshots). */
export type SnapshotRow = {
  doc_date: string
  principal: number
  interest: number
  principal_issued: number
  accrued_interest: number
  total_paid: number
}
