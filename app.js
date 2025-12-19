import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// --- YOUR HALO PROJECT DATA ---
// I have pre-filled this based on "HALO QIP Document Dec 2025.docx"
let projectData = {
    checklist: {
        title: "HALO Procedures Readiness Project",
        lead: "[Your Name]",
        team: "EM Consultants, Senior Sisters, Pharmacy",
        problem_desc: "Variation in staff confidence and awareness of High Acuity, Low Occurrence (HALO) emergency procedures. Baseline survey (Oct 2025) revealed widespread uncertainty about equipment locations (e.g. Canthotomy kit) and low confidence in performing procedures.",
        evidence: "Baseline Survey (n=16): Majority did not know equipment locations for 4/6 procedures. >80% reported 'not confident' for Hysterotomy/Escharotomy.",
        aim: "To increase staff awareness of equipment locations and confidence to perform/assist with 6 key HALO procedures to ≥90% by June 2026.",
        strategy_summary: "Centralisation of equipment (HALO Trolley) and Cognitive Aids (Laminated Booklets), supported by handover teaching.",
        results_summary: "Baseline: ~20% knowledge of locations. Cycle 1 in progress."
    },
    drivers: {
        primary: ["Equipment Accessibility", "Cognitive Support", "Staff Engagement"],
        secondary: ["Centralised Location", "Standardised Stock", "Visual Flowcharts", "Induction/Training"],
        changes: ["Dedicated HALO Trolley", "Laminated Aide-Memoires", "Monthly Checklist", "Handover Teaching"]
    },
    pdsa: [
        {
            id: "1",
            title: "Cycle 1: Trolley & Booklet",
            date: "2025-11-01",
            plan: "Introduce a dedicated HALO procedures trolley with attached aide-memoires in the Resus area. Predict >90% awareness in follow-up.",
            do: "Week 1: Finalise trolley contents & print booklets. Week 2: Departmental briefing & positioning of trolley.",
            study: "Repeat staff survey in Jan 2026 (3 months post-implementation). Track trolley checklist compliance.",
            act: "If successful, embed as permanent fixture and add to induction. If not, refine booklet design."
        }
    ],
    // Baseline data point estimate (20% confidence) based on your document
    chartData: [
        { date: "2025-10-31", value: "20", type: "data", note: "Baseline Survey" },
        { date: "2025-11-15", value: "0", type: "intervention", note: "Cycle 1: Trolley Launch" }
    ],
    chartGoal: 90,
    fishbone: { categories: [] }, // Kept empty as Driver Diagram is more relevant
    gantt: []
};

// --- HALO PROTOCOLS CONTENT (From your PDF) ---
const haloProtocols = [
    {
        title: "Resuscitative Hysterotomy",
        tags: "Obstetric • Arrest",
        steps: [
            "<strong>Location:</strong> Operate on trolley. Do NOT move to theatre.",
            "<strong>Incision:</strong> Midline Vertical from Xiphisternum to Pubis.",
            "<strong>Dissect:</strong> Separate rectus muscles bluntly.",
            "<strong>Uterus:</strong> Small vertical cut in lower segment. Insert fingers to protect baby.",
            "<strong>Deliver:</strong> Extend cut with shears. Deliver baby. Clamp cord."
        ],
        alert: "GOAL: Delivery < 5 mins. Continue CPR."
    },
    {
        title: "Resuscitative Thoracotomy",
        tags: "Trauma • Arrest",
        steps: [
            "<strong>Incision:</strong> Clamshell (5th ICS, Mid-Axillary to Mid-Axillary).",
            "<strong>Open:</strong> Cut Sternum with Gigli/Shears. Retract ribs.",
            "<strong>Pericardium:</strong> Longitudinal cut (avoid Phrenic nerve).",
            "<strong>Actions:</strong> Relieve tamponade. Clamp descending Aorta. Internal massage."
        ],
        alert: "Indications: Penetrating <15m / Blunt <10m witnessed arrest."
    },
    {
        title: "Surgical Airway (eFONA)",
        tags: "Airway • CICO",
        steps: [
            "<strong>Declare:</strong> 'CICO'. Extend neck maximally.",
            "<strong>Identify:</strong> Laryngeal Handshake -> CTM.",
            "<strong>Incision:</strong> Transverse stab CTM. Blade edge to you.",
            "<strong>Railroad:</strong> Bougie down blade. Tube (6.0) over bougie.",
            "<strong>Confirm:</strong> Inflate cuff. Check EtCO2."
        ],
        alert: "Do NOT withdraw scalpel until bougie is in."
    },
    {
        title: "Lateral Canthotomy",
        tags: "Eye • Vision Loss",
        steps: [
            "<strong>Prep:</strong> LA with Adrenaline.",
            "<strong>Crush:</strong> Clamp lateral canthus (1 min).",
            "<strong>Cut:</strong> Cut horizontally (1cm).",
            "<strong>Cantholysis:</strong> Strum & Cut Inferior Crus (Infero-posteriorly).",
            "<strong>Check:</strong> Lower lid should hang loose."
        ],
        alert: "Indication: Retrobulbar Haematoma + IOP >40."
    },
    {
        title: "Escharotomy",
        tags: "Burns • Circulation",
        steps: [
            "<strong>Chest:</strong> Roman Breastplate (Ant Axillary Lines + Cross bars).",
            "<strong>Limbs:</strong> Mid-Lateral & Mid-Medial lines.",
            "<strong>Depth:</strong> Through eschar to subcut fat only.",
            "<strong>Avoid:</strong> Ulnar nerve (medial elbow), Common Peroneal (fibular head)."
        ],
        alert: "Ensure chest wall 'springs' open."
    },
    {
        title: "Chest Drain (Open)",
        tags: "Trauma • Haemothorax",
        steps: [
            "<strong>Site:</strong> 5th ICS, Anterior Axillary Line.",
            "<strong>Incision:</strong> 3cm Transverse.",
            "<strong>Dissect:</strong> Bluntly over UPPER border of lower rib.",
            "<strong>Entry:</strong> 'Pop' pleura. Finger sweep (360 degrees).",
            "<strong>Insert:</strong> 28-32F Tube. Fogging + Swinging."
        ],
        alert: "Finger sweep is mandatory."
    }
];

// --- APP LOGIC ---

// ... [Include Firebase Config & Auth Logic from previous app.js here] ...
// (For brevity, assuming standard Firebase setup is kept)

window.router = (viewId) => {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    if(viewId === 'tools') renderTools();
    if(viewId === 'data') renderChart();
    if(viewId === 'halo') renderHalo();
};

function renderDashboard() {
    // Stats
    const checklistCount = Object.values(projectData.checklist).filter(Boolean).length;
    const progress = Math.round((checklistCount / 8) * 100); // Approx
    
    document.getElementById('stats-grid').innerHTML = `
        <div class="glass p-6 rounded-xl border-l-4 border-emerald-500">
            <div class="text-slate-500 text-sm font-bold uppercase">Checklist</div>
            <div class="text-3xl font-bold text-slate-800">${progress}%</div>
        </div>
        <div class="glass p-6 rounded-xl border-l-4 border-indigo-500">
            <div class="text-slate-500 text-sm font-bold uppercase">PDSA Cycles</div>
            <div class="text-3xl font-bold text-slate-800">${projectData.pdsa.length}</div>
        </div>
        <div class="glass p-6 rounded-xl border-l-4 border-amber-500">
            <div class="text-slate-500 text-sm font-bold uppercase">Baseline Knowledge</div>
            <div class="text-3xl font-bold text-slate-800">~20%</div>
        </div>
    `;
}

// Renders your specific HALO Protocols
function renderHalo() {
    const grid = document.getElementById('halo-grid');
    grid.innerHTML = haloProtocols.map(p => `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all">
            <div class="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-start">
                <h3 class="font-bold text-slate-800 text-lg">${p.title}</h3>
                <span class="bg-slate-200 text-slate-600 text-xs px-2 py-1 rounded-full font-medium">${p.tags}</span>
            </div>
            <div class="p-4">
                <div class="mb-4 bg-red-50 text-red-700 text-xs p-2 rounded border border-red-100 font-bold">
                    <i data-lucide="alert-circle" class="w-3 h-3 inline mr-1"></i> ${p.alert}
                </div>
                <ol class="list-decimal pl-4 space-y-2 text-sm text-slate-700">
                    ${p.steps.map(s => `<li>${s}</li>`).join('')}
                </ol>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

function renderChecklist() {
    // Uses your custom HALO data
    const list = document.getElementById('checklist-container');
    const fields = [
        {k:'title', l:'Project Title'}, {k:'problem_desc', l:'Problem'}, 
        {k:'aim', l:'SMART Aim'}, {k:'evidence', l:'Evidence (Baseline)'},
        {k:'strategy_summary', l:'Strategy'}, {k:'results_summary', l:'Results'}
    ];
    list.innerHTML = fields.map(f => `
        <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">${f.l}</label>
            <div class="text-slate-800 text-sm whitespace-pre-wrap">${projectData.checklist[f.k] || '...'}</div>
        </div>
    `).join('');
}

function renderTools() {
    // Forces Driver Diagram view for HALO
    const container = document.getElementById('tool-canvas');
    const d = projectData.drivers;
    // Construct Mermaid graph
    let mm = `graph LR\n  AIM[Aim: 90% Confidence] --> P[Primary Drivers]\n  P --> S[Secondary Drivers]\n  S --> C[Change Ideas]\n`;
    d.primary.forEach((x,i) => mm += `P --> P${i}[${x}]\n`);
    d.secondary.forEach((x,i) => mm += `S --> S${i}[${x}]\n`);
    d.changes.forEach((x,i) => mm += `C --> C${i}[${x}]\n`);
    
    container.innerHTML = `<div class="mermaid">${mm}</div>`;
    mermaid.init(undefined, container.querySelectorAll('.mermaid'));
}

function renderChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    const data = projectData.chartData;
    // Simple Chart.js rendering (omitted for brevity, same as previous but uses projectData.chartData)
    // ... [Insert Chart Code] ...
}

function renderPDSA() {
    const list = document.getElementById('pdsa-list');
    list.innerHTML = projectData.pdsa.map(p => `
        <div class="bg-white rounded-xl shadow-sm border border-l-4 border-l-rcem-purple overflow-hidden">
            <div class="p-4 bg-slate-50 border-b flex justify-between">
                <h3 class="font-bold text-rcem-purple">${p.title}</h3>
                <span class="text-xs text-slate-500">${p.date}</span>
            </div>
            <div class="p-4 grid grid-cols-2 gap-4 text-sm">
                <div><span class="font-bold block text-xs uppercase text-slate-400">Plan</span>${p.plan}</div>
                <div><span class="font-bold block text-xs uppercase text-slate-400">Do</span>${p.do}</div>
                <div><span class="font-bold block text-xs uppercase text-slate-400">Study</span>${p.study}</div>
                <div><span class="font-bold block text-xs uppercase text-slate-400">Act</span>${p.act}</div>
            </div>
        </div>
    `).join('');
}

// Global scope
window.saveData = () => { alert("In a real app, this would save to Firebase!"); };
window.router('dashboard'); // Init
renderDashboard();
