import { useMemo, useState } from 'preact/hooks'

type Status = 'active' | 'trialing' | 'past_due' | 'churned' | 'invited'

type Customer = {
  id: string
  name: string
  email: string
  plan: 'Free' | 'Starter' | 'Growth' | 'Enterprise'
  status: Status
  mrr: number
  joined: string
}

const customers: Customer[] = [
  { id: 'CUS-001', name: 'Acme Corp',         email: 'ops@acme.example',       plan: 'Enterprise', status: 'active',   mrr: 4820, joined: '2024-11-02' },
  { id: 'CUS-002', name: 'Parabola Labs',     email: 'team@parabola.example',  plan: 'Growth',     status: 'active',   mrr: 1240, joined: '2025-02-18' },
  { id: 'CUS-003', name: 'Nimbus Analytics',  email: 'hi@nimbus.example',      plan: 'Starter',    status: 'churned',  mrr: 0,    joined: '2023-08-12' },
  { id: 'CUS-004', name: 'Quanta Ltd',        email: 'billing@quanta.example', plan: 'Enterprise', status: 'past_due', mrr: 6400, joined: '2022-01-04' },
  { id: 'CUS-005', name: 'Ironbark Studio',   email: 'finance@ironbark.example', plan: 'Growth',   status: 'active',   mrr: 980,  joined: '2025-03-22' },
  { id: 'CUS-006', name: 'Palette Health',    email: 'admin@palette.example',  plan: 'Starter',    status: 'trialing', mrr: 0,    joined: '2026-04-01' },
  { id: 'CUS-007', name: 'Tributary',         email: 'contact@tributary.example', plan: 'Free',    status: 'invited',  mrr: 0,    joined: '2026-04-18' },
  { id: 'CUS-008', name: 'Orbit Robotics',    email: 'team@orbit.example',     plan: 'Growth',     status: 'active',   mrr: 1820, joined: '2024-06-30' },
  { id: 'CUS-009', name: 'Lumen Media',       email: 'ar@lumen.example',       plan: 'Enterprise', status: 'active',   mrr: 5200, joined: '2023-04-17' },
  { id: 'CUS-010', name: 'Hedgerow Bio',      email: 'ops@hedgerow.example',   plan: 'Starter',    status: 'past_due', mrr: 340,  joined: '2025-09-11' },
  { id: 'CUS-011', name: 'Mesa Mobility',     email: 'billing@mesa.example',   plan: 'Growth',     status: 'active',   mrr: 1440, joined: '2024-12-05' },
  { id: 'CUS-012', name: 'Fossa Security',    email: 'ar@fossa.example',       plan: 'Enterprise', status: 'active',   mrr: 7100, joined: '2023-02-28' },
  { id: 'CUS-013', name: 'Branch Finance',    email: 'ops@branchfin.example',  plan: 'Growth',     status: 'trialing', mrr: 0,    joined: '2026-03-28' },
  { id: 'CUS-014', name: 'Tallgrass Logistics', email: 'admin@tallgrass.example', plan: 'Starter', status: 'active',   mrr: 620,  joined: '2025-07-14' },
  { id: 'CUS-015', name: 'Kelp Commerce',     email: 'team@kelp.example',      plan: 'Growth',     status: 'churned',  mrr: 0,    joined: '2024-01-23' },
  { id: 'CUS-016', name: 'Cipher Foundry',    email: 'ops@cipher.example',     plan: 'Enterprise', status: 'active',   mrr: 4820, joined: '2023-10-09' },
  { id: 'CUS-017', name: 'Moss Textiles',     email: 'finance@moss.example',   plan: 'Starter',    status: 'invited',  mrr: 0,    joined: '2026-04-15' },
  { id: 'CUS-018', name: 'Altitude Air',      email: 'ar@altitude.example',    plan: 'Enterprise', status: 'past_due', mrr: 8200, joined: '2022-11-30' },
]

const statusLabels: Record<Status, { label: string; cls: string }> = {
  active:   { label: 'Active',    cls: 'badge-success' },
  trialing: { label: 'Trialing',  cls: 'badge-info' },
  past_due: { label: 'Past due',  cls: 'badge-warning' },
  churned:  { label: 'Churned',   cls: 'badge-neutral' },
  invited:  { label: 'Invited',   cls: 'badge-info' },
}

type SortKey = 'name' | 'plan' | 'status' | 'mrr' | 'joined'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 8

export function TablePage() {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('mrr')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = customers.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    })
    const sorted = [...rows].sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [query, statusFilter, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return <span class="sort-indicator">↕</span>
    return <span class="sort-indicator">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <section aria-labelledby="customers-title">
      <header class="page-header">
        <div>
          <h1 id="customers-title" class="page-title">Customers</h1>
          <p class="page-subtitle">Every workspace, plan, and billing state.</p>
        </div>
        <div class="page-actions">
          <button type="button" class="btn btn-secondary">Import CSV</button>
          <button type="button" class="btn btn-primary">Add customer</button>
        </div>
      </header>

      <article class="card">
        <div class="table-toolbar">
          <input
            type="search"
            placeholder="Search by name, email, or ID..."
            aria-label="Search customers"
            value={query}
            onInput={e => { setQuery((e.target as HTMLInputElement).value); setPage(1) }}
          />
          <label class="form-field" style="flex-direction: row; align-items: center; gap: 8px; margin: 0;">
            <span class="form-label" style="margin: 0;">Status</span>
            <select
              class="form-select"
              aria-label="Filter by status"
              value={statusFilter}
              onChange={e => { setStatusFilter((e.target as HTMLSelectElement).value as Status | 'all'); setPage(1) }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="past_due">Past due</option>
              <option value="churned">Churned</option>
              <option value="invited">Invited</option>
            </select>
          </label>
        </div>

        <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col" onClick={() => toggleSort('name')}>Name {sortIndicator('name')}</th>
              <th scope="col" onClick={() => toggleSort('plan')}>Plan {sortIndicator('plan')}</th>
              <th scope="col" onClick={() => toggleSort('status')}>Status {sortIndicator('status')}</th>
              <th scope="col" onClick={() => toggleSort('mrr')}>MRR {sortIndicator('mrr')}</th>
              <th scope="col" onClick={() => toggleSort('joined')}>Joined {sortIndicator('joined')}</th>
              <th scope="col" aria-label="Row actions"></th>
            </tr>
          </thead>
          <tbody>
            {paged.map(c => {
              const s = statusLabels[c.status]
              return (
                <tr key={c.id}>
                  <td>
                    <div class="data-table-name">{c.name}</div>
                    <div class="data-table-id">{c.id} · {c.email}</div>
                  </td>
                  <td>{c.plan}</td>
                  <td><span class={`badge ${s.cls}`}>{s.label}</span></td>
                  <td>{c.mrr === 0 ? '—' : `$${c.mrr.toLocaleString()}`}</td>
                  <td>{c.joined}</td>
                  <td>
                    <div class="row-actions">
                      <button type="button" class="row-action-btn" aria-label={`Edit ${c.name}`}>Edit</button>
                      <button type="button" class="row-action-btn" aria-label={`View ${c.name}`}>View</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {paged.length === 0 && (
              <tr>
                <td colSpan={6} style="text-align: center; padding: 32px; color: var(--color-text-muted);">
                  No customers match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>

        <div class="pagination">
          <span>
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div class="pagination-controls">
            <button
              type="button"
              class="pagination-btn"
              disabled={safePage === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              aria-label="Previous page"
            >‹</button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                class="pagination-btn"
                aria-current={safePage === i + 1 ? 'page' : undefined}
                onClick={() => setPage(i + 1)}
              >{i + 1}</button>
            ))}
            <button
              type="button"
              class="pagination-btn"
              disabled={safePage === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >›</button>
          </div>
        </div>
      </article>
    </section>
  )
}
