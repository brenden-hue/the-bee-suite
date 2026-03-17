const supabase = window.supabase.createClient(
window.CRM_CONFIG.supabaseUrl,
window.CRM_CONFIG.supabaseKey
);

let profile, leads=[];

async function login(){
const email=document.getElementById("email").value;
await supabase.auth.signInWithOtp({email});
alert("check email");
}

async function init(){
const {data:{user}}=await supabase.auth.getUser();
if(!user)return;

document.getElementById("auth").style.display="none";
document.getElementById("app").style.display="block";

const {data}=await supabase.from("profiles").select("*").eq("email",user.email).single();
profile=data;

await loadLeads();
}

async function loadLeads(){
let q=supabase.from("leads").select("*");

if(profile.role!=="corporate_admin"){
q=q.eq("location_id",profile.location_id);
}

const {data}=await q;
leads=data||[];

render();
}

function render(){
document.getElementById("title").innerText="Dashboard";

document.getElementById("stats").innerHTML=
"Total Leads: "+leads.length;

document.getElementById("stages").innerHTML=
"Stages: "+JSON.stringify(countBy("stage"));

document.getElementById("sources").innerHTML=
"Sources: "+JSON.stringify(countBy("source"));

document.getElementById("trend").innerHTML=
"Recent Leads: "+leads.slice(0,5).length;

document.getElementById("leads").innerHTML=
leads.map(l=>"<div>"+l.parent_name+" - "+l.stage+"</div>").join("");
}

function countBy(field){
const map={};
leads.forEach(l=>{
map[field]=map[field]||{};
map[l[field]]= (map[l[field]]||0)+1;
});
return map[field];
}

init();
