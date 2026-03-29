import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AppLayout } from './components/AppLayout'
import { ToastProvider } from './context/ToastContext'
import { BankerAdminPage } from './pages/BankerAdminPage'
import { ContractPage } from './pages/ContractPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import './App.css'

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/banker" element={<Navigate to="/" replace />} />
            <Route path="/client" element={<Navigate to="/" replace />} />
            <Route path="/admin" element={<BankerAdminPage />} />
            <Route path="/contracts/:id" element={<ContractPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}
