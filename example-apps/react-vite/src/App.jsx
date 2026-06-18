import { AuthProvider, useAuth } from './contexts/AuthContext'
import Home from './pages/Home'
import Burrito from './pages/Burrito'
import Profile from './pages/Profile'
import Header from './components/Header'

function AppContent() {
  const { user } = useAuth()

  if (!user) {
    return <Home />
  }

  return <MainApp />
}

function MainApp() {
  const { page } = useAuth()

  return (
    <>
      {page === 'home' && <Home />}
      {page === 'burrito' && <Burrito />}
      {page === 'profile' && <Profile />}
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Header />
      <main>
        <AppContent />
      </main>
    </AuthProvider>
  )
}
