import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function AppLayout() {
  const loc = useLocation()
  const { role, personId, logout } = useAuth()
  const onHome = loc.pathname === '/'
  const onAdmin = loc.pathname === '/admin'
  const showAdminNav = (role === 'banker' || role === 'admin') && !!personId

  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__brand">
          <Link to="/" className="shell__logo">
            Money
          </Link>
          <span className="shell__tagline">Учёт займов</span>
        </div>
        <nav className="shell__nav" aria-label="Основная навигация">
          <Link
            to="/"
            className={`shell__nav-link${onHome ? ' shell__nav-link--active' : ''}`}
            aria-current={onHome ? 'page' : undefined}
          >
            Главная
          </Link>
          {showAdminNav && (
            <Link
              to="/admin"
              className={`shell__nav-link${onAdmin ? ' shell__nav-link--active' : ''}`}
              aria-current={onAdmin ? 'page' : undefined}
            >
              Администрирование
            </Link>
          )}
          {role && personId && (
            <button type="button" className="shell__nav-link shell__nav-link--action" onClick={() => logout()}>
              Выйти
            </button>
          )}
          <Link to="/login" className="shell__nav-link">
            Вход
          </Link>
        </nav>
      </header>

      <main className="shell__main" id="main-content">
        <Outlet />
      </main>

      <footer className="shell__footer">
        <span className="shell__footer-label">API</span>
        <a href="/docs" className="shell__footer-link">
          Swagger
        </a>
        <span className="shell__footer-sep" aria-hidden>
          ·
        </span>
        <a href="/health" className="shell__footer-link">
          /health
        </a>
      </footer>
    </div>
  )
}
