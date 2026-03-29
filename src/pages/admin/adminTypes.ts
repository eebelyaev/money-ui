/** Типы сущностей calculations для админских вкладок */

export const PERSON_ROLES = ['banker', 'client', 'admin'] as const
export type PersonRole = (typeof PERSON_ROLES)[number]

export type AdminPerson = {
  id: number
  first_name: string
  last_name: string
  tg_id: number
  tg_login: string
  /** Телефон для входа (в БД person.login). */
  phone?: string
  /** Логин без телефона (в БД person.username). */
  username?: string
  /** Роли (для banker/admin в GET /persons). */
  roles?: string[]
}

export type AdminContractRow = {
  id: number
  client_id: number
  banker_id: number
  doc_date: string
  amount: number
  interest_rate: number
  end_date?: string | null
  close_date?: string | null
}

export type AdminPaymentRow = {
  id: number
  contract_id: number
  payer_id: number
  amount: number
  date: string
  comment: string
}
