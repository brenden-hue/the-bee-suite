(() => {
  "use strict";

  const DEFAULT_VIEWS = [
    { id: "overview", label: "Overview" },
    { id: "pipeline", label: "Lead Pipeline" },
    { id: "tours", label: "Tours" },
    { id: "operations", label: "Operations" },
    { id: "parentComms", label: "Parent Comms" },
    { id: "compliance", label: "Compliance" },
    { id: "ai", label: "AI Copilot" }
  ];

  const DEFAULT_QUICK_FILTERS = [
    { id: "all", label: "All Data" },
    { id: "orlando", label: "Orlando" },
    { id: "high_intent", label: "High Intent" },
    { id: "needs_reply", label: "Needs Reply" },
    { id: "today", label: "Today" }
  ];

  const DEFAULT_ROLE_META = {
    executive: {
      label: "Executive View",
      title: "Executive Command Center",
      heroTitle: "Portfolio-wide visibility for Kid City USA",
      heroCopy:
        "See enrollment health, center readiness, staffing coverage, parent engagement, and lead flow across the portfolio."
    },
    director: {
      label: "Director View",
      title: "Center Operations Command",
      heroTitle: "Run the center without losing the big picture",
      heroCopy:
        "Watch leads, tours, staffing, parent communication, classroom readiness, and compliance from one screen."
    },
    admissions: {
      label: "Admissions View",
      title: "Admissions Growth Hub",
      heroTitle: "Move families from inquiry to enrollment faster",
      heroCopy:
        "Use the lead pipeline, tour scheduling, follow-up queue, and conversion signals to keep momentum high."
    }
  };

  async function loadAllData() {
  const isCorporate = state.profile.role === "executive";

  function applyLocationFilter(query) {
    if (!isCorporate) {
      return query.eq("location_id", state.profile.location_id);
    }
    return query;
  }

  // LEADS
  {
    let q = supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    q = applyLocationFilter(q);

    const { data } = await q;
    state.data.leads = data || [];
  }

  // TOURS
  {
    let q = supabase
      .from("tours")
      .select("*")
      .order("tour_at", { ascending: true });

    q = applyLocationFilter(q);

    const { data } = await q;
    state.data.tours = data || [];
  }

  // MESSAGES
  {
    let q = supabase.from("messages").select("*");
    q = applyLocationFilter(q);

    const { data } = await q;
    state.data.messages = data || [];
  }

  // CLASSROOMS
  {
    let q = supabase.from("classrooms").select("*");
    q = applyLocationFilter(q);

    const { data } = await q;
    state.data.classrooms = data || [];
  }

  // STAFFING
  {
    let q = supabase.from("staffing").select("*");
    q = applyLocationFilter(q);

    const { data } = await q;
    state.data.staffing = data || [];
  }

  // COMPLIANCE
  {
    let q = supabase.from("compliance").select("*");
    q = applyLocationFilter(q);

    const { data } = await q;
    state.data.compliance = data || [];
  }
}
  const STORAGE_KEYS = {
    loginRole: "kidcity-login-role",
    view: "kidcity-view",
    filter: "kidcity-filter"
  };

  const rawConfig = window.CRM_CONFIG || {};
  const config = {
    supabaseUrl: rawConfig.supabaseUrl || "",
    supabaseAnonKey: rawConfig.supabaseAnonKey || "",
    views: Array.isArray(rawConfig.views) && rawConfig.views.length ? rawConfig.views : DEFAULT_VIEWS,
    quickFilters:
      Array.isArray(rawConfig.quickFilters) && rawConfig.quickFilters.length
        ? rawConfig.quickFilters
        : DEFAULT_QUICK_FILTERS,
    roleMeta:
      rawConfig.roleMeta && typeof rawConfig.roleMeta === "object"
        ? { ...DEFAULT_ROLE_META, ...rawConfig.roleMeta }
        : DEFAULT_ROLE_META
  };

  const state = {
    session: null,
    profile: null,
    locationsById: new Map(),
    currentRole: "director",
    currentView: localStorage.getItem(STORAGE_KEYS.view) || "overview",
    currentFilter: localStorage.getItem(STORAGE_KEYS.filter) || "all",
    searchTerm: "",
    data: ()
  };

  const elements = {
    authShell: document.getElementById("authShell"),
    appShell: document.getElementById("appShell"),
    authRoleSwitch: document.getElementById("authRoleSwitch"),
    authMessage: document.getElementById("authMessage"),
    emailInput: document.getElementById("emailInput"),
    passwordInput: document.getElementById("passwordInput"),
    loginBtn: document.getElementById("loginBtn"),
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

  const createClient = window.supabase?.createClient;
  const configLooksReady =
    config.supabaseUrl &&
    config.supabaseAnonKey &&
    config.supabaseUrl !== "YOUR_SUPABASE_URL" &&
    config.supabaseAnonKey !== "YOUR_SUPABASE_ANON_KEY";

  const supabase =
    configLooksReady && typeof createClient === "function"
      ? createClient(config.supabaseUrl, config.supabaseAnonKey)
      : null;

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
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function structuredCloneFallback(value) {
    return JSON.parse(JSON.stringify(value));
  }



  function saveState() {
    localStorage.setItem(STORAGE_KEYS.view, state.currentView);
    localStorage.setItem(STORAGE_KEYS.filter, state.currentFilter);
  }

  function setAuthMessage(message, isError = false) {
    if (!elements.authMessage) return;

    elements.authMessage.textContent = message;
    elements.authMessage.classList.toggle("auth-message-error", Boolean(isError));
  }

  function getSelectedLoginRole() {
    return localStorage.getItem(STORAGE_KEYS.loginRole) || "";
  }

  function setSelectedLoginRole(role) {
    localStorage.setItem(STORAGE_KEYS.loginRole, role);
  }

  function updateAuthRoleButtons() {
    const selectedRole = getSelectedLoginRole();

    elements.authRoleSwitch?.querySelectorAll(".auth-role-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.loginRole === selectedRole);
    });
  }

  function showAuth() {
    elements.appShell?.classList.add("hidden");
    elements.authShell?.classList.remove("hidden");
  }

  function showApp() {
    elements.authShell?.classList.add("hidden");
    elements.appShell?.classList.remove("hidden");
  }

  function resolveDashboardRole(profile) {
    const selectedRole = getSelectedLoginRole();

    if (selectedRole && config.roleMeta[selectedRole]) {
      return selectedRole;
    }

    if (profile?.role === "manager") return "director";
    if (profile?.role === "staff") return "admissions";

    return "director";
  }

  function locationNameFor(locationId) {
    return state.locationsById.get(locationId)?.name || "Assigned Center";
  }

  function renderRole() {
    const role = config.roleMeta[state.currentRole] || DEFAULT_ROLE_META.director;
    const profileName = state.profile?.full_name || state.session?.user?.email || "Signed-in User";
    const locationName = state.profile?.location_id ? locationNameFor(state.profile.location_id) : "CRM";

    elements.pageTitle.textContent = role.title;
    elements.heroTitle.textContent = role.heroTitle;
    elements.heroCopy.textContent = role.heroCopy;
    elements.userPill.textContent = `${profileName} · ${locationName}`;
    elements.kpis.innerHTML = buildKpis().map(kpiCard).join("");
  }

  function buildRoleButtons() {
    elements.roleSwitch.innerHTML = Object.entries(config.roleMeta)
      .map(([roleKey, roleValue]) => {
        const active = roleKey === state.currentRole ? "active" : "";

        return `
          <button
            class="role-btn ${active}"
            type="button"
            data-role="${escapeHtml(roleKey)}"
          >
            ${escapeHtml(roleValue.label)}
          </button>
        `;
      })
      .join("");

    elements.roleSwitch.querySelectorAll(".role-btn").forEach((button) => {
      button.addEventListener("click", () => setRole(button.dataset.role));
    });
  }

  function buildNav() {
    elements.mainNav.innerHTML = config.views
      .map((view) => {
        const active = view.id === state.currentView ? "active" : "";

        return `
          <button
            class="nav-btn ${active}"
            type="button"
            data-view="${escapeHtml(view.id)}"
          >
            ${escapeHtml(view.label)}
          </button>
        `;
      })
      .join("");

    elements.mainNav.querySelectorAll(".nav-btn").forEach((button) => {
      button.addEventListener("click", () => setView(button.dataset.view));
    });
  }

  function buildQuickFilters() {
    elements.quickFilters.innerHTML = config.quickFilters
      .map((filter) => {
        const active = filter.id === state.currentFilter ? "active" : "";

        return `
          <button
            class="chip-btn ${active}"
            type="button"
            data-filter="${escapeHtml(filter.id)}"
          >
            ${escapeHtml(filter.label)}
          </button>
        `;
      })
      .join("");

    elements.quickFilters.querySelectorAll("[data-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.currentFilter = button.dataset.filter;
        saveState();
        buildQuickFilters();
        renderAllViews();
      });
    });
  }

  function buildKpis() {
    const openLeads = state.data.leads.filter((lead) => lead.status !== "enrolled").length;
    const todayTours = state.data.tours.filter((tour) => Array.isArray(tour.tags) && tour.tags.includes("today")).length;
    const needsReply = state.data.messages.filter(
      (message) => Array.isArray(message.tags) && message.tags.includes("needs_reply")
    ).length;
    const locations =
      state.locationsById.size ||
      new Set(state.data.leads.map((lead) => lead.location).filter(Boolean)).size ||
      1;

    return [
      { label: "Open Leads", value: String(openLeads), sub: "Across your visible pipeline", tone: "gold" },
      { label: "Tours Today", value: String(todayTours), sub: "Confirmed and pending visits", tone: "teal" },
      { label: "Needs Reply", value: String(needsReply), sub: "Messages waiting in queue", tone: "rose" },
      { label: "Active Locations", value: String(locations), sub: "Visible to this account", tone: "blue" }
    ];
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
    return `
      <article class="lead-card">
        <div>
          <div class="lead-name">${escapeHtml(lead.name)}</div>
          <div class="lead-meta">
            ${escapeHtml(lead.child)} • ${escapeHtml(lead.location)} • ${escapeHtml(lead.date)}
          </div>
          <div class="tag-row">
            <span class="tag status-${escapeHtml(lead.status)}">${escapeHtml(titleCase(lead.status))}</span>
            <span class="tag">Tour: ${escapeHtml(lead.tour)}</span>
            <span class="tag">Source: ${escapeHtml(lead.source)}</span>
          </div>
        </div>
        <div class="small-note">Assigned workflow ready</div>
      </article>
    `;
  }

  function tourCard(tour) {
    return `
      <article class="tour-row">
        <div class="section-card-title">${escapeHtml(tour.time)} · ${escapeHtml(tour.family)}</div>
        <div class="small-note">
          ${escapeHtml(tour.child)} • ${escapeHtml(tour.location)} • ${escapeHtml(tour.status)}
        </div>
      </article>
    `;
  }

  function messageCard(message) {
    return `
      <article class="msg-row">
        <div class="section-card-title">${escapeHtml(message.from)}</div>
        <div class="small-note">${escapeHtml(message.body)}</div>
        <div class="tag-row message-tags">
          <span class="tag">Assigned: ${escapeHtml(message.assigned)}</span>
          <span class="tag">${escapeHtml(message.time)}</span>
        </div>
      </article>
    `;
  }

  function matchesSearch(item) {
    if (!state.searchTerm.trim()) return true;

    const haystack = Object.values(item)
      .filter((value) => typeof value === "string" || Array.isArray(value))
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .join(" ")
      .toLowerCase();

    return haystack.includes(state.searchTerm.trim().toLowerCase());
  }

  function matchesQuickFilter(item) {
    if (state.currentFilter === "all") return true;

    const tags = Array.isArray(item.tags) ? item.tags : [];
    const text = JSON.stringify(item).toLowerCase();

    if (state.currentFilter === "orlando") {
      return tags.includes("orlando") || text.includes("orlando");
    }

    if (state.currentFilter === "high_intent") {
      return tags.includes("high_intent");
    }

    if (state.currentFilter === "needs_reply") {
      return tags.includes("needs_reply");
    }

    if (state.currentFilter === "today") {
      return tags.includes("today") || text.includes("today");
    }

    return true;
  }

  function filterItems(items) {
    return items.filter((item) => matchesQuickFilter(item) && matchesSearch(item));
  }

  function getFilteredData() {
    return {
      leads: filterItems(state.data.leads),
      tours: filterItems(state.data.tours),
      messages: filterItems(state.data.messages),
      compliance: filterItems(state.data.compliance),
      billingActivity: filterItems(state.data.billingActivity)
    };
  }

  function renderOverview(filtered) {
    const leadsMarkup = filtered.leads.length
      ? filtered.leads.slice(0, 4).map(leadCard).join("")
      : emptyState("No lead matches for the current search/filter.");

    elements.viewOverview.innerHTML = `
      <div class="two-col">
        <div class="panel glass">
          <div class="panel-head">
            <h3>Lead Intake Feed</h3>
            <span class="chip">${state.session ? "Live CRM" : "Sample data"}</span>
          </div>
          <div class="feed">${leadsMarkup}</div>
        </div>

        <div class="panel glass">
          <div class="panel-head">
            <h3>Designed Now, Wire Later</h3>
            <span class="chip">Operational modules</span>
          </div>
          <div class="section-list">
            ${infoCard("Enrollment Forecasting", "Open applications, waitlist demand, and future seat pressure by age group and center.")}
            ${infoCard("Staffing Visibility", "Coverage, open shifts, certifications, float teachers, and classroom ratio support.")}
            ${infoCard("Parent Communication Hub", "Message threads, confirmations, reminders, and center-wide communication history.")}
          </div>
        </div>
      </div>

      <div class="three-col">
        <div class="panel glass">
          <div class="panel-head"><h3>Enrollment</h3><span class="chip">ready</span></div>
          <div class="metric-list">
            ${metricRow("Open Applications", "Families moving through the enrollment flow.", String(filtered.leads.length))}
            ${metricRow("Waitlist Demand", "Sorted by age group and location.", "18")}
            ${metricRow("Monthly Forecast", "Projected increase in pre-k demand.", "+12%")}
          </div>
        </div>

        <div class="panel glass">
          <div class="panel-head"><h3>Operations</h3><span class="chip">future adapter</span></div>
          <div class="metric-list">
            ${metricRow("Classroom Ratios", "Healthy in most rooms, two nearing threshold.", "Healthy")}
            ${metricRow("Staff Coverage", "Scheduled vs required coverage.", "96%")}
            ${metricRow("Safety Checks", "Center readiness tasks due today.", "4 due")}
          </div>
        </div>

        <div class="panel glass">
          <div class="panel-head"><h3>Finance</h3><span class="chip">future adapter</span></div>
          <div class="metric-list">
            ${metricRow("Monthly Billing", "Billing adapter placeholder.", "$286k")}
            ${metricRow("Past Due", "Collections workflow ready.", "$9.7k")}
            ${metricRow("Autopay Success", "Gateway integration later.", "94%")}
          </div>
        </div>
      </div>
    `;
  }

 function renderPipeline() {
  const stages = {
    new: [],
    contacted: [],
    tour_scheduled: [],
    application_started: [],
    enrolled: []
  };

  state.data.leads.forEach(lead => {
    const stage = lead.status || "new";
    if (stages[stage]) stages[stage].push(lead);
  });

  function column(title, items) {
    return `
      <div class="kanban-col">
        <h4>${title}</h4>
        ${items.map(l => `
          <div class="kanban-card">
            <strong>${l.family_name || "No Name"}</strong>
            <div>${l.child_name || ""}</div>
            <div>${l.source || ""}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  document.getElementById("view-pipeline").innerHTML = `
    <div class="kanban">
      ${column("New", stages.new)}
      ${column("Contacted", stages.contacted)}
      ${column("Tour", stages.tour_scheduled)}
      ${column("Application", stages.application_started)}
      ${column("Enrolled", stages.enrolled)}
    </div>
  `;
}

    function kanbanCards(items) {
      if (!items.length) return emptyState("No matching records.");

      return items
        .map(
          (item) => `
            <div class="kanban-card">
              <strong>${escapeHtml(item.name)}</strong>
              <div class="small-note">
                ${escapeHtml(item.child)} · ${escapeHtml(item.location)} · ${escapeHtml(item.source || item.tour)}
              </div>
            </div>
          `
        )
        .join("");
    }

    elements.viewPipeline.innerHTML = `
      <div class="panel glass">
        <div class="panel-head">
          <h3>Admissions Pipeline</h3>
          <span class="chip">Kanban concept</span>
        </div>

        <div class="kanban">
          <div class="kanban-col">
            <h4>New Inquiry</h4>
            ${kanbanCards(groups.new)}
          </div>
          <div class="kanban-col">
            <h4>Contacted</h4>
            ${kanbanCards(groups.contacted)}
          </div>
          <div class="kanban-col">
            <h4>Tour Scheduled</h4>
            ${kanbanCards(groups.tour_scheduled)}
          </div>
          <div class="kanban-col">
            <h4>Application Started</h4>
            ${kanbanCards(groups.application_started)}
          </div>
          <div class="kanban-col">
            <h4>Enrolled</h4>
            ${kanbanCards(groups.enrolled)}
          </div>
        </div>
      </div>
    `;
  }

function renderTours() {
  const html = state.data.tours.map(t => `
    <div class="tour-row">
      <strong>${new Date(t.tour_at).toLocaleString()}</strong>
      <div>${t.family_name}</div>
      <div>${t.location_id}</div>
    </div>
  `).join("");

  document.getElementById("view-tours").innerHTML = html;
}

function renderOperations() {
  const classrooms = state.data.classrooms.length;
  const staff = state.data.staffing.length;

  document.getElementById("view-operations").innerHTML = `
    <div class="metric-row">
      <strong>${classrooms}</strong>
      <span>Classrooms</span>
    </div>
    <div class="metric-row">
      <strong>${staff}</strong>
      <span>Staff</span>
    </div>
  `;
}

function renderMessages() {
  const html = state.data.messages.map(m => `
    <div class="msg-row">
      <strong>${m.parent_name}</strong>
      <div>${m.message}</div>
    </div>
  `).join("");

  document.getElementById("view-parentComms").innerHTML = html;
}
  function renderCompliance(filtered) {
    const complianceMarkup = filtered.compliance.length
      ? filtered.compliance.map((item) => metricRow(item.title, item.detail, item.value)).join("")
      : emptyState("No compliance items match the current search/filter.");

    elements.viewCompliance.innerHTML = `
      <div class="two-col">
        <div class="panel glass">
          <div class="panel-head"><h3>Compliance Items</h3><span class="chip">Center safety</span></div>
          <div class="metric-list">${complianceMarkup}</div>
        </div>

        <div class="panel glass">
          <div class="panel-head"><h3>Compliance Health</h3><span class="chip">Portfolio snapshot</span></div>
          <div class="metric-list">
            ${metricRow("Centers Fully Compliant", "Current completion score.", "92%")}
            ${metricRow("Open Incidents", "Require acknowledgement or review.", "2")}
            ${metricRow("Training Completion", "Mandatory module completion rate.", "87%")}
            ${metricRow("Expiring Documents", "Need renewal inside 30 days.", "5")}
          </div>
        </div>
      </div>
    `;
  }

  function renderAI() {
    elements.viewAI.innerHTML = `
      <div class="two-col">
        <div class="panel glass">
          <div class="panel-head"><h3>AI Copilot</h3><span class="chip">Future-ready</span></div>
          <div class="metric-list">
            <article class="ai-card">
              <div class="ai-card-top"><strong>Lead Priority Insight</strong><span class="ai-badge">Predicted</span></div>
              <div class="small-note">
                Ashley Rodriguez is likely to schedule a tour within 24 hours based on source, response speed, and similar historical conversions.
              </div>
            </article>
            <article class="ai-card">
              <div class="ai-card-top"><strong>Suggested Follow-up</strong><span class="ai-badge">Draft</span></div>
              <div class="small-note">
                “Hi Ashley, we’d love to help you explore availability for Lucas. We have a preschool tour opening tomorrow at 10:30 AM.”
              </div>
            </article>
            <article class="ai-card">
              <div class="ai-card-top"><strong>Staffing Risk Alert</strong><span class="ai-badge">Forecast</span></div>
              <div class="small-note">
                Orlando Center may fall below preferred float coverage tomorrow between 2:00 PM and 4:00 PM.
              </div>
            </article>
            <article class="ai-card">
              <div class="ai-card-top"><strong>Enrollment Forecast</strong><span class="ai-badge">Projected</span></div>
              <div class="small-note">
                Current inquiry volume suggests a 12% increase in pre-k demand over the next 30 days.
              </div>
            </article>
          </div>
        </div>

        <div class="panel glass">
          <div class="panel-head"><h3>AI Queue</h3><span class="chip">Designed now</span></div>
          <div class="metric-list">
            ${metricRow("Leads needing same-day response", "AI will rank high-intent inquiries by urgency and conversion likelihood.", "7")}
            ${metricRow("Auto-drafted follow-ups", "Suggested email and SMS drafts for admissions review.", "12")}
            ${metricRow("Potential no-show tours", "Tours likely to need confirmation outreach.", "3")}
            ${metricRow("Centers with rising demand", "Forecasting layer identifies locations likely to hit capacity soon.", "5")}
          </div>
        </div>
      </div>
    `;
  }

  function renderAllViews() {
    const filtered = getFilteredData();

    renderOverview(filtered);
    renderPipeline(filtered);
    renderTours(filtered);
    renderOperations();
    renderParentComms(filtered);
    renderCompliance(filtered);
    renderAI();
  }

  function setView(viewId) {
    state.currentView = viewId;
    saveState();

    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));

    const nextView = document.getElementById(`view-${viewId}`);
    if (nextView) nextView.classList.add("active");

    document.querySelectorAll(".nav-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === viewId);
    });
  }

  function setRole(roleId) {
    if (!config.roleMeta[roleId]) return;

    state.currentRole = roleId;

    document.querySelectorAll(".role-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.role === roleId);
    });

    renderRole();
  }

  function formatRelativeDate(value) {
    if (!value) return "Recently";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const comparison = new Date(date);
    comparison.setHours(0, 0, 0, 0);

    const diffDays = Math.round((comparison.getTime() - today.getTime()) / 86400000);

    if (diffDays === 0) return "Today";
    if (diffDays === -1) return "Yesterday";
    if (diffDays === 1) return "Tomorrow";

    return date.toLocaleDateString();
  }

  function formatTour(value) {
    if (!value) return "Not booked";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Scheduled";

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function mapLeadStageToStatus(stage) {
    if (stage === "new_inquiry") return "new";
    if (stage === "contacted") return "contacted";
    if (stage === "tour_booked") return "tour_scheduled";
    if (stage === "application_started") return "application_started";
    if (stage === "enrolled") return "enrolled";
    return "contacted";
  }

  function buildLeadTags(lead, locationName) {
    const tags = [];
    const stage = String(lead.stage || "").toLowerCase();
    const normalizedLocation = String(locationName || "").toLowerCase();

    if (normalizedLocation.includes("orlando")) tags.push("orlando");
    if (stage === "tour_booked" || stage === "application_started" || stage === "enrolled") {
      tags.push("high_intent");
    }
    if (stage === "new_inquiry" || stage === "contacted") tags.push("needs_reply");

    const createdAt = formatRelativeDate(lead.created_at).toLowerCase();
    const followUpAt = formatRelativeDate(lead.next_follow_up_at).toLowerCase();

    if (createdAt === "today" || followUpAt === "today") tags.push("today");

    return [...new Set(tags)];
  }

  function buildLiveData(leads) {
    const fallback = cloneSampleData();

    if (!Array.isArray(leads) || !leads.length) {
      return fallback;
    }

    const mappedLeads = leads.map((lead) => {
      const locationName = locationNameFor(lead.location_id);
      const status = mapLeadStageToStatus(lead.stage);

      return {
        name: lead.parent_name || "Unknown Parent",
        child: lead.child_name ? `${lead.child_name}${lead.child_age ? `, ${lead.child_age}` : ""}` : lead.child_age || "Child details pending",
        location: locationName,
        date: formatRelativeDate(lead.created_at),
        status,
        tour: formatTour(lead.tour_at),
        source: lead.source || "Website",
        tags: buildLeadTags(lead, locationName)
      };
    });

    const mappedTours = leads
      .filter((lead) => lead.tour_at)
      .map((lead) => ({
        time: new Date(lead.tour_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        family: lead.parent_name || "Unknown Parent",
        child: lead.child_name ? `${lead.child_name}${lead.child_age ? `, ${lead.child_age}` : ""}` : lead.child_age || "Child details pending",
        location: locationNameFor(lead.location_id),
        status: lead.stage === "tour_booked" ? "Confirmed" : titleCase(lead.stage || "Scheduled"),
        tags: buildLeadTags(lead, locationNameFor(lead.location_id))
      }));

    fallback.leads = mappedLeads;
    if (mappedTours.length) fallback.tours = mappedTours;

    return fallback;
  }
async function handleEmailOnlyLogin() {
  const email = document.getElementById("emailInput")?.value?.trim().toLowerCase();

  if (!email) {
    setAuthMessage("Enter your email", true);
    return;
  }

  setAuthMessage("Signing in...");

  try {
    // Find profile by email
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !profile) {
      throw new Error("No account found for this email");
    }

    // Fake session object
    const session = {
      user: {
        id: profile.id,
        email: profile.email
      }
    };

    // Save session locally
    localStorage.setItem("kidcity-session", JSON.stringify(session));

    await showAppForSession(session);

  } catch (err) {
    console.error(err);
    setAuthMessage(err.message || "Login failed", true);
  }
}
 async function loadProfile(userIdOrEmail) {
  let query = supabase.from("profiles").select("*");

  if (userIdOrEmail.includes("@")) {
    query = query.eq("email", userIdOrEmail);
  } else {
    query = query.eq("id", userIdOrEmail);
  }

  const { data, error } = await query.single();

  if (error) throw error;

  return data;
}

  async function loadLocations() {
    const { data, error } = await supabase.from("locations").select("id, name, slug").order("name");

    if (error) throw error;

    state.locationsById = new Map((data || []).map((location) => [location.id, location]));
  }

  async function loadLiveLeads() {
    const { data, error } = await supabase
      .from("leads")
      .select(
        "id, parent_name, child_name, child_age, source, stage, status, next_follow_up_at, tour_at, created_at, location_id"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    state.data = buildLiveData(data || []);
  }

  async function bootstrapSession(session) {
    state.session = session;
    state.profile = await loadProfile(session.user.id);
    state.currentRole = resolveDashboardRole(state.profile);

    await loadLocations();
    await loadLiveLeads();

    buildRoleButtons();
    buildNav();
    buildQuickFilters();
    renderRole();
    renderAllViews();
    setView(state.currentView);
    showApp();

    if (getSelectedLoginRole() && getSelectedLoginRole() !== state.currentRole) {
      setAuthMessage(
        `Signed in successfully. Dashboard opened in ${titleCase(state.currentRole)} view based on your assigned access.`
      );
    } else {
      setAuthMessage("Signed in successfully.");
    }
  }

  async function handleBootstrapError(error, fallbackMessage) {
    console.error(error);

    if (supabase) {
      await supabase.auth.signOut();
    }

    state.session = null;
    state.profile = null;
    state.locationsById = new Map();
    state.data = cloneSampleData();
    showAuth();
    setAuthMessage(error?.message || fallbackMessage, true);
  }

  async function handleEmailLogin() {
    const email = elements.emailInput?.value?.trim().toLowerCase();
    const password = elements.passwordInput?.value || "";

    if (!supabase) {
      setAuthMessage("Supabase is not configured yet. Update config.js first.", true);
      return;
    }

    if (!email || !password) {
      setAuthMessage("Enter your email and password to continue.", true);
      return;
    }

    setAuthMessage("Signing in...");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error("No session returned from Supabase.");

      await bootstrapSession(data.session);
    } catch (error) {
      console.error(error);
      setAuthMessage(error.message || "Login failed.", true);
    }
  }

  async function handleRefresh() {
    if (!state.session) return;

    try {
      await loadLocations();
      await loadLiveLeads();
      renderRole();
      renderAllViews();
      setAuthMessage("CRM data refreshed.");
    } catch (error) {
      console.error(error);
      setAuthMessage(error.message || "Refresh failed.", true);
    }
  }

function handleSignOut() {
  localStorage.removeItem("kidcity-session");
  showAuth();
}

    await supabase.auth.signOut();
    state.session = null;
    state.profile = null;
    state.locationsById = new Map();
    state.data = cloneSampleData();
    state.searchTerm = "";

    if (elements.globalSearch) {
      elements.globalSearch.value = "";
    }

    showAuth();
    setAuthMessage("Signed out.");
  }

  function bindEvents() {
    elements.authRoleSwitch?.querySelectorAll(".auth-role-btn").forEach((button) => {
      button.addEventListener("click", () => {
        setSelectedLoginRole(button.dataset.loginRole);
        updateAuthRoleButtons();
        setAuthMessage(`${titleCase(button.dataset.loginRole)} workspace selected.`);
      });
    });

    elements.loginBtn?.addEventListener("click", handleEmailLogin);
["emailInput"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;

  el.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleEmailOnlyLogin();
    }
  });
});
    [elements.emailInput, elements.passwordInput].forEach((input) => {
      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          handleEmailLogin();
        }
      });
    });

    elements.signOutBtn?.addEventListener("click", handleSignOut);
    elements.refreshBtn?.addEventListener("click", handleRefresh);

    elements.globalSearch?.addEventListener("input", (event) => {
      state.searchTerm = event.target.value;
      renderAllViews();
    });
  }

  async function init() {
    bindEvents();
    const loginBtn = document.getElementById("loginBtn");

if (loginBtn) {
  loginBtn.addEventListener("click", handleEmailOnlyLogin);
}
    updateAuthRoleButtons();

    if (!configLooksReady) {
      showAuth();
      setAuthMessage("Set your Supabase URL and anon key in config.js to enable email/password login.", true);
      return;
    }

    if (!supabase) {
      showAuth();
      setAuthMessage("The Supabase browser client did not load correctly.", true);
      return;
    }

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session) {
      try {
        await bootstrapSession(session);
      } catch (error) {
        await handleBootstrapError(error, "Session restore failed.");
      }
    } else {
      showAuth();
      setAuthMessage("Sign in with your Kid City email and password.");
    }

    supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!nextSession) {
        showAuth();
        return;
      }

      try {
        await bootstrapSession(nextSession);
      } catch (error) {
        await handleBootstrapError(error, "Session load failed.");
      }
    });
  }

 async function init() {
  bindEvents();
  updateAuthRoleButtons();

  const storedSession = localStorage.getItem("kidcity-session");

  if (storedSession) {
    try {
      const session = JSON.parse(storedSession);
      await showAppForSession(session);
      return;
    } catch (error) {
      console.error(error);
    }
  }

  showAuth();
}
})();
