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

  const LEAD_SOURCES = [
    "Walk-In",
    "Phone-Call",
    "Website",
    "Google Ads",
    "Google Business Profile",
    "Organic Search",
    "Meta/Facebook Ads",
    "Facebook",
    "Instagram",
    "TikTok",
    "YouTube",
    "Yelp",
    "Email Campaign",
    "SMS/Text",
    "Referral",
    "Community Event",
    "Childcare Network",
    "School Partnership",
    "Other"
  ];

  const STATUS_ORDER = [
    "new",
    "contacted",
    "tour_scheduled",
    "application_started",
    "enrolled",
    "lost"
  ];

  const STATUS_LABELS = {
    new: "New",
    contacted: "Contacted",
    tour_scheduled: "Tour Scheduled",
    application_started: "Application Started",
    enrolled: "Enrolled",
    lost: "Lost"
  };

  const TABLE_CANDIDATES = {
    leads: ["crm_leads_expanded", "leads"],
    tours: ["crm_tours_expanded", "tours"],
    messages: ["crm_messages_expanded", "parent_messages", "messages"],
    classrooms: ["classrooms"],
    staffing: ["staff_assignments_expanded", "staff_assignments", "staffing"],
    compliance: ["compliance_items", "compliance"]
  };

  const config = window.CRM_CONFIG || {};
  const views = Array.isArray(config.views) && config.views.length ? config.views : DEFAULT_VIEWS;

  const supabaseClient = window.supabase && config.supabaseUrl && config.supabaseAnonKey
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;

  const state = {
    session: null,
    profile: null,
    locations: [],
    data: {
      leads: [],
      tours: [],
      messages: [],
      classrooms: [],
      staffing: [],
      compliance: []
    },
    selectedLocation: "ALL",
    activeView: "overview",
    search: "",
    manualLeadOpen: false,
    isLoading: false
  };

  const el = {
    auth: document.getElementById("authShell"),
    app: document.getElementById("appShell"),
    loginForm: document.getElementById("loginForm"),
    email: document.getElementById("emailInput"),
    login: document.getElementById("loginBtn"),
    msg: document.getElementById("authMessage"),
    signout: document.getElementById("signOutBtn"),
    refresh: document.getElementById("refreshBtn"),
    nav: document.getElementById("viewNav"),
    roleLabel: document.getElementById("roleLabel"),
    profileCard: document.getElementById("profileCard"),
    locationSelect: document.getElementById("locationSelect"),
    locationEyebrow: document.getElementById("locationEyebrow"),
    pageTitle: document.getElementById("pageTitle"),
    heroEyebrow: document.getElementById("heroEyebrow"),
    heroTitle: document.getElementById("heroTitle"),
    heroCopy: document.getElementById("heroCopy"),
    searchInput: document.getElementById("searchInput"),
    alert: document.getElementById("appAlert"),
    kpiGrid: document.getElementById("kpiGrid"),
    openManualLead: document.getElementById("openManualLeadBtn"),
    closeManualLead: document.getElementById("closeManualLeadBtn"),
    cancelManualLead: document.getElementById("cancelManualLeadBtn"),
    manualLeadPanel: document.getElementById("manualLeadPanel"),
    manualLeadForm: document.getElementById("manualLeadForm"),
    leadFamilyName: document.getElementById("leadFamilyName"),
    leadChildName: document.getElementById("leadChildName"),
    leadChildAge: document.getElementById("leadChildAge"),
    leadSource: document.getElementById("leadSource"),
    leadLocation: document.getElementById("leadLocation"),
    leadNotes: document.getElementById("leadNotes"),
    saveLead: document.getElementById("saveLeadBtn")
  };

  function isExecutive() {
    return state.profile && state.profile.role === "executive";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toTitle(value) {
    return String(value || "")
      .replaceAll("_", " ")
      .replaceAll("-", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function number(value) {
    return new Intl.NumberFormat("en-US").format(Number(value || 0));
  }

  function percent(part, total) {
    if (!total) return "0%";
    return `${Math.round((part / total) * 100)}%`;
  }

  function formatDate(value) {
    if (!value) return "Not scheduled";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not scheduled";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function normalizeSource(source) {
    const raw = String(source || "").trim();

    if (!raw) return "Unspecified";

    const key = raw.toLowerCase().replace(/\s+/g, " ");

    const aliases = {
      phone: "Phone-Call",
      "phone call": "Phone-Call",
      "phone-call": "Phone-Call",
      call: "Phone-Call",
      walkin: "Walk-In",
      "walk in": "Walk-In",
      "walk-in": "Walk-In",
      web: "Website",
      site: "Website",
      website: "Website",
      google: "Google Ads",
      "google ad": "Google Ads",
      "google ads": "Google Ads",
      gbp: "Google Business Profile",
      "google business": "Google Business Profile",
      "google business profile": "Google Business Profile",
      organic: "Organic Search",
      "organic search": "Organic Search",
      meta: "Meta/Facebook Ads",
      facebook: "Facebook",
      fb: "Facebook",
      "facebook ads": "Meta/Facebook Ads",
      instagram: "Instagram",
      ig: "Instagram",
      tiktok: "TikTok",
      "tik tok": "TikTok",
      youtube: "YouTube",
      email: "Email Campaign",
      sms: "SMS/Text",
      text: "SMS/Text",
      referral: "Referral",
      event: "Community Event"
    };

    return aliases[key] || raw;
  }

  function displayStatus(status) {
    return STATUS_LABELS[status] || toTitle(status || "new");
  }

  function statusClass(status) {
    const safeStatus = STATUS_LABELS[status] ? status : "new";
    return `status-${safeStatus}`;
  }

  function rowLocationId(row) {
    return String(
      row?.location_id ||
      row?.crm_location_id ||
      row?.locationId ||
      row?.location?.id ||
      ""
    );
  }

  function rowLocationName(row) {
    const locationId = rowLocationId(row);
    const match = getAllLocations().find((location) => String(location.id) === String(locationId));

    return (
      row?.location_name ||
      row?.location_code ||
      row?.center_name ||
      match?.name ||
      match?.code ||
      (locationId ? `Location ${locationId.slice(0, 8)}` : "Unassigned Location")
    );
  }

  function getProfileName() {
    return (
      state.profile?.full_name ||
      state.profile?.name ||
      state.profile?.email ||
      "CRM User"
    );
  }

  function getRoleMeta() {
    const role = state.profile?.role || "director";
    const fallback = {
      executive: {
        label: "Executive View",
        title: "Executive Command Center",
        heroTitle: "Portfolio-wide visibility for Kid City USA",
        heroCopy: "See all locations together by default, compare center performance, and drill into individual schools when needed."
      },
      director: {
        label: "Director View",
        title: "Center Operations Command",
        heroTitle: "Run the center without losing the big picture",
        heroCopy: "Watch leads, tours, staffing, parent communication, classroom readiness, and compliance from one screen."
      },
      admissions: {
        label: "Admissions View",
        title: "Admissions Growth Hub",
        heroTitle: "Move families from inquiry to enrollment faster",
        heroCopy: "Use the lead pipeline, tour scheduling, follow-up queue, and conversion signals to keep momentum high."
      }
    };

    return config.roleMeta?.[role] || fallback[role] || fallback.director;
  }

  function showAuth() {
    el.auth.classList.remove("hidden");
    el.app.classList.add("hidden");
  }

  function showApp() {
    el.auth.classList.add("hidden");
    el.app.classList.remove("hidden");
  }

  function setAuthMessage(message, type = "") {
    el.msg.textContent = message;
    el.msg.className = `form-message ${type}`.trim();
  }

  function setAlert(message, type = "") {
    if (!message) {
      el.alert.textContent = "";
      el.alert.className = "toast hidden";
      return;
    }

    el.alert.textContent = message;
    el.alert.className = `toast ${type}`.trim();

    window.clearTimeout(setAlert.timer);
    setAlert.timer = window.setTimeout(() => {
      el.alert.className = "toast hidden";
      el.alert.textContent = "";
    }, 5200);
  }

  async function login(event) {
    event.preventDefault();

    if (!supabaseClient) {
      setAuthMessage("CRM configuration is missing. Please verify config.js is loading.", "error");
      return;
    }

    const email = el.email.value.trim().toLowerCase();

    if (!email) {
      setAuthMessage("Please enter your email.", "error");
      return;
    }

    el.login.disabled = true;
    setAuthMessage("Checking access...");

    try {
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        setAuthMessage("No account found for that email.", "error");
        return;
      }

      const session = {
        user: {
          id: data.id,
          email
        }
      };

      localStorage.setItem("session", JSON.stringify(session));
      await bootstrap(session);
    } catch (error) {
      console.error("Login failed:", error);
      setAuthMessage(error.message || "Login failed. Please try again.", "error");
    } finally {
      el.login.disabled = false;
    }
  }

  async function bootstrap(session) {
    if (!supabaseClient) {
      setAuthMessage("CRM configuration is missing. Please verify config.js is loading.", "error");
      showAuth();
      return;
    }

    state.session = session;

    try {
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        localStorage.removeItem("session");
        showAuth();
        setAuthMessage("Your saved session could not be found. Please sign in again.", "error");
        return;
      }

      state.profile = data;
      state.selectedLocation = data.role === "executive" ? "ALL" : String(data.location_id || "");
      state.activeView = "overview";
      state.search = "";

      await loadData();
      render();
      showApp();
      setAuthMessage("");
    } catch (error) {
      console.error("Bootstrap failed:", error);
      localStorage.removeItem("session");
      showAuth();
      setAuthMessage(error.message || "Could not load your profile.", "error");
    }
  }

  async function loadData() {
    if (!state.profile) return;

    state.isLoading = true;
    el.refresh.disabled = true;

    try {
      state.locations = await loadLocations();

      const [leads, tours, messages, classrooms, staffing, compliance] = await Promise.all([
        selectFirstAvailable(TABLE_CANDIDATES.leads),
        selectFirstAvailable(TABLE_CANDIDATES.tours),
        selectFirstAvailable(TABLE_CANDIDATES.messages),
        selectFirstAvailable(TABLE_CANDIDATES.classrooms),
        selectFirstAvailable(TABLE_CANDIDATES.staffing),
        selectFirstAvailable(TABLE_CANDIDATES.compliance)
      ]);

      state.data = {
        leads: sortByDate(leads),
        tours: sortByDate(tours, "scheduled_at"),
        messages: sortByDate(messages),
        classrooms: sortByName(classrooms),
        staffing: sortByDate(staffing, "shift_start"),
        compliance: sortByDate(compliance, "due_date")
      };
    } finally {
      state.isLoading = false;
      el.refresh.disabled = false;
    }
  }

  async function loadLocations() {
    try {
      const { data, error } = await supabaseClient
        .from("locations")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;

      return Array.isArray(data)
        ? data.filter((location) => location.is_active !== false)
        : [];
    } catch (error) {
      console.warn("Locations could not be loaded. Falling back to location IDs from CRM data.", error);
      return [];
    }
  }

  async function selectFirstAvailable(tableNames) {
    let lastError = null;

    for (const tableName of tableNames) {
      try {
        let query = supabaseClient
          .from(tableName)
          .select("*")
          .limit(2000);

        if (!isExecutive() && state.profile?.location_id) {
          query = query.eq("location_id", state.profile.location_id);
        }

        const { data, error } = await query;

        if (error) {
          lastError = error;
          continue;
        }

        return Array.isArray(data) ? data : [];
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      console.warn(`Could not load tables: ${tableNames.join(", ")}`, lastError);
    }

    return [];
  }

  function sortByDate(rows, field = "created_at") {
    return [...(rows || [])].sort((a, b) => {
      const aTime = new Date(a?.[field] || a?.created_at || 0).getTime();
      const bTime = new Date(b?.[field] || b?.created_at || 0).getTime();
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
    });
  }

  function sortByName(rows) {
    return [...(rows || [])].sort((a, b) => {
      const aName = String(a?.name || a?.classroom_name || "");
      const bName = String(b?.name || b?.classroom_name || "");
      return aName.localeCompare(bName);
    });
  }

  function getAllLocations() {
    const map = new Map();

    for (const location of state.locations || []) {
      if (!location?.id) continue;

      map.set(String(location.id), {
        id: String(location.id),
        name: location.name || location.code || `Location ${String(location.id).slice(0, 8)}`,
        code: location.code || ""
      });
    }

    const allRows = [
      ...state.data.leads,
      ...state.data.tours,
      ...state.data.messages,
      ...state.data.classrooms,
      ...state.data.staffing,
      ...state.data.compliance
    ];

    for (const row of allRows) {
      const id = rowLocationId(row);

      if (!id || map.has(id)) continue;

      map.set(id, {
        id,
        name: row.location_name || row.location_code || `Location ${id.slice(0, 8)}`,
        code: row.location_code || ""
      });
    }

    if (state.profile?.location_id && !map.has(String(state.profile.location_id))) {
      const id = String(state.profile.location_id);
      map.set(id, {
        id,
        name: `My Location ${id.slice(0, 8)}`,
        code: ""
      });
    }

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function getScopedData() {
    const selected = isExecutive() ? state.selectedLocation : String(state.profile?.location_id || "");

    if (isExecutive() && selected === "ALL") {
      return state.data;
    }

    const locationId = String(selected || "");

    const filterRows = (rows) => rows.filter((row) => rowLocationId(row) === locationId);

    return {
      leads: filterRows(state.data.leads),
      tours: filterRows(state.data.tours),
      messages: filterRows(state.data.messages),
      classrooms: filterRows(state.data.classrooms),
      staffing: filterRows(state.data.staffing),
      compliance: filterRows(state.data.compliance)
    };
  }

  function filterLeadsBySearch(leads) {
    const query = state.search.trim().toLowerCase();

    if (!query) return leads;

    return leads.filter((lead) => {
      const haystack = [
        lead.family_name,
        lead.child_name,
        lead.child_age,
        normalizeSource(lead.source),
        displayStatus(lead.status),
        lead.notes,
        rowLocationName(lead),
        lead.intent_score
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }

  function summarizeSources(leads) {
    const counts = new Map();

    for (const lead of leads) {
      const source = normalizeSource(lead.source);
      counts.set(source, (counts.get(source) || 0) + 1);
    }

    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }

  function summarizeStages(leads) {
    return STATUS_ORDER.map((status) => ({
      status,
      label: displayStatus(status),
      count: leads.filter((lead) => (lead.status || "new") === status).length
    }));
  }

  function buildLocationRows() {
    const locations = getAllLocations();

    return locations.map((location) => {
      const leads = state.data.leads.filter((row) => rowLocationId(row) === location.id);
      const tours = state.data.tours.filter((row) => rowLocationId(row) === location.id);
      const messages = state.data.messages.filter((row) => rowLocationId(row) === location.id);
      const compliance = state.data.compliance.filter((row) => rowLocationId(row) === location.id);

      const enrolled = leads.filter((lead) => lead.status === "enrolled").length;
      const highIntent = leads.filter((lead) => Number(lead.intent_score || 0) >= 75).length;
      const openCompliance = compliance.filter((item) => item.status !== "complete").length;
      const needsReply = messages.filter((message) => message.requires_reply || message.is_unread).length;
      const topSource = summarizeSources(leads)[0]?.label || "No leads yet";

      return {
        ...location,
        leads: leads.length,
        tours: tours.length,
        enrolled,
        highIntent,
        conversion: percent(enrolled, leads.length),
        openCompliance,
        needsReply,
        topSource
      };
    }).sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name));
  }

  function getLeadById(leadId) {
    if (!leadId) return null;
    return state.data.leads.find((lead) => String(lead.id) === String(leadId)) || null;
  }

  function render() {
    if (!state.profile) return;

    const scopedData = getScopedData();
    const visibleLeads = filterLeadsBySearch(scopedData.leads);

    renderChrome(scopedData);
    renderNav(scopedData);
    renderKpis(scopedData);
    renderOverview(scopedData);
    renderPipeline(scopedData, visibleLeads);
    renderTours(scopedData);
    renderOperations(scopedData);
    renderMessages(scopedData);
    renderCompliance(scopedData);
    renderAi(scopedData);
    syncActiveView();
  }

  function renderChrome(scopedData) {
    const roleMeta = getRoleMeta();
    const selectedLocationLabel = isExecutive() && state.selectedLocation === "ALL"
      ? "ALL Locations"
      : getSelectedLocationName();

    el.roleLabel.textContent = roleMeta.label;
    el.pageTitle.textContent = roleMeta.title;
    el.locationEyebrow.textContent = selectedLocationLabel;
    el.heroEyebrow.textContent = roleMeta.label;
    el.heroTitle.textContent = isExecutive() && state.selectedLocation === "ALL"
      ? "All schools combined, with side-by-side comparison"
      : roleMeta.heroTitle;
    el.heroCopy.textContent = isExecutive() && state.selectedLocation === "ALL"
      ? "Executive users now open to ALL by default. Use this view to compare leads, tours, enrollments, conversion, top sources, parent follow-up, and compliance across schools."
      : roleMeta.heroCopy;

    el.profileCard.innerHTML = `
      <strong>${escapeHtml(getProfileName())}</strong>
      <div class="small-note">${escapeHtml(state.profile.email || state.session?.user?.email || "Signed in")}</div>
      <span class="role-pill">${escapeHtml(toTitle(state.profile.role || "User"))}</span>
    `;

    renderLocationSelect();
    renderLeadLocationSelect();
  }

  function getSelectedLocationName() {
    const selected = isExecutive() ? state.selectedLocation : String(state.profile?.location_id || "");

    if (selected === "ALL") return "ALL Locations";

    const location = getAllLocations().find((item) => String(item.id) === String(selected));
    return location?.name || "Current Location";
  }

  function renderLocationSelect() {
    const locations = getAllLocations();
    const options = [];

    if (isExecutive()) {
      options.push(`<option value="ALL">ALL Locations</option>`);
    }

    for (const location of locations) {
      options.push(`
        <option value="${escapeHtml(location.id)}">
          ${escapeHtml(location.name)}${location.code ? ` · ${escapeHtml(location.code)}` : ""}
        </option>
      `);
    }

    if (!options.length) {
      options.push(`<option value="">No locations loaded</option>`);
    }

    el.locationSelect.innerHTML = options.join("");
    el.locationSelect.disabled = !isExecutive();

    const preferredValue = isExecutive()
      ? state.selectedLocation
      : String(state.profile?.location_id || "");

    if ([...el.locationSelect.options].some((option) => option.value === preferredValue)) {
      el.locationSelect.value = preferredValue;
    }
  }

  function renderLeadLocationSelect() {
    const locations = getAllLocations();
    const currentValue = el.leadLocation.value;
    const defaultLocation = isExecutive() && state.selectedLocation !== "ALL"
      ? state.selectedLocation
      : String(state.profile?.location_id || locations[0]?.id || "");

    el.leadLocation.innerHTML = locations.length
      ? locations.map((location) => `
          <option value="${escapeHtml(location.id)}">
            ${escapeHtml(location.name)}${location.code ? ` · ${escapeHtml(location.code)}` : ""}
          </option>
        `).join("")
      : `<option value="">No locations available</option>`;

    el.leadLocation.disabled = !isExecutive();

    const nextValue = currentValue || defaultLocation;

    if ([...el.leadLocation.options].some((option) => option.value === nextValue)) {
      el.leadLocation.value = nextValue;
    }
  }

  function renderNav(scopedData) {
    const counts = {
      overview: scopedData.leads.length,
      pipeline: scopedData.leads.length,
      tours: scopedData.tours.length,
      operations: scopedData.classrooms.length + scopedData.staffing.length,
      parentComms: scopedData.messages.length,
      compliance: scopedData.compliance.length,
      ai: "AI"
    };

    el.nav.innerHTML = views
      .filter((view) => view.id !== "billing")
      .map((view) => {
        const count = counts[view.id] ?? "";
        const active = view.id === state.activeView ? "active" : "";

        return `
          <button class="nav-btn ${active}" type="button" data-view="${escapeHtml(view.id)}">
            <span class="nav-label">${escapeHtml(view.label)}</span>
            <span class="nav-count">${escapeHtml(count)}</span>
          </button>
        `;
      })
      .join("");
  }

  function renderKpis(scopedData) {
    const enrolled = scopedData.leads.filter((lead) => lead.status === "enrolled").length;
    const highIntent = scopedData.leads.filter((lead) => Number(lead.intent_score || 0) >= 75).length;
    const needsReply = scopedData.messages.filter((message) => message.requires_reply || message.is_unread).length;

    const kpis = [
      {
        label: "Total Leads",
        value: number(scopedData.leads.length),
        note: isExecutive() && state.selectedLocation === "ALL" ? "Combined across all schools" : "Current location view"
      },
      {
        label: "Tours",
        value: number(scopedData.tours.length),
        note: "Scheduled, confirmed, completed, or pending"
      },
      {
        label: "Enrollments",
        value: number(enrolled),
        note: `${percent(enrolled, scopedData.leads.length)} lead-to-enrollment conversion`
      },
      {
        label: "Follow-Up",
        value: number(needsReply || highIntent),
        note: needsReply ? "Parent messages need attention" : "High-intent leads to prioritize"
      }
    ];

    el.kpiGrid.innerHTML = kpis.map((kpi) => `
      <article class="kpi">
        <small>${escapeHtml(kpi.label)}</small>
        <strong>${escapeHtml(kpi.value)}</strong>
        <span>${escapeHtml(kpi.note)}</span>
      </article>
    `).join("");
  }

  function renderOverview(scopedData) {
    const view = document.getElementById("view-overview");
    const isAllExecutive = isExecutive() && state.selectedLocation === "ALL";
    const sources = summarizeSources(scopedData.leads).slice(0, 8);
    const stages = summarizeStages(scopedData.leads);

    if (isAllExecutive) {
      const rows = buildLocationRows();

      view.innerHTML = `
        <section class="panel glass">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Executive Comparison</p>
              <h3>All Schools Performance</h3>
              <p class="panel-copy">
                Recommended executive view: compare volume, enrollment conversion, high-intent demand, source quality, parent follow-up, and compliance by school.
              </p>
            </div>
          </div>

          ${rows.length ? renderLocationComparisonTable(rows) : emptyState("No locations found", "Once locations or leads are available, comparison data will appear here.")}
        </section>

        <div class="two-col">
          <section class="panel glass">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Lead Sources</p>
                <h3>Portfolio Source Mix</h3>
              </div>
            </div>
            ${renderMetricList(sources, scopedData.leads.length)}
          </section>

          <section class="panel glass">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Pipeline</p>
                <h3>Combined Stage Health</h3>
              </div>
            </div>
            ${renderMetricList(stages.map((stage) => ({ label: stage.label, count: stage.count })), scopedData.leads.length)}
          </section>
        </div>
      `;
      return;
    }

    view.innerHTML = `
      <div class="two-col">
        <section class="panel glass">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Recent Activity</p>
              <h3>Recent Leads</h3>
            </div>
            <span class="chip">${number(scopedData.leads.length)} leads</span>
          </div>
          ${renderLeadFeed(scopedData.leads.slice(0, 8))}
        </section>

        <section class="panel glass">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Source Quality</p>
              <h3>Lead Source Mix</h3>
            </div>
          </div>
          ${renderMetricList(sources, scopedData.leads.length)}
        </section>
      </div>

      <section class="panel glass">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Pipeline</p>
            <h3>Stage Summary</h3>
          </div>
        </div>
        ${renderMetricList(stages.map((stage) => ({ label: stage.label, count: stage.count })), scopedData.leads.length)}
      </section>
    `;
  }

  function renderLocationComparisonTable(rows) {
    return `
      <div class="comparison-table-wrap">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>School</th>
              <th>Leads</th>
              <th>High Intent</th>
              <th>Tours</th>
              <th>Enrolled</th>
              <th>Conversion</th>
              <th>Top Source</th>
              <th>Follow-Up</th>
              <th>Compliance</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>
                  <strong>${escapeHtml(row.name)}</strong>
                  ${row.code ? `<div class="muted-cell">${escapeHtml(row.code)}</div>` : ""}
                </td>
                <td>${number(row.leads)}</td>
                <td>${number(row.highIntent)}</td>
                <td>${number(row.tours)}</td>
                <td>${number(row.enrolled)}</td>
                <td>${escapeHtml(row.conversion)}</td>
                <td>${escapeHtml(row.topSource)}</td>
                <td>${number(row.needsReply)}</td>
                <td>${number(row.openCompliance)} open</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPipeline(scopedData, visibleLeads) {
    const view = document.getElementById("view-pipeline");
    const stages = Object.fromEntries(STATUS_ORDER.map((status) => [status, []]));

    for (const lead of visibleLeads) {
      const status = STATUS_LABELS[lead.status] ? lead.status : "new";
      stages[status].push(lead);
    }

    view.innerHTML = `
      <section class="panel glass">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Lead Pipeline</p>
            <h3>Pipeline Board</h3>
            <p class="panel-copy">
              Tab labels now use the same order everywhere: name first, count second.
            </p>
          </div>
          <span class="chip">${number(visibleLeads.length)} showing</span>
        </div>

        <div class="kanban">
          ${STATUS_ORDER.map((status) => `
            <div class="kanban-col">
              <h4>
                <span>${escapeHtml(displayStatus(status))}</span>
                <strong>${number(stages[status].length)}</strong>
              </h4>

              ${stages[status].length
                ? stages[status].map(renderLeadKanbanCard).join("")
                : `<div class="empty"><strong>No ${escapeHtml(displayStatus(status).toLowerCase())} leads</strong></div>`
              }
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderLeadKanbanCard(lead) {
    return `
      <article class="kanban-card">
        <div class="card-title">${escapeHtml(lead.family_name || "Unnamed Family")}</div>
        <div class="card-meta">
          ${lead.child_name ? `${escapeHtml(lead.child_name)} · ` : ""}
          ${lead.child_age ? `Age ${escapeHtml(lead.child_age)} · ` : ""}
          ${escapeHtml(rowLocationName(lead))}
        </div>
        <div class="tag-row">
          <span class="tag ${statusClass(lead.status)}">${escapeHtml(displayStatus(lead.status))}</span>
          <span class="tag">${escapeHtml(normalizeSource(lead.source))}</span>
          ${lead.intent_score ? `<span class="tag">Intent ${escapeHtml(lead.intent_score)}</span>` : ""}
        </div>
      </article>
    `;
  }

  function renderTours(scopedData) {
    const view = document.getElementById("view-tours");
    const rows = scopedData.tours.slice(0, 30);

    view.innerHTML = `
      <section class="panel glass">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Tours</p>
            <h3>Tour Schedule</h3>
          </div>
          <span class="chip">${number(scopedData.tours.length)} tours</span>
        </div>

        <div class="tour-list">
          ${rows.length ? rows.map((tour) => {
            const lead = getLeadById(tour.lead_id);
            const familyName = tour.family_name || lead?.family_name || "Unknown Family";
            const childName = tour.child_name || lead?.child_name || "";

            return `
              <article class="tour-row">
                <div class="card-title">${escapeHtml(familyName)}</div>
                <div class="card-meta">
                  ${childName ? `${escapeHtml(childName)} · ` : ""}
                  ${escapeHtml(formatDate(tour.scheduled_at || tour.created_at))}
                </div>
                <div class="tag-row">
                  <span class="tag ${statusClass(tour.status)}">${escapeHtml(toTitle(tour.status || "scheduled"))}</span>
                  <span class="tag">${escapeHtml(rowLocationName(tour))}</span>
                </div>
              </article>
            `;
          }).join("") : emptyState("No tours found", "Tours will appear here when scheduled.")}
        </div>
      </section>
    `;
  }

  function renderOperations(scopedData) {
    const view = document.getElementById("view-operations");
    const capacity = scopedData.classrooms.reduce((sum, classroom) => sum + Number(classroom.capacity || 0), 0);

    view.innerHTML = `
      <div class="two-col">
        <section class="panel glass">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Classrooms</p>
              <h3>Classroom Readiness</h3>
            </div>
            <span class="chip">${number(capacity)} capacity</span>
          </div>

          <div class="section-list">
            ${scopedData.classrooms.length ? scopedData.classrooms.map((classroom) => `
              <article class="section-card">
                <div class="section-card-title">${escapeHtml(classroom.name || classroom.classroom_name || "Classroom")}</div>
                <div class="card-meta">
                  ${escapeHtml(classroom.age_group || "Age group not set")} · Capacity ${number(classroom.capacity)}
                </div>
                <div class="tag-row">
                  <span class="tag">${escapeHtml(rowLocationName(classroom))}</span>
                </div>
              </article>
            `).join("") : emptyState("No classrooms found", "Classroom records will appear here when available.")}
          </div>
        </section>

        <section class="panel glass">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Staffing</p>
              <h3>Staff Assignments</h3>
            </div>
            <span class="chip">${number(scopedData.staffing.length)} assignments</span>
          </div>

          <div class="section-list">
            ${scopedData.staffing.length ? scopedData.staffing.slice(0, 20).map((staff) => `
              <article class="section-card">
                <div class="section-card-title">${escapeHtml(staff.full_name || staff.name || "Staff Member")}</div>
                <div class="card-meta">
                  ${escapeHtml(toTitle(staff.role_name || staff.role || "Assigned"))}
                  ${staff.classroom_name ? ` · ${escapeHtml(staff.classroom_name)}` : ""}
                </div>
                <div class="tag-row">
                  <span class="tag">${escapeHtml(rowLocationName(staff))}</span>
                </div>
              </article>
            `).join("") : emptyState("No staffing records found", "Staffing records will appear here when available.")}
          </div>
        </section>
      </div>
    `;
  }

  function renderMessages(scopedData) {
    const view = document.getElementById("view-parentComms");
    const rows = scopedData.messages.slice(0, 40);

    view.innerHTML = `
      <section class="panel glass">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Parent Comms</p>
            <h3>Messages & Follow-Up</h3>
          </div>
          <span class="chip">${number(scopedData.messages.length)} messages</span>
        </div>

        <div class="msg-list">
          ${rows.length ? rows.map((message) => {
            const body = message.body || message.message || message.text || "No message body";
            const familyName = message.family_name || getLeadById(message.lead_id)?.family_name || message.sender_name || "Parent Message";

            return `
              <article class="msg-row">
                <div class="card-title">${escapeHtml(familyName)}</div>
                <div class="card-meta">${escapeHtml(body)}</div>
                <div class="tag-row">
                  <span class="tag">${escapeHtml(toTitle(message.channel || "message"))}</span>
                  ${message.requires_reply ? `<span class="tag status-tour_scheduled">Needs Reply</span>` : ""}
                  ${message.is_unread ? `<span class="tag status-new">Unread</span>` : ""}
                  <span class="tag">${escapeHtml(rowLocationName(message))}</span>
                </div>
              </article>
            `;
          }).join("") : emptyState("No parent messages found", "Parent communication records will appear here when available.")}
        </div>
      </section>
    `;
  }

  function renderCompliance(scopedData) {
    const view = document.getElementById("view-compliance");

    view.innerHTML = `
      <section class="panel glass">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Compliance</p>
            <h3>Compliance Items</h3>
          </div>
          <span class="chip">${number(scopedData.compliance.length)} records</span>
        </div>

        <div class="section-list">
          ${scopedData.compliance.length ? scopedData.compliance.map((item) => `
            <article class="section-card">
              <div class="section-card-title">${escapeHtml(item.title || "Compliance Item")}</div>
              <div class="card-meta">
                ${escapeHtml(item.detail || item.notes || "No details added.")}
              </div>
              <div class="tag-row">
                <span class="tag ${item.status === "complete" ? "status-enrolled" : "status-tour_scheduled"}">
                  ${escapeHtml(toTitle(item.status || "open"))}
                </span>
                <span class="tag">${escapeHtml(item.due_date || "No due date")}</span>
                <span class="tag">${escapeHtml(rowLocationName(item))}</span>
              </div>
            </article>
          `).join("") : emptyState("No compliance records found", "Compliance records will appear here when available.")}
        </div>
      </section>
    `;
  }

  function renderAi(scopedData) {
    const view = document.getElementById("view-ai");
    const sources = summarizeSources(scopedData.leads);
    const topSource = sources[0]?.label || "No source data yet";
    const newLeads = scopedData.leads.filter((lead) => (lead.status || "new") === "new").length;
    const highIntent = scopedData.leads.filter((lead) => Number(lead.intent_score || 0) >= 75).length;
    const needsReply = scopedData.messages.filter((message) => message.requires_reply || message.is_unread).length;
    const enrolled = scopedData.leads.filter((lead) => lead.status === "enrolled").length;

    const insights = [
      {
        title: "Lead Source Focus",
        value: topSource,
        copy: sources.length
          ? `${topSource} is currently the largest lead source in this view. Compare it against tour and enrollment movement before increasing spend.`
          : "No source data has been captured yet. Manual leads now require a source so this gets stronger over time."
      },
      {
        title: "Follow-Up Priority",
        value: number(needsReply || newLeads),
        copy: needsReply
          ? "Parent messages need attention. Prioritize these before chasing lower-intent leads."
          : "New leads are the next best queue to work. Fast first contact should improve tour conversion."
      },
      {
        title: "Conversion Watch",
        value: percent(enrolled, scopedData.leads.length),
        copy: `${number(enrolled)} enrolled from ${number(scopedData.leads.length)} leads in the current view. Watch location differences in the ALL executive view.`
      },
      {
        title: "High Intent",
        value: number(highIntent),
        copy: "High-intent leads should be moved to tour scheduling or application steps quickly."
      }
    ];

    view.innerHTML = `
      <section class="panel glass">
        <div class="panel-head">
          <div>
            <p class="eyebrow">AI Copilot</p>
            <h3>Recommended Focus</h3>
            <p class="panel-copy">
              Frontend-only recommendations based on the data already loaded from your CRM.
            </p>
          </div>
        </div>

        <div class="three-col">
          ${insights.map((insight) => `
            <article class="ai-card">
              <div class="ai-card-top">
                <strong>${escapeHtml(insight.title)}</strong>
                <span class="ai-badge">${escapeHtml(insight.value)}</span>
              </div>
              <p class="small-note">${escapeHtml(insight.copy)}</p>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderLeadFeed(leads) {
    if (!leads.length) {
      return emptyState("No leads found", "Add a manual lead or import leads to begin tracking pipeline activity.");
    }

    return `
      <div class="feed">
        ${leads.map((lead) => `
          <article class="lead-card">
            <div>
              <div class="lead-name">${escapeHtml(lead.family_name || "Unnamed Family")}</div>
              <div class="lead-meta">
                ${lead.child_name ? `${escapeHtml(lead.child_name)} · ` : ""}
                ${lead.child_age ? `Age ${escapeHtml(lead.child_age)} · ` : ""}
                ${escapeHtml(rowLocationName(lead))}
              </div>
              ${lead.notes ? `<div class="lead-meta">${escapeHtml(lead.notes)}</div>` : ""}
              <div class="tag-row">
                <span class="tag ${statusClass(lead.status)}">${escapeHtml(displayStatus(lead.status))}</span>
                <span class="tag">${escapeHtml(normalizeSource(lead.source))}</span>
                ${lead.intent_score ? `<span class="tag">Intent ${escapeHtml(lead.intent_score)}</span>` : ""}
              </div>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderMetricList(items, total) {
    if (!items.length) {
      return emptyState("No data yet", "Metrics will appear once records are available.");
    }

    return `
      <div class="metric-list">
        ${items.map((item) => `
          <div class="metric-row">
            <div>
              <div class="metric-title">${escapeHtml(item.label)}</div>
              <div class="small-note">${escapeHtml(percent(item.count, total))} of current view</div>
            </div>
            <strong>${number(item.count)}</strong>
          </div>
        `).join("")}
      </div>
    `;
  }

  function emptyState(title, copy = "") {
    return `
      <div class="empty">
        <strong>${escapeHtml(title)}</strong>
        ${copy ? `<span>${escapeHtml(copy)}</span>` : ""}
      </div>
    `;
  }

  function syncActiveView() {
    document.querySelectorAll(".view").forEach((view) => {
      view.classList.toggle("active", view.id === `view-${state.activeView}`);
    });

    document.querySelectorAll(".nav-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === state.activeView);
    });
  }

  function populateLeadSources() {
    el.leadSource.innerHTML = LEAD_SOURCES.map((source) => `
      <option value="${escapeHtml(source)}">${escapeHtml(source)}</option>
    `).join("");

    el.leadSource.value = "Walk-In";
  }

  function openManualLeadPanel() {
    state.manualLeadOpen = true;
    el.manualLeadPanel.classList.remove("hidden");
    renderLeadLocationSelect();

    if (!el.leadSource.value) {
      el.leadSource.value = "Walk-In";
    }

    window.requestAnimationFrame(() => el.leadFamilyName.focus());
  }

  function closeManualLeadPanel(reset = false) {
    state.manualLeadOpen = false;
    el.manualLeadPanel.classList.add("hidden");

    if (reset) {
      el.manualLeadForm.reset();
      el.leadSource.value = "Walk-In";
      renderLeadLocationSelect();
    }
  }

  async function saveManualLead(event) {
    event.preventDefault();

    const familyName = el.leadFamilyName.value.trim();
    const childName = el.leadChildName.value.trim();
    const childAgeRaw = el.leadChildAge.value.trim();
    const source = el.leadSource.value || "Walk-In";
    const locationId = el.leadLocation.value;
    const notes = el.leadNotes.value.trim();

    if (!familyName) {
      setAlert("Family name is required.", "error");
      el.leadFamilyName.focus();
      return;
    }

    if (!locationId) {
      setAlert("Please choose a location before saving the lead.", "error");
      el.leadLocation.focus();
      return;
    }

    const payload = {
      family_name: familyName,
      child_name: childName || null,
      child_age: childAgeRaw ? Number(childAgeRaw) : null,
      source,
      location_id: locationId,
      status: "new",
      notes: notes || null
    };

    if (Number.isNaN(payload.child_age)) {
      payload.child_age = null;
    }

    el.saveLead.disabled = true;
    el.saveLead.textContent = "Saving...";

    try {
      const { error } = await supabaseClient
        .from("leads")
        .insert([payload]);

      if (error) {
        throw error;
      }

      closeManualLeadPanel(true);
      await loadData();
      render();
      setAlert(`Lead added for ${familyName}.`, "success");
    } catch (error) {
      console.error("Manual lead save failed:", error);
      setAlert(error.message || "Could not save the lead.", "error");
    } finally {
      el.saveLead.disabled = false;
      el.saveLead.textContent = "Save Lead";
    }
  }

  function logout() {
    localStorage.removeItem("session");
    state.session = null;
    state.profile = null;
    state.locations = [];
    state.data = {
      leads: [],
      tours: [],
      messages: [],
      classrooms: [],
      staffing: [],
      compliance: []
    };
    el.email.value = "";
    setAlert("");
    showAuth();
  }

  function bindEvents() {
    el.loginForm.addEventListener("submit", login);

    el.signout.addEventListener("click", logout);

    el.refresh.addEventListener("click", async () => {
      await loadData();
      render();
      setAlert("Dashboard refreshed.", "success");
    });

    el.nav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-view]");
      if (!button) return;

      state.activeView = button.dataset.view;
      render();
    });

    el.locationSelect.addEventListener("change", () => {
      state.selectedLocation = el.locationSelect.value || "ALL";
      render();
    });

    el.searchInput.addEventListener("input", () => {
      state.search = el.searchInput.value;
      render();
    });

    el.openManualLead.addEventListener("click", openManualLeadPanel);
    el.closeManualLead.addEventListener("click", () => closeManualLeadPanel(false));
    el.cancelManualLead.addEventListener("click", () => closeManualLeadPanel(true));
    el.manualLeadForm.addEventListener("submit", saveManualLead);
  }

  function bootFromStorage() {
    populateLeadSources();
    bindEvents();

    const saved = localStorage.getItem("session");

    if (!saved) {
      showAuth();
      return;
    }

    try {
      bootstrap(JSON.parse(saved));
    } catch (error) {
      console.error("Saved session was invalid:", error);
      localStorage.removeItem("session");
      showAuth();
    }
  }

  bootFromStorage();
})();
