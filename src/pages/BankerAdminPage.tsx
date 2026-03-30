import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { activateAdminBrowseContext } from '../auth/storage'
import { BankerAdminTabs } from './BankerAdminTabs'

export function BankerAdminPage() {
  const { role, personId } = useAuth()

  useEffect(() => {
    activateAdminBrowseContext()
  }, [])
  if ((role !== 'banker' && role !== 'admin') || !personId) {
    return (
      <p className="alert alert--error">
        Нужна роль банкира. <Link to="/login">Войти</Link>
      </p>
    )
  }
  return <BankerAdminTabs />
}
