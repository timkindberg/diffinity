import { render } from 'preact'
import { App } from './App'

// Dev-time scenario preview: visiting ?scenario=<name> dynamically loads the
// corresponding scenario CSS, letting you eyeball the scenario visually in
// the vite dev server. Capture-time scenario CSS is injected separately by
// run-demo.ts via Playwright, so this has no effect on pixel captures.
const scenarioLoaders = {
  targeted: () => import('./scenarios/targeted.css'),
  refactor: () => import('./scenarios/refactor.css'),
  theme: () => import('./scenarios/theme.css'),
} as const

const scenarioParam = new URLSearchParams(location.search).get('scenario') as
  | keyof typeof scenarioLoaders
  | null
if (scenarioParam && scenarioParam in scenarioLoaders) {
  scenarioLoaders[scenarioParam]()
}

render(<App />, document.getElementById('app')!)
