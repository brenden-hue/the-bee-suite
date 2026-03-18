(() => {
  "use strict";

  const STORAGE_KEYS = {
    role: "kidcity-role",
    view: "kidcity-view",
    filter: "kidcity-filter"
  };

  const config = window.CRM_CONFIG;

  const state = {
    currentRole: localStorage.getItem(STORAGE_KEYS.role) || "executive",
    currentView: localStorage.getItem(STORAGE_KEYS.view) || "overview",
    currentFilter: localStorage.getItem(STORAGE_KEYS.filter) || "all",
    searchTerm: ""
  };

  const elements = {
    roleSwitch: document.getElementById("roleSwitch"),
    mainNav: document.getElementById("mainNav"),
    quickFilters: document.getElementById("quickFilters"),
    pageTitle: document.getElementById("pageTitle"),
    heroTitle: document.getElementById("heroTitle"),
    heroCopy: document.getElementById("heroCopy"),
    userPill: document.getElementById("userPill"),
    kpis: document.getElementById("kpis"),
    globalSearch: document.getElementById("globalSearch"),
    demoStateBtn: document.getElementById("demoStateBtn"),
    viewOverview: document.getElementById("view-overview"),
    viewPipeline: document.getElementById("view-pipeline"),
    viewTours: document.getElementById("view-tours"),
    viewOperations: document.getElementById("view-operations"),
    viewBilling: document.getElementById("view-billing"),
    viewParentComms: document.getElementById("view-parentComms"),
    viewCompliance: document.getElementById("view-compliance"),
    viewAI: document.getElementById("view-ai")
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function titleCase(value) {
    return String(value)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEYS.role, state.currentRole);
    localStorage.setItem(STORAGE_KEYS.view, state.currentView);
    localStorage.setItem(STORAGE_KEYS.filter, state.currentFilter);
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

    if (state.currentFilter === "highIntent") {
      return tags.includes("highIntent");
    }

    if (state.currentFilter === "needsReply") {
      return tags.includes("needsReply");
    }

    if (state.currentFilter === "today") {
      return tags.includes("today") || text.includes("today");
    }

    return true;
  }

  function filterItems(items) {
    return items.filter((item) => matchesQuickFilter(item) && matchesSearch(item));
  }

  function buildRoleButtons() {
    elements.roleSwitch.innerHTML = Object.entries(config.roles)
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

  function getFilteredData() {
    return {
      leads: filterItems(config.sample.leads),
      tours: filterItems(config.sample.tours),
      messages: filterItems(config.sample.messages),
      compliance: filterItems(config.sample.compliance),
      billingActivity: filterItems(config.sample.billingActivity)
    };
  }

  function renderRole() {
    const role = config.roles[state.currentRole];
    elements.pageTitle.textContent = role.title;
    elements.heroTitle.textContent = role.heroTitle;
    elements.heroCopy.textContent = role.heroCopy;
    elements.userPill.textContent = role.user;
    elements.kpis.innerHTML = role.kpis.map(kpiCard).join("");
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
            <span class="chip">Live-style sample</span>
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
          <div class="panel-head"><h3>Enrollment</h3><span class="chip">future adapter</span></div>
          <div class="metric-list">
            ${metricRow("Open Applications", "Designed now, connect real application data later.", "21")}
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

  function renderPipeline(filtered) {
    const groups = {
      new: [],
      contacted: [],
      tour_scheduled: [],
      application_started: [],
      enrolled: []
    };

    filtered.leads.forEach((lead) => {
      if (lead.status === "new") groups.new.push(lead);
      if (lead.status === "contacted") groups.contacted.push(lead);
      if (lead.status === "tour_scheduled") groups.tour_scheduled.push(lead);
      if (lead.status === "enrolled") groups.enrolled.push(lead);
    });

    if (!groups.application_started.length) {
      groups.application_started.push({
        name: "Carson Hill",
        child: "Pre-K",
        location: "Orlando",
        source: "Docs pending",
        tour: "N/A",
        status: "application_started"
      });
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

  function renderTours(filtered) {
    const toursMarkup = filtered.tours.length
      ? filtered.tours.map(tourCard).join("")
      : emptyState("No tours match the current search/filter.");

    elements.viewTours.innerHTML = `
      <div class="two-col">
        <div class="panel glass">
          <div class="panel-head">
            <h3>Upcoming Tours</h3>
            <span class="chip">Calendar-ready</span>
          </div>
          <div class="tour-list">${toursMarkup}</div>
        </div>

        <div class="panel glass">
          <div class="panel-head">
            <h3>Tour Metrics</h3>
            <span class="chip">Conversion focused</span>
          </div>
          <div class="metric-list">
            ${metricRow("Tours Today", "Confirmed and pending visits.", "9")}
            ${metricRow("Tours This Week", "Scheduled across visible centers.", "31")}
            ${metricRow("Tour Conversion", "Lead to tour rate.", "38%")}
            ${metricRow("Avg. Lead → Tour Time", "Current workflow speed.", "2.4d")}
          </div>
        </div>
      </div>
    `;
  }

  function renderOperations() {
    elements.viewOperations.innerHTML = `
      <div class="three-col">
        <div class="panel glass">
          <div class="panel-head"><h3>Center Readiness</h3><span class="chip">Morning view</span></div>
          <div class="metric-list">
            ${metricRow("Children Checked In", "Current attendance count.", "87")}
            ${metricRow("Open Classrooms", "Rooms operating today.", "8")}
            ${metricRow("Coverage Level", "Staffing match to need.", "96%")}
          </div>
        </div>

        <div class="panel glass">
          <div class="panel-head"><h3>Staffing Alerts</h3><span class="chip">Actionable</span></div>
          <div class="metric-list">
            ${metricRow("Ratio Threshold", "Two classrooms nearing limit.", "2")}
            ${metricRow("Call-outs", "Staff absences needing coverage.", "1")}
            ${metricRow("Expiring Certs", "Renewals due within 30 days.", "3")}
          </div>
        </div>

        <div class="panel glass">
          <div class="panel-head"><h3>Director Tasks</h3><span class="chip">Daily flow</span></div>
          <div class="metric-list">
            ${metricRow("Parent Replies", "Messages waiting for response.", "3")}
            ${metricRow("Licensing Items", "Docs due tomorrow.", "1")}
            ${metricRow("Supply Approvals", "Classroom requests open.", "4")}
          </div>
        </div>
      </div>
    `;
  }

  function renderBilling(filtered) {
    const activityMarkup = filtered.billingActivity.length
      ? filtered.billingActivity
          .map((entry) => infoCard(entry.title, entry.detail))
          .join("")
      : emptyState("No billing items match the current search/filter.");

    elements.viewBilling.innerHTML = `
      <div class="two-col">
        <div class="panel glass">
          <div class="panel-head"><h3>Financial Snapshot</h3><span class="chip">Billing-ready</span></div>
          <div class="metric-list">
            ${metricRow("Revenue Collected Today", "Posted payments and autopay.", "$6,280")}
            ${metricRow("Invoices Due", "Open balances due soon.", "34")}
            ${metricRow("Past Due Accounts", "Need outreach or payment plan.", "9")}
            ${metricRow("Autopay Success", "Today’s successful runs.", "94%")}
          </div>
        </div>

        <div class="panel glass">
          <div class="panel-head"><h3>Billing Activity</h3><span class="chip">Live-style sample</span></div>
          <div class="section-list">${activityMarkup}</div>
        </div>
      </div>
    `;
  }

  function renderParentComms(filtered) {
    const messageMarkup = filtered.messages.length
      ? filtered.messages.map(messageCard).join("")
      : emptyState("No communication items match the current search/filter.");

    elements.viewParentComms.innerHTML = `
      <div class="two-col">
        <div class="panel glass">
          <div class="panel-head"><h3>Parent Communication Hub</h3><span class="chip">Shared inbox concept</span></div>
          <div class="msg-list">${messageMarkup}</div>
        </div>

        <div class="panel glass">
          <div class="panel-head"><h3>Communication Stats</h3><span class="chip">Response health</span></div>
          <div class="metric-list">
            ${metricRow("Messages Today", "Across parent channels.", "32")}
            ${metricRow("Unanswered", "Waiting in queue.", "7")}
            ${metricRow("Avg. Response Time", "Current service speed.", "45m")}
            ${metricRow("Tour Confirmations", "Automated + manual touchpoints.", "9")}
          </div>
        </div>
      </div>
    `;
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
    renderBilling(filtered);
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
    state.currentRole = roleId;
    saveState();

    document.querySelectorAll(".role-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.role === roleId);
    });

    renderRole();
  }

  function bindEvents() {
    elements.globalSearch.addEventListener("input", (event) => {
      state.searchTerm = event.target.value;
      renderAllViews();
    });

    elements.demoStateBtn.addEventListener("click", () => {
      state.currentFilter = "all";
      state.searchTerm = "";
      elements.globalSearch.value = "";
      buildQuickFilters();
      renderAllViews();
    });
  }

  function init() {
    buildRoleButtons();
    buildNav();
    buildQuickFilters();
    bindEvents();
    renderRole();
    renderAllViews();
    setView(state.currentView);
  }

  init();
})();