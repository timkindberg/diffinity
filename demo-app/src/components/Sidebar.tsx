import type { Route } from '../App'

type LinkDef = {
  route: Route
  href: string
  label: string
  icon: preact.JSX.Element
  count?: number
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.5,
  'stroke-linecap': 'round' as const,
  'stroke-linejoin': 'round' as const,
}

const primaryLinks: LinkDef[] = [
  {
    route: 'dashboard',
    href: '#/',
    label: 'Dashboard',
    icon: (
      <svg {...iconProps}>
        <rect x="2" y="2" width="5" height="5" rx="1" />
        <rect x="9" y="2" width="5" height="5" rx="1" />
        <rect x="2" y="9" width="5" height="5" rx="1" />
        <rect x="9" y="9" width="5" height="5" rx="1" />
      </svg>
    ),
  },
  {
    route: 'table',
    href: '#/table',
    label: 'Customers',
    count: 124,
    icon: (
      <svg {...iconProps}>
        <rect x="2" y="3" width="12" height="10" rx="1" />
        <path d="M2 7h12M6 3v10" />
      </svg>
    ),
  },
  {
    route: 'settings',
    href: '#/settings',
    label: 'Settings',
    icon: (
      <svg {...iconProps}>
        <circle cx="8" cy="8" r="2" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" />
      </svg>
    ),
  },
]

const secondaryLinks: Omit<LinkDef, 'route'>[] = [
  {
    href: '#/',
    label: 'Invoices',
    icon: (
      <svg {...iconProps}>
        <path d="M3 2h10v12l-2-1-2 1-2-1-2 1-2-1V2z" />
        <path d="M5 5h6M5 8h6M5 11h4" />
      </svg>
    ),
  },
  {
    href: '#/',
    label: 'Reports',
    icon: (
      <svg {...iconProps}>
        <path d="M2 13V3M2 13h12" />
        <path d="M5 10V7M8 10V5M11 10V8" />
      </svg>
    ),
  },
]

type Props = { active: Route }

export function Sidebar({ active }: Props) {
  return (
    <aside class="sidebar" aria-label="Primary navigation">
      <div>
        <div class="sidebar-section-label">Workspace</div>
        <nav class="sidebar-nav">
          {primaryLinks.map(link => (
            <a
              key={link.route}
              href={link.href}
              class="sidebar-link"
              aria-current={active === link.route ? 'page' : undefined}
            >
              <span class="sidebar-link-icon" aria-hidden="true">{link.icon}</span>
              <span>{link.label}</span>
              {link.count !== undefined && <span class="sidebar-link-count">{link.count}</span>}
            </a>
          ))}
        </nav>
      </div>

      <div>
        <div class="sidebar-section-label">Insights</div>
        <nav class="sidebar-nav">
          {secondaryLinks.map(link => (
            <a key={link.label} href={link.href} class="sidebar-link">
              <span class="sidebar-link-icon" aria-hidden="true">{link.icon}</span>
              <span>{link.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </aside>
  )
}
