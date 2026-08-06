import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './app/AuthContext'
import { OnlineProvider } from './app/OnlineContext'
import { AppRoutes } from './app/routes'
import './styles/global.css'

export default function App() {
  return (
    <BrowserRouter>
      <OnlineProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </OnlineProvider>
    </BrowserRouter>
  )
}
