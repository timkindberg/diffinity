const SCENARIOS = [
  { id: '', label: 'baseline' },
  { id: 'targeted', label: 'targeted' },
  { id: 'refactor', label: 'refactor' },
  { id: 'theme', label: 'theme' },
] as const

export function ScenarioSwitcher() {
  const active = new URLSearchParams(location.search).get('scenario') ?? ''

  return (
    <nav class="scenario-switcher" aria-label="Scenario switcher (dev only)">
      {SCENARIOS.map(s => {
        const href = s.id
          ? `${location.pathname}?scenario=${s.id}${location.hash}`
          : `${location.pathname}${location.hash}`
        return (
          <a key={s.id} href={href} class={active === s.id ? 'active' : ''}>
            {s.label}
          </a>
        )
      })}
    </nav>
  )
}
