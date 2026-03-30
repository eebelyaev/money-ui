import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { BankerHomePage } from './BankerHomePage'
import { ClientPage } from './ClientPage'

function GuestHome() {
  return (
    <>
      <p className="page-intro">
        Money помогает вести учёт займов и смотреть задолженность. Роль и доступ назначаются администратором.
      </p>
      <div className="card" style={{ maxWidth: '44rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 18rem' }}>
            <h2 className="section-title" style={{ marginBottom: 'var(--space-3)' }}>
              Для клиента
            </h2>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              <li>Видеть общую сумму к оплате на сегодня.</li>
              <li>Открывать договор и смотреть задолженность по нему.</li>
              <li>Просматривать историю начислений и операций.</li>
            </ul>
          </div>

          <div style={{ flex: '1 1 18rem' }}>
            <h2 className="section-title" style={{ marginBottom: 'var(--space-3)' }}>
              Для банкира
            </h2>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              <li>Видеть клиентов портфеля и общую задолженность.</li>
              <li>Открывать договоры и анализировать начисления.</li>
              <li>Делать пересчёт, закрывать договоры и добавлять платежи.</li>
            </ul>
          </div>
        </div>

        <Link to="/login" className="btn btn--primary" style={{ marginTop: '1.25rem', display: 'inline-flex' }}>
          Войти
        </Link>
      </div>
    </>
  )
}

export function HomePage() {
  const { role, personId } = useAuth()

  if (!personId || !role) {
    return <GuestHome />
  }
  if (role === 'client') {
    return <ClientPage />
  }
  if (role === 'banker' || role === 'admin') {
    return <BankerHomePage />
  }
  return <GuestHome />
}
