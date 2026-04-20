type Delta = { value: string; direction: 'positive' | 'negative' | 'neutral' }

type Props = {
  label: string
  value: string
  delta?: Delta
}

export function StatCard({ label, value, delta }: Props) {
  return (
    <article class="card stat-card">
      <p class="stat-card-label">{label}</p>
      <p class="stat-card-value">{value}</p>
      {delta && (
        <span class={`stat-card-delta ${delta.direction}`}>
          {delta.direction === 'positive' && '▲ '}
          {delta.direction === 'negative' && '▼ '}
          {delta.value}
        </span>
      )}
    </article>
  )
}
