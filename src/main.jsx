import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AdminPanel from './AdminPanel.jsx'

const isAdminPage = window.location.pathname.startsWith('/admin')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdminPage ? <AdminPanel /> : <App />}
  </StrictMode>,
)