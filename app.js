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

/* -----------------------------
   Utility Functions (unchanged)
----------------------------- */

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

/* -----------------------------
   Auth UI Helpers (cleaned)
----------------------------- */

function setAuthMessage(message, isError = false) {
  elements.authMessage.textContent = message;
  elements.authMessage.style.color = isError ? "#ffd5d8" : "";
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
}

/* -----------------------------
   Auth Flow (NO GOOGLE)
----------------------------- */

async function handleEmailLogin() {
  const email = document.getElementById("emailInput")?.value?.trim().toLowerCase();
  const password = document.getElementById("passwordInput")?.value;

  if (!email || !password) {
    setAuthMessage("Enter email and password", true);
    return;
  }

  setAuthMessage("Signing in...");

  try {
    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    if (!data.session) {
      throw new Error("No session returned");
    }

    // OPTIONAL: extra validation against your profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .single();

    if (profileError || !profile) {
      throw new Error("No profile found for this email");
    }

    // Enforce your shared password logic
    if (profile.role === "admin" && password !== "BeeKeepers") {
      throw new Error("Invalid admin password");
    }

    if (profile.role !== "admin" && password !== "Bees") {
      throw new Error("Invalid location password");
    }

    setAuthMessage("Success");

    await showAppForSession(data.session);

  } catch (err) {
    console.error(err);
    setAuthMessage(err.message || "Login failed", true);
  }
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

/* -----------------------------
   Event Binding (cleaned)
----------------------------- */

function bindEvents() {
  const loginBtn = document.getElementById("loginBtn");

if (loginBtn) {
  loginBtn.addEventListener("click", handleEmailLogin);
}
  ["emailInput", "passwordInput"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;

  el.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleEmailLogin();
    }
  });
});
  async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;

  return data;
}
  if (elements.authRoleSwitch) {
    elements.authRoleSwitch.querySelectorAll(".auth-role-btn").forEach((button) => {
      button.addEventListener("click", () => {
        setSelectedLoginRole(button.dataset.loginRole);
        updateAuthRoleButtons();
        setAuthMessage(`Selected ${titleCase(button.dataset.loginRole)} role.`);
      });
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

/* -----------------------------
   Init (unchanged except auth)
----------------------------- */

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

