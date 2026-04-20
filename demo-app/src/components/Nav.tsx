export function Nav() {
  return (
    <header class="nav" role="banner">
      <a href="#/" class="nav-brand" aria-label="Helix home">
        <span class="nav-brand-mark" aria-hidden="true">H</span>
        <span>Helix</span>
      </a>

      <div class="nav-search" role="search">
        <span class="nav-search-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l3 3" stroke-linecap="round" />
          </svg>
        </span>
        <input type="search" placeholder="Search customers, invoices, users..." aria-label="Search" />
      </div>

      <div class="nav-actions">
        <button type="button" class="nav-icon-btn" aria-label="View notifications">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 6a5 5 0 0 1 10 0v3l1.5 2h-13L3 9V6z" stroke-linejoin="round" />
            <path d="M6 12a2 2 0 0 0 4 0" stroke-linecap="round" />
          </svg>
        </button>
        <button type="button" class="nav-icon-btn" aria-label="Open help">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="8" cy="8" r="6" />
            <path d="M6.5 6.5a1.5 1.5 0 1 1 2 1.4c-.5.2-.5.6-.5 1.1M8 11.5v.01" stroke-linecap="round" />
          </svg>
        </button>
        <button type="button" class="nav-avatar" aria-label="Account menu for Riley Chen">RC</button>
      </div>
    </header>
  )
}
