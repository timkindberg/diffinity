import { StatCard } from '../components/StatCard'

type Activity = {
  id: string
  text: preact.JSX.Element
  meta: string
  dotColor: string
}

const activity: Activity[] = [
  {
    id: '1',
    text: <><strong>Acme Corp</strong> upgraded to Enterprise plan</>,
    meta: 'Riley Chen · 12m ago',
    dotColor: '#16a34a',
  },
  {
    id: '2',
    text: <>Invoice <strong>#INV-2041</strong> marked as paid ($4,820.00)</>,
    meta: 'Billing bot · 38m ago',
    dotColor: '#5b4fe0',
  },
  {
    id: '3',
    text: <>New support ticket opened by <strong>Parabola Labs</strong></>,
    meta: 'Mia Ortega · 1h ago',
    dotColor: '#ea580c',
  },
  {
    id: '4',
    text: <>API key rotated for workspace <strong>helix-prod</strong></>,
    meta: 'System · 3h ago',
    dotColor: '#0284c7',
  },
  {
    id: '5',
    text: <>Customer <strong>Nimbus Analytics</strong> churned (refund issued)</>,
    meta: 'Riley Chen · 5h ago',
    dotColor: '#dc2626',
  },
]

export function Dashboard() {
  return (
    <section aria-labelledby="dashboard-title">
      <header class="page-header">
        <div>
          <h1 id="dashboard-title" class="page-title">Dashboard</h1>
          <p class="page-subtitle">Your ops snapshot for the last 30 days.</p>
        </div>
        <div class="page-actions">
          <button type="button" class="btn btn-secondary">Export</button>
          <button type="button" class="btn btn-primary">New report</button>
        </div>
      </header>

      <div class="stat-grid">
        <StatCard label="Monthly revenue"   value="$124,580" delta={{ value: '12.4%', direction: 'positive' }} />
        <StatCard label="Active customers"  value="1,284"    delta={{ value: '3.1%',  direction: 'positive' }} />
        <StatCard label="Open tickets"      value="47"       delta={{ value: '8.0%',  direction: 'negative' }} />
        <StatCard label="Avg response time" value="2h 14m"   delta={{ value: 'No change', direction: 'neutral' }} />
      </div>

      <div class="dashboard-row">
        <article class="card">
          <div class="card-header">
            <h2 class="card-title">Recent activity</h2>
            <button type="button" class="btn btn-ghost">View all</button>
          </div>
          <ul class="activity-list">
            {activity.map(item => (
              <li key={item.id} class="activity-item">
                <span
                  class="activity-dot"
                  style={`background: ${item.dotColor}`}
                  aria-hidden="true"
                />
                <div class="activity-body">
                  <p class="activity-text">{item.text}</p>
                  <div class="activity-meta">{item.meta}</div>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article class="card">
          <div class="card-header">
            <h2 class="card-title">Quick actions</h2>
          </div>
          <div class="quick-actions">
            <button type="button" class="quick-action">
              <span class="quick-action-icon" aria-hidden="true">+</span>
              <span class="quick-action-label">Add customer</span>
              <span class="quick-action-desc">Create a new workspace</span>
            </button>
            <button type="button" class="quick-action">
              <span class="quick-action-icon" aria-hidden="true">$</span>
              <span class="quick-action-label">Send invoice</span>
              <span class="quick-action-desc">Bill an existing customer</span>
            </button>
            <button type="button" class="quick-action">
              <span class="quick-action-icon" aria-hidden="true">↗</span>
              <span class="quick-action-label">Run report</span>
              <span class="quick-action-desc">Export monthly metrics</span>
            </button>
            <button type="button" class="quick-action">
              <span class="quick-action-icon" aria-hidden="true">⚙</span>
              <span class="quick-action-label">API keys</span>
              <span class="quick-action-desc">Manage credentials</span>
            </button>
          </div>
        </article>
      </div>
    </section>
  )
}
