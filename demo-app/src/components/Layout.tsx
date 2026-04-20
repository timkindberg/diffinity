import type { ComponentChildren } from 'preact'
import type { Route } from '../App'
import { Nav } from './Nav'
import { Sidebar } from './Sidebar'

type Props = {
  route: Route
  children: ComponentChildren
}

export function Layout({ route, children }: Props) {
  return (
    <div class="app-shell">
      <Nav />
      <div class="app-body">
        <Sidebar active={route} />
        <main class="app-main" id="main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
