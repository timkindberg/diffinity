export function SettingsPage() {
  return (
    <section aria-labelledby="settings-title">
      <header class="page-header">
        <div>
          <h1 id="settings-title" class="page-title">Settings</h1>
          <p class="page-subtitle">Manage your workspace profile, notifications, and API access.</p>
        </div>
      </header>

      <form class="settings-layout" onSubmit={e => e.preventDefault()}>
        {/* ── Profile ─────────────────────────────────────────── */}
        <article class="card">
          <div class="card-body">
            <fieldset class="form-section">
              <header class="form-section-header">
                <legend class="form-section-legend">Workspace profile</legend>
                <p class="form-section-desc">Visible to everyone on your team.</p>
              </header>
              <div class="form-section-body">
                <div class="form-grid-2">
                  <label class="form-field">
                    <span class="form-label">Workspace name</span>
                    <input class="form-input" type="text" name="workspace" value="Helix Operations" />
                  </label>
                  <label class="form-field">
                    <span class="form-label">Subdomain<span class="form-label-hint">.helix.app</span></span>
                    <input class="form-input" type="text" name="subdomain" value="helix-ops" />
                  </label>
                </div>
                <label class="form-field">
                  <span class="form-label">Contact email</span>
                  <input class="form-input" type="email" name="email" value="riley.chen@helix.app" />
                  <span class="form-help">Billing receipts and security alerts go here.</span>
                </label>
                <label class="form-field">
                  <span class="form-label">Timezone</span>
                  <select class="form-select" name="timezone">
                    <option>(GMT-08:00) Pacific — Los Angeles</option>
                    <option>(GMT-05:00) Eastern — New York</option>
                    <option>(GMT+00:00) UTC</option>
                    <option>(GMT+01:00) Central European — Berlin</option>
                    <option>(GMT+09:00) Japan — Tokyo</option>
                  </select>
                </label>
                <label class="form-field">
                  <span class="form-label">Bio</span>
                  <textarea class="form-textarea" name="bio" rows={3}>Internal ops tooling for revenue, billing, and customer support.</textarea>
                </label>
              </div>
            </fieldset>
          </div>
        </article>

        {/* ── Notifications ──────────────────────────────────── */}
        <article class="card">
          <div class="card-body">
            <fieldset class="form-section">
              <header class="form-section-header">
                <legend class="form-section-legend">Email notifications</legend>
                <p class="form-section-desc">Choose what lands in your inbox.</p>
              </header>
              <div class="form-section-body">
                <div class="form-check-group">
                  <label class="form-check">
                    <input type="checkbox" checked />
                    <span>
                      <span class="form-check-label">Billing events</span>
                      <span class="form-check-desc">New invoices, payment failures, and refunds.</span>
                    </span>
                  </label>
                  <label class="form-check">
                    <input type="checkbox" checked />
                    <span>
                      <span class="form-check-label">Customer lifecycle</span>
                      <span class="form-check-desc">New signups, churn events, and plan changes.</span>
                    </span>
                  </label>
                  <label class="form-check">
                    <input type="checkbox" />
                    <span>
                      <span class="form-check-label">Weekly digest</span>
                      <span class="form-check-desc">A Monday-morning summary of last week.</span>
                    </span>
                  </label>
                  <label class="form-check">
                    <input type="checkbox" />
                    <span>
                      <span class="form-check-label">Product updates</span>
                      <span class="form-check-desc">Feature launches and release notes.</span>
                    </span>
                  </label>
                </div>
              </div>
            </fieldset>
          </div>
        </article>

        {/* ── Preferences (radio) ────────────────────────────── */}
        <article class="card">
          <div class="card-body">
            <fieldset class="form-section">
              <header class="form-section-header">
                <legend class="form-section-legend">Default data view</legend>
                <p class="form-section-desc">Applies to new reports and dashboards you create.</p>
              </header>
              <div class="form-section-body">
                <div class="form-radio-group" role="radiogroup" aria-label="Default data view">
                  <label class="form-check">
                    <input type="radio" name="view" value="compact" />
                    <span>
                      <span class="form-check-label">Compact</span>
                      <span class="form-check-desc">Tight spacing, more rows per screen.</span>
                    </span>
                  </label>
                  <label class="form-check">
                    <input type="radio" name="view" value="comfortable" checked />
                    <span>
                      <span class="form-check-label">Comfortable</span>
                      <span class="form-check-desc">Balanced density — recommended.</span>
                    </span>
                  </label>
                  <label class="form-check">
                    <input type="radio" name="view" value="spacious" />
                    <span>
                      <span class="form-check-label">Spacious</span>
                      <span class="form-check-desc">More breathing room, fewer rows per screen.</span>
                    </span>
                  </label>
                </div>
              </div>
            </fieldset>
          </div>
        </article>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn btn-primary">Save changes</button>
        </div>
      </form>
    </section>
  )
}
