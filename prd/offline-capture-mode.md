# PRD: Offline Capture Mode (No Dev Stack Required)

## Problem

Running the VR capture tool requires the full local dev stack: Docker (nginx, Postgres, Redis, localstack, etc.), Django, and Next.js dev server. This is heavy — `make stack-up` + `npm run start-app` just to capture pages where all API data is already mocked.

The tool mocks 100% of API responses via Playwright `page.route()` (Next.js pages) or Django `VRMockMiddleware` (Django template pages). The live servers are only needed for:

1. **Authentication** — two POST requests to Django login endpoints
2. **Next.js pages (~23)** — serving the SPA shell HTML, JS bundles, CSS, and fonts
3. **Django template pages (~14)** — server-side template rendering with mock context

## Goal

Enable VR capture of Next.js pages with zero running servers. Django pages may remain server-dependent or be addressed in a later phase.

## Proposed Approach

### Phase 1: Next.js Pages Offline (high value, moderate effort)

**1a. Mock authentication in Playwright**

Instead of POSTing to `/accounts/login/identity/` and `/accounts/login/pwd/`, intercept those requests via `page.route()` and fulfill with mock responses + set session cookies directly on the browser context.

```typescript
// Conceptual — mock login mode
await context.addCookies([{
  name: 'sessionid', value: 'vr-mock-session', domain: '.localqa.vndly.com', path: '/'
}])
await page.route('**/accounts/login/**', route =>
  route.fulfill({ status: 200, body: '{}' }))
```

**1b. Serve pre-built static assets locally**

- Run `npm run build` once to produce the Next.js production output
- Serve the build output with a lightweight static file server (e.g., `npx serve`, `http-server`, or a Playwright route-all interceptor)
- Point `VR_BASE_URL` at the static server

Alternatively, intercept all asset requests (`*.js`, `*.css`, `*.woff2`, etc.) via `page.route()` and fulfill from a cached asset directory.

**1c. Handle routing**

The current setup relies on nginx to route `*.localqa.vndly.com` to the correct service. Options:
- Use a simple Node HTTP server that mimics the nginx routing for Next.js paths
- Or bypass the domain entirely and serve from `localhost` with adjusted config

**Outcome**: ~23 Next.js pages capturable with only Node.js installed. No Docker, no Django, no dev servers.

### Phase 2: Django Pages Offline (ambitious, lower priority)

Django template pages require the Python runtime for template rendering (`l10n_format`, `feature_flag_enabled`, `render_bundle` tags). Options:

**2a. Pre-render to static HTML snapshots**

- Run a one-time "Django snapshot" with the stack running
- Save rendered HTML per page to disk
- In offline mode, serve these snapshots instead of hitting Django
- Trade-off: snapshots go stale when templates change

**2b. Accept the split**

- Keep Django pages as "online-only" captures
- Run them separately when the stack happens to be up
- Focus offline mode on the Next.js majority

## Considerations

- **Asset cache freshness**: After `npm run build`, the asset cache is valid until code changes. A hash-based cache key could detect staleness.
- **Feature flag state**: Currently resolved by the live server. In offline mode, feature flags would need a static config or mock.
- **`/api/v2/accounts/me/`**: Already mocked per-page via `page.route()`, so no server dependency there.
- **HMR blocking**: `blockHmr()` in auth.ts becomes unnecessary in offline mode (no webpack-hmr endpoint).
- **CSS-in-JS**: Chakra UI generates styles at runtime in the browser, so this works fine without a server — the JS bundles just need to load.

## Effort Estimate

| Phase | Scope | Effort |
|-------|-------|--------|
| 1a | Mock auth | Small — ~1 hour |
| 1b | Static asset serving | Medium — ~1-2 days (build pipeline + server setup + testing) |
| 1c | Routing without nginx | Small-Medium — depends on approach |
| 2a | Django pre-render | Large — template snapshot tooling + staleness management |
| 2b | Accept split | Zero — just document the two modes |

## Success Criteria

- `npm run capture:offline` runs all Next.js page captures with no Docker stack, no Django, no Next.js dev server
- Captured DOM manifests and HTML are identical (or acceptably close) to online captures
- Fidelity verification (pixelmatch) passes at the same thresholds as online mode

## Non-Goals

- Replacing the online capture mode (it remains the source of truth)
- CI/CD integration (separate initiative)
- Eliminating the need to `npm run build` before offline capture
