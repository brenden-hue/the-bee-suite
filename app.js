(() => {

const supabase = window.supabase.createClient(
  window.CRM_CONFIG.supabaseUrl,
  window.CRM_CONFIG.supabaseAnonKey
);

const state = {
  session: null,
  profile: null,
  data: {
    leads: [],
    tours: [],
    messages: [],
    classrooms: [],
    staffing: [],
    compliance: []
  }
};

const el = {
  auth: document.getElementById("authShell"),
  app: document.getElementById("appShell"),
  email: document.getElementById("emailInput"),
  login: document.getElementById("loginBtn"),
  msg: document.getElementById("authMessage"),
  signout: document.getElementById("signOutBtn"),
  refresh: document.getElementById("refreshBtn")
};

function showAuth(){ el.auth.classList.remove("hidden"); el.app.classList.add("hidden"); }
function showApp(){ el.auth.classList.add("hidden"); el.app.classList.remove("hidden"); }

async function login(){
  const email = el.email.value.trim().toLowerCase();

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", email)
    .single();

  if(!data){
    el.msg.textContent = "No account";
    return;
  }

  const session = { user: { id: data.id } };
  localStorage.setItem("session", JSON.stringify(session));

  await bootstrap(session);
}

async function bootstrap(session){
  state.session = session;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  state.profile = data;

  await loadData();
  render();
  showApp();
}

async function loadData(){
  const isExec = state.profile.role === "executive";

  const filter = (q) =>
    isExec ? q : q.eq("location_id", state.profile.location_id);

  state.data.leads = (await filter(supabase.from("leads").select("*"))).data || [];
  state.data.tours = (await filter(supabase.from("tours").select("*"))).data || [];
  state.data.messages = (await filter(supabase.from("messages").select("*"))).data || [];
  state.data.classrooms = (await filter(supabase.from("classrooms").select("*"))).data || [];
  state.data.staffing = (await filter(supabase.from("staffing").select("*"))).data || [];
  state.data.compliance = (await filter(supabase.from("compliance").select("*"))).data || [];
}

function render(){

  // OVERVIEW
  document.getElementById("view-overview").innerHTML = `
    Leads: ${state.data.leads.length}
    Tours: ${state.data.tours.length}
  `;

  // PIPELINE
  const stages = { new:[], contacted:[], enrolled:[] };

  state.data.leads.forEach(l=>{
    stages[l.status || "new"]?.push(l);
  });

  document.getElementById("view-pipeline").innerHTML = `
    <div class="kanban">
      ${Object.keys(stages).map(s=>`
        <div class="kanban-col">
          <h4>${s}</h4>
          ${stages[s].map(l=>`
            <div class="kanban-card">
              ${l.family_name}
            </div>
          `).join("")}
        </div>
      `).join("")}
    </div>
  `;

  // TOURS
  document.getElementById("view-tours").innerHTML =
    state.data.tours.map(t=>`<div>${t.family_name}</div>`).join("");

  // MESSAGES
  document.getElementById("view-parentComms").innerHTML =
    state.data.messages.map(m=>`<div>${m.message}</div>`).join("");

  // OPERATIONS
  document.getElementById("view-operations").innerHTML =
    `Classrooms: ${state.data.classrooms.length}`;

  // COMPLIANCE
  document.getElementById("view-compliance").innerHTML =
    state.data.compliance.map(c=>`<div>${c.title}</div>`).join("");
}

function logout(){
  localStorage.removeItem("session");
  showAuth();
}

el.login.onclick = login;
el.signout.onclick = logout;

el.refresh.onclick = async ()=>{
  await loadData();
  render();
};

const saved = localStorage.getItem("session");

if(saved){
  bootstrap(JSON.parse(saved));
}else{
  showAuth();
}

})();
