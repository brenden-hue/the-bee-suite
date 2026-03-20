import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.CRM_CONFIG;

if (!config?.supabaseUrl || !config?.supabaseAnonKey || config.supabaseUrl === "YOUR_SUPABASE_URL") {
  throw new Error("Set supabaseUrl and supabaseAnonKey in config.js before running the app.");
}

const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

const STORAGE_KEYS = {
  view: "kidcity-view",
  filter: "kidcity-filter"
};

const LOGIN_ROLE_STORAGE_KEY = "kidcity-login-role";

const state = {
  session: null,
  profile: null,
  currentRole: "executive",
  currentView: localStorage.getItem(STORAGE_KEYS.view) || "overview",
  currentFilter: localStorage.getItem(STORAGE_KEYS.filter) || "all",
  searchTerm: "",
  data: {
    locations: [],
    leads: [],
    tours: [],
    messages: [],
    compliance: [],
    classrooms: [],
    staffing: []
  }
};

const elements = {
  authShell: document.getElementById("authShell"),
  appShell: document.getElementById("appShell"),
  authMessage: document.getElementById("authMessage"),
  authRoleSwitch: document.getElementById("authRoleSwitch"),
  googleSignInBtn: document.getElementById("googleSignInBtn"),
  roleSwitch: document.getElementById("roleSwitch"),
  mainNav: document.getElementById("mainNav"),
  quickFilters: document.getElementById("quickFilters"),
  pageTitle: document.getElementById("pageTitle"),
  heroTitle: document.getElementById("heroTitle"),
  heroCopy: document.getElementById("heroCopy"),
  userPill: document.getElementById("userPill"),
  signOutBtn: document.getElementById("signOutBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  globalSearch: document.getElementById("globalSearch"),
  kpis: document.getElementById("kpis"),
  viewOverview: document.getElementById("view-overview"),
  viewPipeline: document.getElementById("view-pipeline"),
  viewTours: document.getElementById("view-tours"),
  viewOperations: document.getElementById("view-operations"),
  viewParentComms: document.getElementById("view-parentComms"),
  viewCompliance: document.getElementById("view-compliance"),
  viewAI: document.getElementById("view-ai")
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function titleCase(value) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatPercent(numerator, denominator) {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.view, state.currentView);
  localStorage.setItem(STORAGE_KEYS.filter, state.currentFilter);
}

function setAuthMessage(message, isError = false) {
  elements.authMessage.textContent = message;
  elements.authMessage.style.color = isError ? "#ffd5d8" : "";
}

function showInlineMessage(id, message, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#ffd5d8" : "#d7fff7";
}

function getSelectedLoginRole() {
  return localStorage.getItem(LOGIN_ROLE_STORAGE_KEY) || "";
}

function setSelectedLoginRole(role) {
  localStorage.setItem(LOGIN_ROLE_STORAGE_KEY, role);
}

function updateAuthRoleButtons() {
  const selectedRole = getSelectedLoginRole();

  document.querySelectorAll(".auth-role-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.loginRole === selectedRole);
  });

  if (elements.googleSignInBtn) {
    elements.googleSignInBtn.disabled = !selectedRole;
  }
}

function canUseBulkImport() {
  return state.currentRole === "executive";
}

function canCreateLeadsManually() {
  return ["executive", "director", "admissions"].includes(state.currentRole);
}

function getAccessibleLocations() {
  if (state.currentRole === "executive") return state.data.locations;
  return state.data.locations.filter((row) => row.id === state.profile?.location_id);
}

function buildRoleButtons() {
  const allowedRoles = ["executive", "director", "admissions"];

  elements.roleSwitch.innerHTML = allowedRoles.map((roleKey) => {
    const meta = config.roleMeta[roleKey];
    const active = roleKey === state.currentRole ? "active" : "";
    return `
      <button class="role-btn ${active}" type="button" data-role="${escapeHtml(roleKey)}">
        ${escapeHtml(meta.label)}
      </button>
    `;
  }).join("");

  elements.roleSwitch.querySelectorAll(".role-btn").forEach((btn) => {
    btn.addEventListener("click", () => setRole(btn.dataset.role));
  });
}

function buildNav() {
  elements.mainNav.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });
}

function buildQuickFilters() {
  elements.quickFilters.innerHTML = config.quickFilters.map((filter) => {
    const active = filter.id === state.currentFilter ? "active" : "";
    return `
      <button class="chip-btn ${active}" type="button" data-filter="${escapeHtml(filter.id)}">
        ${escapeHtml(filter.label)}
      </button>
    `;
  }).join("");

  elements.quickFilters.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentFilter = btn.dataset.filter;
      saveState();
      buildQuickFilters();
      renderAll();
    });
  });
}

function setView(viewId) {
  state.currentView = viewId;
  saveState();

  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  const activeView = document.getElementById(`view-${viewId}`);
  if (activeView) activeView.classList.add("active");

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewId);
  });
}

function setRole(roleId) {
  state.currentRole = roleId;
  buildRoleButtons();
  renderHeader();
  renderAll();
}

function recordMatchesSearch(record) {
  if (!state.searchTerm.trim()) return true;
  return JSON.stringify(record).toLowerCase().includes(state.searchTerm.trim().toLowerCase());
}

function recordMatchesFilter(record) {
  if (state.currentFilter === "all") return true;

  const recordDate = String(record.created_at || record.scheduled_at || "").slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  switch (state.currentFilter) {
    case "high_intent":
      return Number(record.intent_score || 0) >= 80;
    case "needs_reply":
      return Boolean(record.requires_reply) || Boolean(record.is_unread);
    case "today":
      return recordDate === today;
    default:
      return true;
  }
}

function filterRows(rows) {
  return rows.filter((row) => recordMatchesFilter(row) && recordMatchesSearch(row));
}

function kpiCard(item) {
  return `
    <article class="kpi glass ${escapeHtml(item.tone)}">
      <small>${escapeHtml(item.label)}</small>
      <strong>${escapeHtml(item.value)}</strong>
      <span>${escapeHtml(item.sub)}</span>
    </article>
  `;
}

function metricRow(title, detail, value) {
  return `
    <article class="metric-row">
      <div>
        <div class="metric-title">${escapeHtml(title)}</div>
        <div class="small-note">${escapeHtml(detail)}</div>
      </div>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function infoCard(title, detail) {
  return `
    <article class="section-card">
      <div class="section-card-title">${escapeHtml(title)}</div>
      <div class="small-note">${escapeHtml(detail)}</div>
    </article>
  `;
}

function emptyState(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

function leadCard(lead) {
  const childLabel = lead.child_name ? `${lead.child_name} · Age ${lead.child_age ?? "—"}` : "Child record pending";

  return `
    <article class="lead-card">
      <div>
        <div class="lead-name">${escapeHtml(lead.family_name)}</div>
        <div class="lead-meta">
          ${escapeHtml(childLabel)} • ${escapeHtml(lead.location_name || "Unknown")} • ${escapeHtml(formatDateTime(lead.created_at))}
        </div>
        <div class="tag-row">
          <span class="tag status-${escapeHtml(lead.status)}">${escapeHtml(titleCase(lead.status))}</span>
          <span class="tag">Tour: ${escapeHtml(lead.tour_state || "none")}</span>
          <span class="tag">Source: ${escapeHtml(lead.source || "unknown")}</span>
          <span class="tag">Intent: ${escapeHtml(String(lead.intent_score || 0))}</span>
        </div>
      </div>
      <div class="small-note">${escapeHtml(lead.assigned_to_name || "Unassigned")}</div>
    </article>
  `;
}

function messageCard(message) {
  return `
    <article class="msg-row">
      <div class="section-card-title">${escapeHtml(message.sender_name || "Parent")}</div>
      <div class="small-note">${escapeHtml(message.body || "")}</div>
      <div class="tag-row message-tags">
        <span class="tag">Channel: ${escapeHtml(message.channel)}</span>
        <span class="tag">Assigned: ${escapeHtml(message.assigned_role || "team")}</span>
        <span class="tag">${escapeHtml(message.is_unread ? "Unread" : "Read")}</span>
      </div>
    </article>
  `;
}

function tourCard(tour) {
  return `
    <article class="tour-row">
      <div class="section-card-title">${escapeHtml(formatDateTime(tour.scheduled_at))} · ${escapeHtml(tour.family_name || "Family")}</div>
      <div class="small-note">
        ${escapeHtml(tour.child_name || "Child")} • ${escapeHtml(tour.location_name || "Unknown")} • ${escapeHtml(titleCase(tour.status))}
      </div>
    </article>
  `;
}

function renderHeader() {
  const meta = config.roleMeta[state.currentRole];
  elements.pageTitle.textContent = meta.title;
  elements.heroTitle.textContent = meta.heroTitle;
  elements.heroCopy.textContent = meta.heroCopy;
  elements.userPill.textContent = `${state.profile?.full_name || state.session?.user?.email || "User"} · ${titleCase(state.currentRole)}`;
}

function getRoleKpis() {
  const activeLocations = state.data.locations.filter((l) => l.is_active).length;
  const activeLeads = state.data.leads.filter((l) => l.status !== "lost").length;
  const enrolledLeads = state.data.leads.filter((l) => l.status === "enrolled").length;
  const openTours = state.data.tours.filter((t) => ["scheduled", "confirmed", "pending_confirmation"].includes(t.status)).length;
  const unreadMessages = state.data.messages.filter((m) => m.is_unread).length;
  const openCompliance = state.data.compliance.filter((c) => c.status !== "complete").length;

  if (state.currentRole === "executive") {
    return [
      { label: "Active Centers", value: String(activeLocations), sub: "live locations", tone: "gold" },
      { label: "Open Leads", value: String(activeLeads), sub: "portfolio pipeline", tone: "teal" },
      { label: "Lead → Enrolled", value: formatPercent(enrolledLeads, Math.max(state.data.leads.length, 1)), sub: "current conversion", tone: "blue" },
      { label: "Bulk Import Ready", value: "Yes", sub: "historical uploads", tone: "rose" }
    ];
  }

  if (state.currentRole === "director") {
    return [
      { label: "Visible Leads", value: String(state.data.leads.length), sub: "location-scoped CRM", tone: "gold" },
      { label: "Tours Scheduled", value: String(openTours), sub: "upcoming tours", tone: "teal" },
      { label: "Unread Messages", value: String(unreadMessages), sub: "waiting for response", tone: "blue" },
      { label: "Open Compliance", value: String(openCompliance), sub: "active center items", tone: "rose" }
    ];
  }

  return [
    { label: "New Leads", value: String(state.data.leads.filter((l) => l.status === "new").length), sub: "not yet worked", tone: "gold" },
    { label: "Tours Booked", value: String(openTours), sub: "scheduled or confirmed", tone: "teal" },
    { label: "High Intent", value: String(state.data.leads.filter((l) => Number(l.intent_score || 0) >= 80).length), sub: "priority families", tone: "blue" },
    { label: "Enrolled", value: String(enrolledLeads), sub: "closed-won families", tone: "rose" }
  ];
}

function renderKpis() {
  elements.kpis.innerHTML = getRoleKpis().map(kpiCard).join("");
}

function renderLeadAdminPanel() {
  const locations = getAccessibleLocations();
  const options = locations.map((location) => {
    const label = `${location.name}${location.code ? ` (${location.code})` : ""}`;
    return `<option value="${escapeHtml(location.id)}">${escapeHtml(label)}</option>`;
  }).join("");

  const manualForm = canCreateLeadsManually() ? `
    <div class="panel glass">
      <div class="panel-head">
        <h3>Manual Lead Entry</h3>
        <span class="chip">Location input</span>
      </div>

      <form class="panel-form" id="manualLeadForm">
        <div class="form-grid">
          <label class="field">
            <span>Family Name</span>
            <input name="family_name" required placeholder="Ashley Rodriguez" />
          </label>

          <label class="field">
            <span>Child Name</span>
            <input name="child_name" placeholder="Lucas" />
          </label>

          <label class="field">
            <span>Child Age</span>
            <input name="child_age" type="number" min="0" max="18" placeholder="3" />
          </label>

          <label class="field">
            <span>Lead Source</span>
            <input name="source" placeholder="Website Form, Walk-In, Referral..." />
          </label>

          <label class="field">
            <span>Location</span>
            <select name="location_id" ${state.currentRole !== "executive" ? "disabled" : ""}>${options}</select>
          </label>

          <label class="field">
            <span>Status</span>
            <select name="status">
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="tour_scheduled">Tour Scheduled</option>
              <option value="application_started">Application Started</option>
              <option value="enrolled">Enrolled</option>
              <option value="lost">Lost</option>
            </select>
          </label>

          <label class="field field-full">
            <span>Notes</span>
            <textarea name="notes" placeholder="Anything the team should know about this family..."></textarea>
          </label>
        </div>

        <div class="form-actions">
          <button type="submit" class="top-btn">Save Lead</button>
        </div>

        <div class="small-note" id="manualLeadMessage"></div>
      </form>
    </div>
  ` : "";

  const bulkImport = canUseBulkImport() ? `
    <div class="panel glass">
      <div class="panel-head">
        <h3>Corporate Bulk Lead Upload</h3>
        <span class="chip">CSV import</span>
      </div>

      <form class="panel-form" id="bulkLeadForm">
        <div class="upload-help">
          Upload a CSV with these headers:
          <div class="code-inline">${escapeHtml(config.leadImportTemplateHeaders.join(", "))}</div>
          <br />
          Required: <span class="code-inline">family_name</span>, <span class="code-inline">location_code</span>
        </div>

        <label class="field">
          <span>CSV File</span>
          <input id="bulkLeadFile" type="file" accept=".csv,text/csv" required />
        </label>

        <div class="form-actions">
          <button type="submit" class="top-btn">Upload Leads</button>
        </div>

        <div class="small-note" id="bulkLeadMessage"></div>
      </form>
    </div>
  ` : "";

  if (!manualForm && !bulkImport) return "";
  return `<div class="two-col">${manualForm || "<div></div>"}${bulkImport || "<div></div>"}</div>`;
}

function renderOverview() {
  const leads = filterRows(state.data.leads).slice(0, 4);
  const leadMarkup = leads.length ? leads.map(leadCard).join("") : emptyState("No lead matches the current filters.");

  elements.viewOverview.innerHTML = `
    ${renderLeadAdminPanel()}

    <div class="two-col">
      <div class="panel glass">
        <div class="panel-head">
          <h3>Lead Intake Feed</h3>
          <span class="chip">Supabase live</span>
        </div>
        <div class="feed">${leadMarkup}</div>
      </div>

      <div class="panel glass">
        <div class="panel-head">
          <h3>Lead CRM Visibility</h3>
          <span class="chip">Go-live ready</span>
        </div>
        <div class="section-list">
          ${infoCard("Location Lead Access", "Directors and admissions can work leads visible to their location.")}
          ${infoCard("Corporate Import", "Executive users can bulk upload historical leads and route them by location code.")}
          ${infoCard("Manual Entry", "Location users can create new leads directly inside the CRM.")}
        </div>
      </div>
    </div>
  `;

  bindLeadAdminEvents();
}

function renderPipeline() {
  const leads = filterRows(state.data.leads);
  const buckets = {
    new: [],
    contacted: [],
    tour_scheduled: [],
    application_started: [],
    enrolled: []
  };

  leads.forEach((lead) => {
    if (buckets[lead.status]) buckets[lead.status].push(lead);
  });

  const renderBucket = (items) => {
    if (!items.length) return emptyState("No matching records.");
    return items.map((item) => `
      <div class="kanban-card">
        <strong>${escapeHtml(item.family_name)}</strong>
        <div class="small-note">
          ${escapeHtml(item.child_name || "Child")} · ${escapeHtml(item.location_name || "Unknown")} · ${escapeHtml(item.source || "unknown")}
        </div>
      </div>
    `).join("");
  };

  elements.viewPipeline.innerHTML = `
    <div class="panel glass">
      <div class="panel-head">
        <h3>Admissions Pipeline</h3>
        <span class="chip">Live statuses</span>
      </div>
      <div class="kanban">
        <div class="kanban-col"><h4>New Inquiry</h4>${renderBucket(buckets.new)}</div>
        <div class="kanban-col"><h4>Contacted</h4>${renderBucket(buckets.contacted)}</div>
        <div class="kanban-col"><h4>Tour Scheduled</h4>${renderBucket(buckets.tour_scheduled)}</div>
        <div class="kanban-col"><h4>Application Started</h4>${renderBucket(buckets.application_started)}</div>
        <div class="kanban-col"><h4>Enrolled</h4>${renderBucket(buckets.enrolled)}</div>
      </div>
    </div>
  `;
}

function renderTours() {
  const tours = filterRows(state.data.tours);
  const markup = tours.length ? tours.map(tourCard).join("") : emptyState("No tours match the current filters.");

  elements.viewTours.innerHTML = `
    <div class="two-col">
      <div class="panel glass">
        <div class="panel-head"><h3>Upcoming Tours</h3><span class="chip">Calendar-ready</span></div>
        <div class="tour-list">${markup}</div>
      </div>

      <div class="panel glass">
        <div class="panel-head"><h3>Tour Metrics</h3><span class="chip">Live data</span></div>
        <div class="metric-list">
          ${metricRow("Tours Scheduled", "Scheduled or confirmed rows.", String(state.data.tours.filter((t) => ["scheduled", "confirmed", "pending_confirmation"].includes(t.status)).length))}
          ${metricRow("Completed Tours", "Finished visits.", String(state.data.tours.filter((t) => t.status === "completed").length))}
          ${metricRow("Pending Confirmation", "Needs family confirmation.", String(state.data.tours.filter((t) => t.status === "pending_confirmation").length))}
          ${metricRow("No Shows", "Recovery workflow needed.", String(state.data.tours.filter((t) => t.status === "no_show").length))}
        </div>
      </div>
    </div>
  `;
}

function renderOperations() {
  const classrooms = filterRows(state.data.classrooms);
  const staffing = filterRows(state.data.staffing);
  const capacity = classrooms.reduce((sum, c) => sum + Number(c.capacity || 0), 0);

  elements.viewOperations.innerHTML = `
    <div class="three-col">
      <div class="panel glass">
        <div class="panel-head"><h3>Center Readiness</h3><span class="chip">Live data</span></div>
        <div class="metric-list">
          ${metricRow("Configured Classrooms", "Current room count.", String(classrooms.length))}
          ${metricRow("Total Capacity", "Sum of classroom capacity.", String(capacity))}
          ${metricRow("Visible Tours", "Tours in current scope.", String(state.data.tours.length))}
        </div>
      </div>

      <div class="panel glass">
        <div class="panel-head"><h3>Staffing Alerts</h3><span class="chip">Live data</span></div>
        <div class="metric-list">
          ${metricRow("Active Assignments", "Open staffing assignments.", String(staffing.length))}
          ${metricRow("Lead Teachers", "Assignments marked lead_teacher.", String(staffing.filter((s) => s.role_name === "lead_teacher").length))}
          ${metricRow("Float Teachers", "Assignments marked float_teacher.", String(staffing.filter((s) => s.role_name === "float_teacher").length))}
        </div>
      </div>

      <div class="panel glass">
        <div class="panel-head"><h3>Director Tasks</h3><span class="chip">Live data</span></div>
        <div class="metric-list">
          ${metricRow("Unread Parent Messages", "Messages needing review.", String(state.data.messages.filter((m) => m.is_unread).length))}
          ${metricRow("Open Compliance", "Items not marked complete.", String(state.data.compliance.filter((c) => c.status !== "complete").length))}
          ${metricRow("Open Leads", "Leads still in funnel.", String(state.data.leads.filter((l) => l.status !== "enrolled" && l.status !== "lost").length))}
        </div>
      </div>
    </div>
  `;
}

function renderParentComms() {
  const messages = filterRows(state.data.messages);
  const markup = messages.length ? messages.map(messageCard).join("") : emptyState("No communication items match the current filters.");

  elements.viewParentComms.innerHTML = `
    <div class="two-col">
      <div class="panel glass">
        <div class="panel-head"><h3>Parent Communication Hub</h3><span class="chip">Live inbox data</span></div>
        <div class="msg-list">${markup}</div>
      </div>

      <div class="panel glass">
        <div class="panel-head"><h3>Communication Stats</h3><span class="chip">Live data</span></div>
        <div class="metric-list">
          ${metricRow("Messages", "Total communication rows.", String(state.data.messages.length))}
          ${metricRow("Unread", "Still need review.", String(state.data.messages.filter((m) => m.is_unread).length))}
          ${metricRow("Needs Reply", "Actionable communications.", String(state.data.messages.filter((m) => m.requires_reply).length))}
          ${metricRow("SMS Threads", "Channel breakdown.", String(state.data.messages.filter((m) => m.channel === "sms").length))}
        </div>
      </div>
    </div>
  `;
}

function renderCompliance() {
  const items = filterRows(state.data.compliance);
  const left = items.length ? items.map((item) => metricRow(item.title, item.detail || "", titleCase(item.status))).join("") : emptyState("No compliance items match the current filters.");

  elements.viewCompliance.innerHTML = `
    <div class="two-col">
      <div class="panel glass">
        <div class="panel-head"><h3>Compliance Items</h3><span class="chip">Live data</span></div>
        <div class="metric-list">${left}</div>
      </div>

      <div class="panel glass">
        <div class="panel-head"><h3>Compliance Health</h3><span class="chip">Live status</span></div>
        <div class="metric-list">
          ${metricRow("Open", "Not yet complete.", String(state.data.compliance.filter((c) => c.status === "open").length))}
          ${metricRow("Due Soon", "Marked due_soon.", String(state.data.compliance.filter((c) => c.status === "due_soon").length))}
          ${metricRow("Overdue", "Marked overdue.", String(state.data.compliance.filter((c) => c.status === "overdue").length))}
          ${metricRow("Complete", "Closed items.", String(state.data.compliance.filter((c) => c.status === "complete").length))}
        </div>
      </div>
    </div>
  `;
}

function renderAI() {
  const sortedLeads = [...state.data.leads].sort((a, b) => Number(b.intent_score || 0) - Number(a.intent_score || 0));
  const topLead = sortedLeads[0];
  const topLocation = state.data.locations[0];

  elements.viewAI.innerHTML = `
    <div class="two-col">
      <div class="panel glass">
        <div class="panel-head"><h3>AI Copilot</h3><span class="chip">Rule-based for now</span></div>
        <div class="metric-list">
          <article class="ai-card">
            <div class="ai-card-top"><strong>Lead Priority Insight</strong><span class="ai-badge">Predicted</span></div>
            <div class="small-note">${escapeHtml(topLead ? `${topLead.family_name} has the highest intent score at ${topLead.intent_score}.` : "No leads available yet.")}</div>
          </article>
          <article class="ai-card">
            <div class="ai-card-top"><strong>Suggested Follow-up</strong><span class="ai-badge">Draft</span></div>
            <div class="small-note">${escapeHtml(topLead ? `Hi ${topLead.family_name}, we’d love to help you explore availability for ${topLead.child_name}. Let’s confirm your next step today.` : "No follow-up suggestions available.")}</div>
          </article>
          <article class="ai-card">
            <div class="ai-card-top"><strong>Staffing Risk Alert</strong><span class="ai-badge">Forecast</span></div>
            <div class="small-note">Seeded staffing data is available. Next upgrade: compare classroom capacity versus assigned teachers in real time.</div>
          </article>
          <article class="ai-card">
            <div class="ai-card-top"><strong>Enrollment Forecast</strong><span class="ai-badge">Projected</span></div>
            <div class="small-note">${escapeHtml(topLocation ? `${topLocation.name} has live visibility through leads, tours, and messages.` : "No locations available yet.")}</div>
          </article>
        </div>
      </div>

      <div class="panel glass">
        <div class="panel-head"><h3>AI Queue</h3><span class="chip">Next step ready</span></div>
        <div class="metric-list">
          ${metricRow("High-intent leads", "Intent score 80 or above.", String(state.data.leads.filter((l) => Number(l.intent_score || 0) >= 80).length))}
          ${metricRow("Needs same-day reply", "Unread or requires reply.", String(state.data.messages.filter((m) => m.requires_reply || m.is_unread).length))}
          ${metricRow("Potential no-shows", "Pending confirmation tours.", String(state.data.tours.filter((t) => t.status === "pending_confirmation").length))}
          ${metricRow("Fresh imports", "Historical and new lead rows supported.", String(state.data.leads.length))}
        </div>
      </div>
    </div>
  `;
}

function renderAll() {
  renderHeader();
  renderKpis();
  renderOverview();
  renderPipeline();
  renderTours();
  renderOperations();
  renderParentComms();
  renderCompliance();
  renderAI();
  setView(state.currentView);
}

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

async function loadData() {
  const [
    locationsRes,
    leadsRes,
    toursRes,
    messagesRes,
    complianceRes,
    classroomsRes,
    staffingRes
  ] = await Promise.all([
    supabase.from("locations").select("*").order("name"),
    supabase.from("crm_leads_expanded").select("*").order("created_at", { ascending: false }),
    supabase.from("crm_tours_expanded").select("*").order("scheduled_at", { ascending: true }),
    supabase.from("crm_messages_expanded").select("*").order("created_at", { ascending: false }),
    supabase.from("compliance_items").select("*").order("created_at", { ascending: false }),
    supabase.from("classrooms").select("*").order("name"),
    supabase.from("staff_assignments").select("*").order("created_at", { ascending: false })
  ]);

  const all = [locationsRes, leadsRes, toursRes, messagesRes, complianceRes, classroomsRes, staffingRes];
  const failing = all.find((res) => res.error);
  if (failing?.error) throw failing.error;

  state.data.locations = locationsRes.data || [];
  state.data.leads = leadsRes.data || [];
  state.data.tours = toursRes.data || [];
  state.data.messages = messagesRes.data || [];
  state.data.compliance = complianceRes.data || [];
  state.data.classrooms = classroomsRes.data || [];
  state.data.staffing = staffingRes.data || [];
}

async function createLead(payload) {
  const insertPayload = {
    location_id: payload.location_id,
    assigned_to: payload.assigned_to || null,
    family_name: payload.family_name,
    child_name: payload.child_name || null,
    child_age: payload.child_age ? Number(payload.child_age) : null,
    source: payload.source || "Manual Entry",
    status: payload.status || "new",
    tour_state: payload.tour_state || "none",
    intent_score: payload.intent_score ? Number(payload.intent_score) : 50,
    notes: payload.notes || null,
    imported_by: payload.imported_by || null,
    import_batch: payload.import_batch || null
  };

  if (payload.created_at) insertPayload.created_at = payload.created_at;

  const { error } = await supabase.from("leads").insert(insertPayload);
  if (error) throw error;
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function parseCsv(text) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim());

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

async function handleManualLeadSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const accessibleLocations = getAccessibleLocations();
  const locationId = state.currentRole === "executive"
    ? String(formData.get("location_id") || "")
    : accessibleLocations[0]?.id;

  try {
    showInlineMessage("manualLeadMessage", "Saving lead...");
    await createLead({
      location_id: locationId,
      assigned_to: state.profile?.id || null,
      family_name: String(formData.get("family_name") || "").trim(),
      child_name: String(formData.get("child_name") || "").trim(),
      child_age: String(formData.get("child_age") || "").trim(),
      source: String(formData.get("source") || "").trim() || "Manual Entry",
      status: String(formData.get("status") || "new"),
      notes: String(formData.get("notes") || "").trim()
    });

    form.reset();
    await loadData();
    renderAll();
    showInlineMessage("manualLeadMessage", "Lead saved successfully.");
  } catch (error) {
    showInlineMessage("manualLeadMessage", error.message || "Unable to save lead.", true);
  }
}

async function handleBulkLeadSubmit(event) {
  event.preventDefault();

  const fileInput = document.getElementById("bulkLeadFile");
  const file = fileInput?.files?.[0];

  if (!file) {
    showInlineMessage("bulkLeadMessage", "Choose a CSV file first.", true);
    return;
  }

  try {
    showInlineMessage("bulkLeadMessage", "Reading CSV...");
    const text = await file.text();
    const rows = parseCsv(text);

    if (!rows.length) {
      throw new Error("The CSV file is empty or missing data rows.");
    }

    const locationCodeMap = new Map(
      state.data.locations
        .filter((location) => location.code)
        .map((location) => [String(location.code).toLowerCase(), location.id])
    );

    const batchId = `import-${Date.now()}`;

    const inserts = rows.map((row, index) => {
      const locationCode = String(row.location_code || "").trim().toLowerCase();
      const locationId = locationCodeMap.get(locationCode);

      if (!row.family_name?.trim()) {
        throw new Error(`Row ${index + 2}: family_name is required.`);
      }

      if (!locationId) {
        throw new Error(`Row ${index + 2}: location_code "${row.location_code}" was not found.`);
      }

      return {
        location_id: locationId,
        assigned_to: null,
        family_name: row.family_name.trim(),
        child_name: row.child_name?.trim() || null,
        child_age: row.child_age ? Number(row.child_age) : null,
        source: row.source?.trim() || "Corporate Import",
        status: row.status?.trim() || "new",
        tour_state: row.tour_state?.trim() || "none",
        intent_score: row.intent_score ? Number(row.intent_score) : 50,
        notes: row.notes?.trim() || "Imported from corporate CSV",
        imported_by: state.profile?.id || null,
        import_batch: batchId,
        created_at: row.created_at?.trim() || new Date().toISOString()
      };
    });

    showInlineMessage("bulkLeadMessage", `Uploading ${inserts.length} leads...`);

    const { error } = await supabase.from("leads").insert(inserts);
    if (error) throw error;

    fileInput.value = "";
    await loadData();
    renderAll();
    showInlineMessage("bulkLeadMessage", `Uploaded ${inserts.length} leads successfully.`);
  } catch (error) {
    showInlineMessage("bulkLeadMessage", error.message || "Bulk import failed.", true);
  }
}

function bindLeadAdminEvents() {
  const manualLeadForm = document.getElementById("manualLeadForm");
  const bulkLeadForm = document.getElementById("bulkLeadForm");

  if (manualLeadForm) {
    const locationSelect = manualLeadForm.querySelector('select[name="location_id"]');
    const locations = getAccessibleLocations();
    if (locationSelect && locations[0]) locationSelect.value = locations[0].id;
    manualLeadForm.addEventListener("submit", handleManualLeadSubmit);
  }

  if (bulkLeadForm) {
    bulkLeadForm.addEventListener("submit", handleBulkLeadSubmit);
  }
}

async function signInWithGoogle() {
  const selectedRole = getSelectedLoginRole();

  if (!selectedRole) {
    setAuthMessage("Choose your account type first.", true);
    return;
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.href
    }
  });

  if (error) throw error;
}

async function showAppForSession(session) {
  state.session = session;
  state.profile = await loadProfile(session.user.id);

  const selectedLoginRole = getSelectedLoginRole();
  if (selectedLoginRole && state.profile?.role && selectedLoginRole !== state.profile.role) {
    setAuthMessage(`Signed in successfully. Your actual account access is ${titleCase(state.profile.role)}.`);
  }

  state.currentRole = ["executive", "director", "admissions"].includes(state.profile?.role)
    ? state.profile.role
    : "director";

  buildRoleButtons();
  buildNav();
  buildQuickFilters();

  await loadData();
  renderAll();

  elements.authShell.classList.add("hidden");
  elements.appShell.classList.remove("hidden");
}

function showAuth() {
  elements.appShell.classList.add("hidden");
  elements.authShell.classList.remove("hidden");
}

async function handleSignOut() {
  await supabase.auth.signOut();
  showAuth();
}

function bindEvents() {
  if (elements.authRoleSwitch) {
    elements.authRoleSwitch.querySelectorAll(".auth-role-btn").forEach((button) => {
      button.addEventListener("click", () => {
        setSelectedLoginRole(button.dataset.loginRole);
        updateAuthRoleButtons();
        setAuthMessage(`Selected ${titleCase(button.dataset.loginRole)} login. Continue with Google.`);
      });
    });
  }

  if (elements.googleSignInBtn) {
    elements.googleSignInBtn.addEventListener("click", async () => {
      try {
        setAuthMessage("Redirecting to Google...");
        await signInWithGoogle();
      } catch (error) {
        setAuthMessage(error.message || "Unable to sign in with Google.", true);
      }
    });
  }

  elements.signOutBtn.addEventListener("click", handleSignOut);

  elements.globalSearch.addEventListener("input", (event) => {
    state.searchTerm = event.target.value;
    renderAll();
  });

  elements.refreshBtn.addEventListener("click", async () => {
    await loadData();
    renderAll();
  });
}

async function init() {
  bindEvents();
  updateAuthRoleButtons();

  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    try {
      await showAppForSession(session);
    } catch (error) {
      console.error(error);
      showAuth();
      setAuthMessage(`Startup failed: ${error.message}`, true);
    }
  } else {
    showAuth();
  }

  supabase.auth.onAuthStateChange(async (_event, nextSession) => {
    if (!nextSession) {
      showAuth();
      return;
    }

    try {
      await showAppForSession(nextSession);
    } catch (error) {
      console.error(error);
      showAuth();
      setAuthMessage(`Session load failed: ${error.message}`, true);
    }
  });
}

init();

