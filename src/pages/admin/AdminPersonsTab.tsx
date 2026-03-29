import { useCallback, useEffect, useId, useState } from 'react'
import { api } from '../../api/client'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useToast } from '../../context/ToastContext'
import { PERSON_ROLES, type AdminPerson, type PersonRole } from './adminTypes'
import { sortById } from './sort'

type Props = {
  showErr: (e: unknown) => void
}

type RoleFlags = Record<PersonRole, boolean>

function emptyRoleFlags(): RoleFlags {
  return { banker: false, client: false, admin: false }
}

function defaultCreateRoleFlags(): RoleFlags {
  return { banker: true, client: false, admin: false }
}

function roleLabel(r: PersonRole): string {
  switch (r) {
    case 'banker':
      return 'Банкир'
    case 'client':
      return 'Клиент'
    case 'admin':
      return 'Админ'
  }
}

function flagsToRoles(f: RoleFlags): string[] {
  return PERSON_ROLES.filter((r) => f[r])
}

function rolesToFlags(roles: string[] | undefined): RoleFlags {
  const s = new Set((roles ?? []).map((x) => x.trim().toLowerCase()))
  const out = emptyRoleFlags()
  for (const r of PERSON_ROLES) {
    if (s.has(r)) {
      out[r] = true
    }
  }
  return out
}

/** Старый API отдавал сырой SQL; новый — 409 с текстом на русском. */
function personDeleteFkMessage(err: unknown): string | null {
  const m =
    err && typeof err === 'object' && 'message' in err && typeof (err as Error).message === 'string'
      ? (err as Error).message
      : String(err)
  if (/23503|fk_contract|fk_payment|violates foreign key/i.test(m)) {
    return 'Нельзя удалить участника: есть связанные договоры (клиент/банкир) или платежи (плательщик). Сначала удалите или измените их.'
  }
  return null
}

export function AdminPersonsTab({ showErr }: Props) {
  const toast = useToast()
  const createTitleId = useId()
  const editTitleId = useId()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [persons, setPersons] = useState<AdminPerson[] | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [pFn, setPfn] = useState('')
  const [pLn, setPln] = useState('')
  const [pTg, setPtg] = useState('')
  const [pTgLogin, setPTgLogin] = useState('')
  const [pAccPhone, setPAccPhone] = useState('')
  const [pAccUsername, setPAccUsername] = useState('')
  const [pAccPassword, setPAccPassword] = useState('')
  const [createRoleFlags, setCreateRoleFlags] = useState<RoleFlags>(() => defaultCreateRoleFlags())

  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [editRow, setEditRow] = useState<AdminPerson | null>(null)
  const [editFn, setEditFn] = useState('')
  const [editLn, setEditLn] = useState('')
  const [editTg, setEditTg] = useState('')
  const [editTgLogin, setEditTgLogin] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editNewPassword, setEditNewPassword] = useState('')
  const [editRoleFlags, setEditRoleFlags] = useState<RoleFlags>(() => emptyRoleFlags())

  const loadPersons = useCallback(async () => {
    setLoading(true)
    try {
      const rows = (await api<AdminPerson[]>('GET', '/persons')) ?? []
      if (!Array.isArray(rows)) {
        showErr('unexpected response')
        return
      }
      setPersons(sortById(rows))
    } catch (e) {
      showErr(e)
    } finally {
      setLoading(false)
    }
  }, [showErr])

  useEffect(() => {
    void loadPersons()
  }, [loadPersons])

  const openCreate = () => {
    setPfn('')
    setPln('')
    setPtg('')
    setPTgLogin('')
    setPAccPhone('')
    setPAccUsername('')
    setPAccPassword('')
    setCreateRoleFlags(defaultCreateRoleFlags())
    setCreateOpen(true)
  }

  const closeCreate = () => {
    if (!submitting) setCreateOpen(false)
  }

  const onCreate = async () => {
    const first_name = pFn.trim()
    const last_name = pLn.trim()
    const tg_id = parseInt(pTg, 10)
    const tg_login = pTgLogin.trim()
    const accPhone = pAccPhone.trim()
    const accUser = pAccUsername.trim()
    const accPwd = pAccPassword
    const roles = flagsToRoles(createRoleFlags)
    if (accPwd && !accPhone && !accUser) {
      showErr(new Error('Для пароля укажите телефон и/или логин (username)'))
      return
    }
    if (accPwd && roles.length === 0) {
      showErr(new Error('Для пароля укажите роли через запятую (banker, client, admin)'))
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { first_name, last_name, tg_id, tg_login }
      if (accPhone) {
        body.phone = accPhone
      }
      if (accUser) {
        body.username = accUser
      }
      if (accPwd) {
        body.password = accPwd
        body.roles = roles
      }
      await api('POST', '/persons', body)
      toast.show('Участник создан')
      setPfn('')
      setPln('')
      setPtg('')
      setPTgLogin('')
      setPAccPhone('')
      setPAccUsername('')
      setPAccPassword('')
      setCreateRoleFlags(defaultCreateRoleFlags())
      setCreateOpen(false)
      await loadPersons()
    } catch (e) {
      showErr(e)
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = async (id: number) => {
    setSubmitting(true)
    try {
      await api('DELETE', '/persons/' + id)
      toast.show('Участник удалён')
      await loadPersons()
    } catch (e) {
      const friendly = personDeleteFkMessage(e)
      showErr(friendly ? new Error(friendly) : e)
    } finally {
      setSubmitting(false)
      setConfirmId(null)
    }
  }

  const openEdit = (r: AdminPerson) => {
    setEditRow(r)
    setEditFn(r.first_name)
    setEditLn(r.last_name)
    setEditTg(String(r.tg_id))
    setEditTgLogin(r.tg_login ?? '')
    setEditPhone(r.phone?.trim() ? r.phone : '')
    setEditUsername(r.username?.trim() ? r.username : '')
    setEditNewPassword('')
    setEditRoleFlags(rolesToFlags(r.roles))
  }

  const onSaveEdit = async () => {
    if (!editRow) return
    const tg_id = parseInt(editTg, 10)
    const roles = flagsToRoles(editRoleFlags)
    if (editNewPassword.trim() && !editPhone.trim() && !editUsername.trim()) {
      showErr(new Error('Для нового пароля укажите телефон и/или логин (username)'))
      return
    }
    if (editNewPassword.trim() && roles.length === 0) {
      showErr(new Error('Для пароля отметьте хотя бы одну роль'))
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        id: editRow.id,
        first_name: editFn.trim(),
        last_name: editLn.trim(),
        tg_id,
        tg_login: editTgLogin.trim(),
        phone: editPhone.trim(),
        username: editUsername.trim(),
        roles,
      }
      if (editNewPassword.trim()) {
        body.password = editNewPassword.trim()
      }
      await api('PATCH', '/persons/' + editRow.id, body)
      toast.show('Сохранено')
      setEditRow(null)
      await loadPersons()
    } catch (e) {
      showErr(e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="toolbar">
        <button type="button" className="btn btn--primary" onClick={() => openCreate()} disabled={submitting}>
          Новый участник
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => loadPersons()} disabled={loading}>
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

      {createOpen && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={() => {
            closeCreate()
          }}
        >
          <div
            className="dialog dialog--form"
            role="dialog"
            aria-modal="true"
            aria-labelledby={createTitleId}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id={createTitleId} className="dialog__title">
              Новый участник
            </h2>
            <form
              className="field-grid"
              onSubmit={(e) => {
                e.preventDefault()
                void onCreate()
              }}
            >
              <div className="field-row">
                <label className="field-label" htmlFor="adm-p-fn">
                  Имя
                </label>
                <input id="adm-p-fn" className="input" value={pFn} onChange={(e) => setPfn(e.target.value)} required autoFocus />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-p-ln">
                  Фамилия
                </label>
                <input id="adm-p-ln" className="input" value={pLn} onChange={(e) => setPln(e.target.value)} required />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-p-tg">
                  Telegram ID
                </label>
                <input
                  id="adm-p-tg"
                  className="input"
                  type="number"
                  inputMode="numeric"
                  value={pTg}
                  onChange={(e) => setPtg(e.target.value)}
                  required
                />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-p-tglogin">
                  Логин Telegram
                </label>
                <input
                  id="adm-p-tglogin"
                  className="input"
                  placeholder="необязательно"
                  value={pTgLogin}
                  onChange={(e) => setPTgLogin(e.target.value)}
                />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-p-phone">
                  Телефон (вход)
                </label>
                <input
                  id="adm-p-phone"
                  className="input"
                  type="tel"
                  inputMode="tel"
                  placeholder="+7 …"
                  autoComplete="tel"
                  value={pAccPhone}
                  onChange={(e) => setPAccPhone(e.target.value)}
                />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-p-username">
                  Логин (username)
                </label>
                <input
                  id="adm-p-username"
                  className="input"
                  placeholder="необязательно, если есть телефон"
                  autoComplete="off"
                  value={pAccUsername}
                  onChange={(e) => setPAccUsername(e.target.value)}
                />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-p-accpass">
                  Пароль
                </label>
                <input
                  id="adm-p-accpass"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={pAccPassword}
                  onChange={(e) => setPAccPassword(e.target.value)}
                />
              </div>
              <div className="field-row">
                <span className="field-label">Роли</span>
                <div className="role-checkboxes" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                  {PERSON_ROLES.map((r) => (
                    <label key={r} className="field-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={createRoleFlags[r]}
                        onChange={(e) => setCreateRoleFlags((f) => ({ ...f, [r]: e.target.checked }))}
                      />
                      {roleLabel(r)}
                    </label>
                  ))}
                </div>
                <p className="field-hint" style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
                  Если задан пароль — нужен телефон и/или username и хотя бы одна роль.
                </p>
              </div>
              <div className="dialog__actions" style={{ marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn--secondary" onClick={() => closeCreate()} disabled={submitting}>
                  Отмена
                </button>
                <button type="submit" className="btn btn--primary" disabled={submitting}>
                  {submitting ? 'Сохранение…' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && persons === null ? (
        <div className="card" aria-hidden>
          <div className="skeleton" style={{ width: '100%', height: '10rem' }} />
        </div>
      ) : persons?.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">Нет участников</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data data--tight">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Имя</th>
                <th scope="col" className="num">
                  Telegram ID
                </th>
                <th scope="col">Telegram</th>
                <th scope="col">Телефон</th>
                <th scope="col">Логин</th>
                <th scope="col">Роли</th>
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
                  <td>{r.tg_login || '—'}</td>
                  <td>{r.phone?.trim() ? r.phone : '—'}</td>
                  <td>{r.username?.trim() ? r.username : '—'}</td>
                  <td>{r.roles?.length ? r.roles.join(', ') : '—'}</td>
                  <td className="cell-actions">
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => openEdit(r)} disabled={submitting}>
                      Изменить
                    </button>{' '}
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmId(r.id)} disabled={submitting}>
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editRow && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={() => {
            if (!submitting) setEditRow(null)
          }}
        >
          <div className="dialog dialog--form" role="dialog" aria-modal="true" aria-labelledby={editTitleId} onMouseDown={(e) => e.stopPropagation()}>
            <h2 id={editTitleId} className="dialog__title">
              Участник id {editRow.id}
            </h2>
            <div className="field-grid">
              <div className="field-row">
                <label className="field-label" htmlFor="adm-pe-fn">
                  Имя
                </label>
                <input id="adm-pe-fn" className="input" value={editFn} onChange={(e) => setEditFn(e.target.value)} />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-pe-ln">
                  Фамилия
                </label>
                <input id="adm-pe-ln" className="input" value={editLn} onChange={(e) => setEditLn(e.target.value)} />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-pe-tg">
                  Telegram ID
                </label>
                <input id="adm-pe-tg" className="input" type="number" value={editTg} onChange={(e) => setEditTg(e.target.value)} />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-pe-tglogin">
                  Логин Telegram
                </label>
                <input
                  id="adm-pe-tglogin"
                  className="input"
                  placeholder="необязательно"
                  value={editTgLogin}
                  onChange={(e) => setEditTgLogin(e.target.value)}
                />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-pe-phone">
                  Телефон (вход)
                </label>
                <input
                  id="adm-pe-phone"
                  className="input"
                  type="tel"
                  inputMode="tel"
                  placeholder="+7 …"
                  autoComplete="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-pe-username">
                  Логин (username)
                </label>
                <input
                  id="adm-pe-username"
                  className="input"
                  placeholder="необязательно"
                  autoComplete="off"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                />
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="adm-pe-pass">
                  Новый пароль
                </label>
                <input
                  id="adm-pe-pass"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  placeholder="оставьте пустым, чтобы не менять"
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                />
              </div>
              <div className="field-row">
                <span className="field-label">Роли</span>
                <div className="role-checkboxes" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                  {PERSON_ROLES.map((r) => (
                    <label key={r} className="field-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editRoleFlags[r]}
                        onChange={(e) => setEditRoleFlags((f) => ({ ...f, [r]: e.target.checked }))}
                      />
                      {roleLabel(r)}
                    </label>
                  ))}
                </div>
                <p className="field-hint" style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
                  Сохранение перезаписывает роли в базе. Новый пароль — только если поле заполнено.
                </p>
              </div>
            </div>
            <div className="dialog__actions" style={{ marginTop: 'var(--space-4)' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setEditRow(null)} disabled={submitting}>
                Отмена
              </button>
              <button type="button" className="btn btn--primary" onClick={() => onSaveEdit()} disabled={submitting}>
                {submitting ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmId !== null}
        title="Удалить участника?"
        message={confirmId !== null ? `Участник с id ${confirmId} будет удалён без восстановления.` : ''}
        confirmLabel="Удалить"
        danger
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          if (confirmId !== null) void onDelete(confirmId)
        }}
      />
    </>
  )
}
