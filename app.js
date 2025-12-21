import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDocs, collection, onSnapshot, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBdu73Xb8xf4tJU4RLhJ82ANhLMI9eu0gI",
    authDomain: "rcem-qip-app.firebaseapp.com",
    projectId: "rcem-qip-app",
    storageBucket: "rcem-qip-app.firebasestorage.app",
    messagingSenderId: "231364231220",
    appId: "1:231364231220:web:6b2260e2c885d40ecb4a61",
    measurementId: "G-XHXTBQ29FX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentProjectId = null;
let projectData = null;
let chartInstance = null;
let unsubscribeProject = null;

// --- YOUR SPECIFIC HALO DATA ---
const haloTemplate = {
    meta: { title: "HALO Procedures QIP", created: new Date().toISOString() },
    checklist: {
        problem_desc: "Variation in staff confidence and awareness of High Acuity, Low Occurrence (HALO) emergency procedures. Equipment is scattered, no visual aids.",
        evidence: "Baseline survey (Oct 2025): Low confidence in Lateral Canthotomy & Hysterotomy. High staff support (94%) for standardised trolley.",
        aim: "To improve staff readiness for HALO procedures by increasing awareness of equipment locations and confidence to perform to ≥90% by June 2026.",
        outcome_measures: "1. Staff Confidence % (Survey)\n2. Location Awareness % (Survey)",
        process_measures: "1. Trolley Checklist Compliance %\n2. Teaching Sessions Delivered",
        balance_measures: "Cost of expired stock. Resus floor space.",
        team: "Project Lead: [Your Name], Clinical Champion: ED Consultant, Pharmacy Support, ED Team Lead",
        learning: "Initial feedback: Staff love the layout but requested Sengstaken tube be added.",
        sustain: "Monthly audit checklist integrated into standard Resus check. Induction training."
    },
    drivers: {
        primary: ["Equipment Access", "Staff Knowledge", "Cognitive Aids"],
        secondary: ["Centralised Trolley", "Standardised Layout", "Regular Teaching", "Visual Prompts"],
        changes: ["Dedicated HALO Trolley", "Laminated Aide-Memoires", "Handover Teaching"]
    },
    pdsa: [
        { id: 1, title: "Cycle 1: Trolley & Booklet", plan: "Introduce dedicated trolley + booklets.", do: "Deployed Nov 2025.", study: "Survey Jan 2026.", act: "Embed in induction." }
    ],
    chartData: [
        { date: "2025-10-15", value: 15, type: "confidence", note: "Baseline" },
        { date: "2025-10-15", value: 20, type: "location", note: "Baseline" }
    ]
};

// --- AUTH & INIT ---
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-sidebar').classList.remove('hidden');
        document.getElementById('app-sidebar').classList.add('flex');
        document.getElementById('user-display').textContent = user.email;
        loadProjectList();
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
    }
});

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try { await signInWithEmailAndPassword(auth, email, pass); } 
    catch { try { await createUserWithEmailAndPassword(auth, email, pass); } catch(err) { alert(err.message); } }
});

document.getElementById('logout-btn').addEventListener('click', () => { signOut(auth); location.reload(); });

// --- PROJECT MANAGEMENT ---
window.loadProjectList = async () => {
    window.router('projects');
    document.getElementById('top-bar').classList.add('hidden');
    const listEl = document.getElementById('project-list');
    listEl.innerHTML = '<div class="col-span-3 text-center text-slate-400">Loading...</div>';
    
    const snap = await getDocs(collection(db, `users/${currentUser.uid}/projects`));
    
    // AUTO-CREATE HALO PROJECT IF EMPTY
    if (snap.empty) {
        await addDoc(collection(db, `users/${currentUser.uid}/projects`), haloTemplate);
        window.loadProjectList(); // Reload to show it
        return;
    }

    listEl.innerHTML = '';
    snap.forEach(doc => {
        const d = doc.data();
        listEl.innerHTML += `
            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-rcem-purple transition-all" onclick="window.openProject('${doc.id}')">
                <h3 class="font-bold text-lg text-slate-800">${d.meta.title}</h3>
                <p class="text-xs text-slate-400 mt-2">Created: ${new Date(d.meta.created).toLocaleDateString()}</p>
            </div>
        `;
    });
};

window.createNewProject = async () => {
    const title = prompt("Project Title:", "New QIP");
    if (!title) return;
    const newProj = JSON.parse(JSON.stringify(haloTemplate)); // Clone template
    newProj.meta.title = title;
    // Clear data for new project
    newProj.checklist = {}; newProj.drivers = {primary:[], secondary:[], changes:[]}; newProj.pdsa = []; newProj.chartData = [];
    await addDoc(collection(db, `users/${currentUser.uid}/projects`), newProj);
    window.loadProjectList();
};

window.openProject = (id) => {
    currentProjectId = id;
    if (unsubscribeProject) unsubscribeProject();
    unsubscribeProject = onSnapshot(doc(db, `users/${currentUser.uid}/projects`, id), (doc) => {
        if (doc.exists()) {
            projectData = doc.data();
            document.getElementById('project-header-title').textContent = projectData.meta.title;
            // Defaults
            if(!projectData.checklist) projectData.checklist={};
            if(!projectData.drivers) projectData.drivers={primary:[],secondary:[],changes:[]};
            
            renderAll();
        }
    });
    document.getElementById('top-bar').classList.remove('hidden');
    window.router('dashboard');
};

// --- ROUTER ---
window.router = (view) => {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('bg-white/10', 'text-white'));
    const btn = document.getElementById(`nav-${view}`);
    if(btn) btn.classList.add('bg-white/10', 'text-white');

    if(view === 'protocols') renderProtocols();
    if(view === 'tools') renderTools();
    if(view === 'data') renderChart();
    
    lucide.createIcons();
};

function renderAll() {
    renderChecklist();
    renderPDSA();
    renderChart();
    document.getElementById('stat-data').textContent = projectData.chartData?.length || 0;
}

// --- CHECKLIST & PDSA ---
function renderChecklist() {
    const list = document.getElementById('checklist-container');
    const fields = [
        {k:"problem_desc", l:"Problem"}, {k:"aim", l:"SMART Aim"}, 
        {k:"measures", l:"Measures (Outcome/Process/Balance)"}, {k:"team", l:"Project Team"}
    ];
    list.innerHTML = fields.map(f => `
        <div class="bg-white p-4 rounded border border-slate-200">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">${f.l}</label>
            <textarea onchange="projectData.checklist['${f.k}']=this.value;saveData()" class="w-full text-sm p-2 border rounded resize-y">${projectData.checklist[f.k]||''}</textarea>
        </div>
    `).join('');
}
function renderPDSA() {
    document.getElementById('pdsa-container').innerHTML = (projectData.pdsa||[]).map(p => `
        <div class="bg-white p-4 rounded shadow border-l-4 border-rcem-purple">
            <h4 class="font-bold">${p.title}</h4>
            <div class="text-sm mt-2 grid grid-cols-2 gap-2">
                <div class="bg-slate-50 p-2"><strong>P:</strong> ${p.plan}</div><div class="bg-slate-50 p-2"><strong>D:</strong> ${p.do}</div>
                <div class="bg-slate-50 p-2"><strong>S:</strong> ${p.study}</div><div class="bg-slate-50 p-2"><strong>A:</strong> ${p.act}</div>
            </div>
        </div>
    `).join('');
}

// --- DATA ---
function renderChart() {
    if(!projectData) return;
    const ctx = document.getElementById('mainChart').getContext('2d');
    if(chartInstance) chartInstance.destroy();
    
    const data = projectData.chartData.sort((a,b)=>new Date(a.date)-new Date(b.date));
    const conf = data.filter(d=>d.type==='confidence').map(d=>({x:d.date, y:d.value}));
    const loc = data.filter(d=>d.type==='location').map(d=>({x:d.date, y:d.value}));

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                { label: 'Staff Confidence %', data: conf, borderColor: '#b71c1c', backgroundColor:'#b71c1c' },
                { label: 'Location Awareness %', data: loc, borderColor: '#0d47a1', backgroundColor:'#0d47a1' }
            ]
        },
        options: { scales: { y: { beginAtZero: true, max: 100 } } }
    });
}
window.addDataPoint = () => {
    projectData.chartData.push({
        date: document.getElementById('chart-date').value,
        value: document.getElementById('chart-value').value,
        type: document.getElementById('chart-cat').value
    });
    saveData(); renderChart();
};

async function saveData() {
    if (!currentProjectId) return;
    await setDoc(doc(db, `users/${currentUser.uid}/projects`, currentProjectId), projectData, { merge: true });
    const s = document.getElementById('save-status');
    s.classList.remove('opacity-0'); setTimeout(() => s.classList.add('opacity-0'), 2000);
}

// --- DRIVER DIAGRAM ---
window.renderTools = async () => {
    const d = projectData.drivers;
    const mCode = `graph LR\n  AIM[AIM] --> P[Primary]\n  P --> S[Secondary]\n  S --> C[Changes]\n` +
        d.primary.map((x,i)=>`  P-->P${i}["${x}"]`).join('\n') + '\n' +
        d.secondary.map((x,i)=>`  S-->S${i}["${x}"]`).join('\n') + '\n' +
        d.changes.map((x,i)=>`  C-->C${i}["${x}"]`).join('\n');
    document.getElementById('diagram-canvas').innerHTML = `<div class="mermaid">${mCode}</div>`;
    try { await mermaid.run(); } catch(e){}
}

// --- PROTOCOLS (EMBEDDED CONTENT) ---
window.renderProtocols = () => {
    const protocols = [
        { id: 'hysterotomy', t: "Resuscitative Hysterotomy", c: "pink", i: "baby" },
        { id: 'thoracotomy', t: "Resuscitative Thoracotomy", c: "red", i: "heart-crack" },
        { id: 'efona', t: "Emergency FONA (CICO)", c: "blue", i: "mic-2" },
        { id: 'canthotomy', t: "Lateral Canthotomy", c: "orange", i: "eye" },
        { id: 'escharotomy', t: "Escharotomy (Burns)", c: "slate", i: "flame" }
    ];
    document.getElementById('protocol-grid').innerHTML = protocols.map(p => `
        <div onclick="window.viewProtocol('${p.id}')" class="bg-white p-6 rounded-xl shadow-sm border-l-8 cursor-pointer hover:shadow-md transition-all flex justify-between items-center group" style="border-left-color: var(--halo-${p.c})">
            <span class="font-bold text-lg text-slate-700 group-hover:text-${p.c}-700">${p.t}</span>
            <i data-lucide="${p.i}" class="text-slate-300 group-hover:text-${p.c}-500"></i>
        </div>
    `).join('');
    lucide.createIcons();
};

window.viewProtocol = (id) => {
    const content = {
        hysterotomy: `<div class="bg-pink-900 text-white p-8"><h1 class="text-3xl font-bold">Resuscitative Hysterotomy</h1><p>Perimortem C-Section</p></div><div class="p-8 space-y-6"><div class="bg-red-50 border-l-4 border-red-600 p-4 font-bold text-red-800">GOAL: Delivery < 5 mins. Maternal Arrest + Uterus > Umbilicus.</div><ol class="list-decimal pl-5 space-y-2 text-lg"><li><strong>CPR:</strong> Manual displacement of uterus to LEFT.</li><li><strong>Incision:</strong> Midline Vertical (Umbilicus to Pubis). Go deep.</li><li><strong>Deliver:</strong> Vertical incision in uterus. Deliver baby.</li><li><strong>Pack:</strong> Pack uterus/abdomen. Continue CPR.</li></ol></div>`,
        thoracotomy: `<div class="bg-red-900 text-white p-8"><h1 class="text-3xl font-bold">Resuscitative Thoracotomy</h1><p>Clamshell Approach</p></div><div class="p-8 space-y-6"><div class="bg-red-50 border-l-4 border-red-600 p-4 font-bold text-red-800">Penetrating Arrest < 15min. Blunt Arrest < 10min.</div><ol class="list-decimal pl-5 space-y-2 text-lg"><li><strong>Incision:</strong> Clamshell (5th ICS, Mid-Ax to Mid-Ax).</li><li><strong>Open:</strong> Cut Sternum. Open Pericardium (Longitudinal).</li><li><strong>HOT:</strong> Heart (Relieve tamponade), Outflow (Plug holes), Thorax (Clamp Aorta).</li></ol></div>`
        // Add others as needed
    };
    
    document.getElementById('protocol-content').innerHTML = content[id] || `<div class="p-8">Protocol content loading...</div>`;
    document.getElementById('protocol-viewer').classList.remove('hidden');
};

// --- PRINT POSTER ---
window.printPoster = () => {
    const d = projectData;
    document.getElementById('print-container').innerHTML = `
        <div class="poster-layout">
            <div class="poster-header"><h1>${d.meta.title}</h1><p>${d.checklist.team}</p></div>
            <div class="poster-grid">
                <div class="box"><h2>Problem</h2><p>${d.checklist.problem_desc}</p></div>
                <div class="box"><h2>Aim</h2><p class="big">${d.checklist.aim}</p></div>
                <div class="box"><h2>Drivers</h2><ul>${d.drivers.secondary.map(s=>`<li>${s}</li>`).join('')}</ul></div>
                <div class="box grow"><h2>Results</h2><img src="${document.getElementById('mainChart').toDataURL()}" style="width:100%"></div>
            </div>
        </div>
    `;
    window.print();
};
