import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { BankerHomePage } from './BankerHomePage'
import { ClientPage } from './ClientPage'

function GuestHome() {
  return (
    <>
      <h1 className="page-title">Главная</h1>
      <p className="page-intro">
        Войдите по телефону или логину и паролю — интерфейс банкира, клиента или администратора откроется на этой же странице.
      </p>
      <div className="card" style={{ maxWidth: '28rem' }}>
        <p className="field-hint" style={{ marginTop: 0 }}>
          Учётные записи и роли задаются в базе calculations (телефон — <span className="font-mono">person.login</span>, логин —{' '}
          <span className="font-mono">person.username</span>, пароль,
          таблица <span className="font-mono">user_role</span>). В запросах используется JWT или, в режиме разработки,
          заголовки <span className="font-mono">X-Person-Id</span> / <span className="font-mono">X-Role</span>.
        </p>
        <Link to="/login" className="btn btn--primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>
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
  if (role === 'admin') {
    return <Navigate to="/admin" replace />
  }
  if (role === 'client') {
    return <ClientPage />
  }
  if (role === 'banker') {
    return <BankerHomePage />
  }
  return <GuestHome />
}
