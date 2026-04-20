import { useEffect, useState } from 'preact/hooks'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { TablePage } from './pages/TablePage'
import { SettingsPage } from './pages/SettingsPage'

export type Route = 'dashboard' | 'table' | 'settings'

function parseRoute(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  if (h === 'table') return 'table'
  if (h === 'settings') return 'settings'
  return 'dashboard'
}

export function App() {
  const [route, setRoute] = useState<Route>(parseRoute(location.hash))

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <Layout route={route}>
      {route === 'dashboard' && <Dashboard />}
      {route === 'table' && <TablePage />}
      {route === 'settings' && <SettingsPage />}
    </Layout>
  )
}
