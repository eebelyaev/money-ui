import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function AppLayout() {
  const loc = useLocation()
  const { role, personId, logout } = useAuth()
  const onHome = loc.pathname === '/'

  return (
    <div className="shell">
      <a href="#main-content" className="skip-link">
        К содержимому
      </a>
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
          <Link
            to="/banker"
            className={`shell__nav-link${loc.pathname === '/banker' ? ' shell__nav-link--active' : ''}`}
            aria-current={loc.pathname === '/banker' ? 'page' : undefined}
          >
            Банкир
          </Link>
          <Link
            to="/client"
            className={`shell__nav-link${loc.pathname === '/client' ? ' shell__nav-link--active' : ''}`}
            aria-current={loc.pathname === '/client' ? 'page' : undefined}
          >
            Клиент
          </Link>
          <Link to="/login" className="shell__nav-link">
            Вход
          </Link>
          {role && personId && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => logout()}>
              Выйти ({role})
            </button>
          )}
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
