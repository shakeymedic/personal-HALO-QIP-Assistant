import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// --- YOUR HALO PROJECT DATA ---
[cite_start]// Pre-filled from "HALO QIP Document Dec 2025.docx" [cite: 1339-1361]
let projectData = {
    checklist: {
        title: "HALO Procedures Readiness Project",
        lead: "[Your Name]",
        team: "EM Consultants, Senior Sisters, Pharmacy",
        problem_desc: "Variation in staff confidence and awareness of HALO procedures. Baseline survey (Oct 2025) revealed widespread uncertainty about equipment locations and low confidence.",
        evidence: "Baseline Survey (n=16): Majority did not know locations for 4/6 procedures. >80% reported 'not confident' for Hysterotomy/Escharotomy.",
        aim: "To increase staff awareness of equipment locations and confidence to perform/assist with 6 key HALO procedures to ≥90% by June 2026.",
        strategy_summary: "Centralisation of equipment (HALO Trolley) and Cognitive Aids (Laminated Booklets), supported by handover teaching.",
        results_summary: "Baseline: ~20% knowledge. Cycle 1 Implementation in progress."
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
            plan: "Introduce a dedicated HALO procedures trolley with attached aide-memoires. Predict >90% awareness in follow-up.",
            do: "Week 1: Finalise trolley contents & print booklets. Week 2: Departmental briefing & positioning.",
            study: "Repeat staff survey in Jan 2026. Track trolley checklist compliance.",
            act: "If successful, embed as permanent fixture and add to induction."
        }
    ],
    [cite_start]// Baseline data point based on your document [cite: 1382]
    chartData: [
        { date: "2025-10-31", value: "20", type: "data", note: "Baseline Survey" },
        { date: "2025-11-15", value: "0", type: "intervention", note: "Cycle 1 Launch" }
    ],
    chartGoal: 90
};

// --- HALO PROTOCOLS CONTENT ---
[cite_start]// Digitised from "HALO QRH.pdf" [cite: 548-1193]
const haloProtocols = [
    {
        title: "Resuscitative Hysterotomy",
        tags: "Obstetric • Arrest",
        icon: "baby",
        color: "rose",
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
        icon: "heart",
        color: "red",
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
        icon: "wind",
        color: "blue",
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
        icon: "eye",
        color: "amber",
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
        icon: "flame",
        color: "orange",
        steps: [
            "<strong>Chest:</strong> Roman Breastplate (Ant Axillary Lines + Cross bars).",
            "<strong>Limbs:</strong> Mid-Lateral & Mid-Medial lines.",
            "<strong>Depth:</strong> Through eschar to subcut fat only.",
            "<strong>Avoid:</strong> Ulnar nerve (medial elbow), Common Peroneal (fibular head)."
        ],
        alert: "Ensure chest wall 'springs' open."
    },
    {
        title: "Severe Max-Fax Bleed",
        tags: "Trauma • Airway",
        icon: "skull",
        color: "slate",
        steps: [
            "<strong>Position:</strong> Sit up/Lean forward if conscious.",
            "<strong>Midface:</strong> Pull maxilla FORWARD to disimpact (Floating Face).",
            "<strong>Pack:</strong> Bilateral Rapid Rhinos or Foley catheters (inflate & pull back).",
            "<strong>Adjuncts:</strong> TXA 1g. Bite block to maintain airway."
        ],
        alert: "Intubate early. Avoid nasal route."
    }
];

// --- APP LOGIC ---

window.router = (viewId) => {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    if(viewId === 'tools') renderTools();
    if(viewId === 'data') renderChart();
    if(viewId === 'halo') renderHalo();
    if(viewId === 'dashboard') renderDashboard();
    if(viewId === 'checklist') renderChecklist();
    if(viewId === 'pdsa') renderPDSA();
};

function renderDashboard() {
    const checklistCount = Object.values(projectData.checklist).filter(Boolean).length;
    const progress = Math.round((checklistCount / 8) * 100); 
    
    document.getElementById('stats-grid').innerHTML = `
        <div class="glass p-6 rounded-xl border-l-4 border-emerald-500">
            <div class="text-slate-500 text-xs font-bold uppercase tracking-wider">Checklist</div>
            <div class="text-3xl font-bold text-slate-800">${progress}%</div>
        </div>
        <div class="glass p-6 rounded-xl border-l-4 border-indigo-500">
            <div class="text-slate-500 text-xs font-bold uppercase tracking-wider">PDSA Cycles</div>
            <div class="text-3xl font-bold text-slate-800">${projectData.pdsa.length}</div>
        </div>
        <div class="glass p-6 rounded-xl border-l-4 border-amber-500">
            <div class="text-slate-500 text-xs font-bold uppercase tracking-wider">Baseline Confidence</div>
            <div class="text-3xl font-bold text-slate-800">20%</div>
        </div>
    `;
}

// Renders the specific HALO Protocols
function renderHalo() {
    const grid = document.getElementById('halo-grid');
    grid.innerHTML = haloProtocols.map(p => `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all">
            <div class="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-start">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-${p.color}-100 rounded-lg text-${p.color}-600">
                        <i data-lucide="${p.icon}" class="w-5 h-5"></i>
                    </div>
                    <h3 class="font-bold text-slate-800 text-lg leading-tight">${p.title}</h3>
                </div>
            </div>
            <div class="p-5">
                <span class="inline-block bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full font-bold mb-3 border border-slate-200">${p.tags}</span>
                <div class="mb-4 bg-red-50 text-red-800 text-xs p-3 rounded border border-red-100 font-bold flex gap-2">
                    <i data-lucide="alert-triangle" class="w-4 h-4 shrink-0"></i> 
                    <span>${p.alert}</span>
                </div>
                <ol class="list-decimal pl-4 space-y-3 text-sm text-slate-700">
                    ${p.steps.map(s => `<li class="pl-1">${s}</li>`).join('')}
                </ol>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

function renderChecklist() {
    const list = document.getElementById('checklist-container');
    const fields = [
        {k:'title', l:'Project Title'}, {k:'problem_desc', l:'Problem'}, 
        {k:'aim', l:'SMART Aim'}, {k:'evidence', l:'Evidence (Baseline)'},
        {k:'strategy_summary', l:'Strategy'}, {k:'results_summary', l:'Results'}
    ];
    list.innerHTML = fields.map(f => `
        <div class="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
            <label class="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-wide">${f.l}</label>
            <div class="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed">${projectData.checklist[f.k] || '...'}</div>
        </div>
    `).join('');
}

function renderTools() {
    // Automatically renders the Driver Diagram from the QIP Document
    const container = document.getElementById('tool-canvas');
    const d = projectData.drivers;
    
    let mm = `graph LR\n  AIM[Aim: 90% Confidence] --> P[Primary Drivers]\n  P --> S[Secondary Drivers]\n  S --> C[Change Ideas]\n`;
    d.primary.forEach((x,i) => mm += `P --> P${i}[${x}]\n`);
    d.secondary.forEach((x,i) => mm += `S --> S${i}[${x}]\n`);
    d.changes.forEach((x,i) => mm += `C --> C${i}[${x}]\n`);
    
    // Styling the nodes for professional look
    mm += `classDef default fill:#fff,stroke:#333,stroke-width:1px; classDef aim fill:#2d2e83,color:#fff,stroke:none; class AIM aim;`;

    container.innerHTML = `<div class="mermaid">${mm}</div>`;
    mermaid.init(undefined, container.querySelectorAll('.mermaid'));
}

function renderChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    const data = projectData.chartData;
    
    // Sort
    data.sort((a,b) => new Date(a.date) - new Date(b.date));
    const labels = data.map(d => d.date);
    const values = data.map(d => d.type === 'data' ? d.value : null); // Only plot data points, not interventions

    // Annotations for Cycle 1
    const annotations = {};
    data.filter(d => d.type === 'intervention').forEach((d, i) => {
        annotations[`line${i}`] = {
            type: 'line',
            scaleID: 'x',
            value: d.date,
            borderColor: '#f36f21',
            borderWidth: 2,
            borderDash: [5, 5],
            label: { display: true, content: d.note, position: 'start', backgroundColor: '#f36f21', color: 'white' }
        };
    });
    
    // Goal Line
    annotations['goal'] = {
        type: 'line',
        yMin: projectData.chartGoal,
        yMax: projectData.chartGoal,
        borderColor: '#10b981',
        borderWidth: 2,
        label: { display: true, content: 'Target (90%)', position: 'end', backgroundColor: '#10b981', color:'white' }
    };

    if(window.myChart) window.myChart.destroy();

    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '% Staff Confidence',
                data: values,
                borderColor: '#2d2e83',
                backgroundColor: 'rgba(45, 46, 131, 0.1)',
                tension: 0.3,
                spanGaps: true,
                pointRadius: 6,
                pointBackgroundColor: '#2d2e83'
            }]
        },
        options: {
            responsive: true,
            plugins: { annotation: { annotations } },
            scales: {
                y: { beginAtZero: true, max: 100, title: {display: true, text: '% Confidence'} }
            }
        }
    });
}

function renderPDSA() {
    const list = document.getElementById('pdsa-list');
    list.innerHTML = projectData.pdsa.map(p => `
        <div class="bg-white rounded-xl shadow-sm border border-l-4 border-l-rcem-purple overflow-hidden">
            <div class="p-4 bg-slate-50 border-b flex justify-between items-center">
                <h3 class="font-bold text-rcem-purple text-lg">${p.title}</h3>
                <span class="text-xs font-mono text-slate-500 bg-white px-2 py-1 rounded border">${p.date}</span>
            </div>
            <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div><span class="font-bold block text-xs uppercase text-slate-400 mb-1">Plan</span><p class="text-slate-700">${p.plan}</p></div>
                <div><span class="font-bold block text-xs uppercase text-slate-400 mb-1">Do</span><p class="text-slate-700">${p.do}</p></div>
                <div><span class="font-bold block text-xs uppercase text-slate-400 mb-1">Study</span><p class="text-slate-700">${p.study}</p></div>
                <div><span class="font-bold block text-xs uppercase text-slate-400 mb-1">Act</span><p class="text-slate-700">${p.act}</p></div>
            </div>
        </div>
    `).join('');
}

// Global functions exposed to HTML
window.generateReport = () => {
    const el = document.getElementById('view-checklist');
    html2pdf().from(el).save('HALO_QIP_Report.pdf');
};
window.saveData = () => { alert("Data Saved! (In a full app this connects to Firebase)"); };
window.addDataPoint = () => {
    // Simulation
    const val = prompt("Enter % Confidence:");
    const note = prompt("Enter Note (optional):");
    if(val) {
        projectData.chartData.push({ date: new Date().toISOString().split('T')[0], value: val, type: 'data', note: note });
        renderChart();
    }
};
window.addPDSACycle = () => {
    alert("In the full app, this opens the PDSA wizard.");
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    window.router('dashboard');
    lucide.createIcons();
});
