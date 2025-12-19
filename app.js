import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// --- CONFIGURATION ---
// PASTE YOUR FIREBASE CONFIG HERE (Keep your existing config!)
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- STATE MANAGEMENT ---
let currentUser = null;
let geminiModel = null;
let projectData = {
    checklist: { title: "HALO QIP", aim: "90% Confidence", status: "New" },
    pdsa: [],
    chartData: [{ date: new Date().toISOString().split('T')[0], value: 0, type: 'data', note: 'Baseline' }],
    chartGoal: 90
};

// --- UPDATED HALO PROTOCOLS ---
// Includes all Trolley items + QRH extras with standard RCEM/ALS steps
const haloProtocols = [
    // --- TROLLEY ITEMS ---
    {
        title: "Resuscitative Hysterotomy",
        tags: "Trolley • Obstetric",
        icon: "baby",
        color: "rose",
        steps: [
            "<strong>Loc:</strong> Xiphisternum to Pubis (Midline).",
            "<strong>Uterus:</strong> Vertical incision high in body.",
            "<strong>Deliver:</strong> Remove baby, clamp cord.",
            "<strong>Haemostasis:</strong> Pack uterus, manual pressure."
        ],
        alert: "GOAL: Delivery <5 mins of arrest."
    },
    {
        title: "Sengstaken Tube",
        tags: "Trolley • GI Bleed",
        icon: "anchor",
        color: "amber",
        steps: [
            "<strong>Prep:</strong> Intubate first. Check balloons.",
            "<strong>Insert:</strong> Lube & advance to 50cm.",
            "<strong>Gastric:</strong> Inflate 250ml air. Clamp.",
            "<strong>Traction:</strong> Pull back until resistance. Tape/Weight (1kg)."
        ],
        alert: "Do NOT inflate oesophageal balloon initially."
    },
    {
        title: "Resuscitative Thoracotomy",
        tags: "Trolley • Trauma",
        icon: "heart",
        color: "red",
        steps: [
            "<strong>Incise:</strong> Clamshell (5th ICS).",
            "<strong>Open:</strong> Cut sternum, retract ribs.",
            "<strong>Release:</strong> Open pericardium (longitudinal).",
            "<strong>Control:</strong> Internal massage, clamp aorta."
        ],
        alert: "Indications: Pen <15m / Blunt <10m arrest."
    },
    {
        title: "Escharotomy",
        tags: "Trolley • Burns",
        icon: "flame",
        color: "orange",
        steps: [
            "<strong>Chest:</strong> Roman Breastplate squares.",
            "<strong>Limbs:</strong> Mid-axial lines (medial/lateral).",
            "<strong>Depth:</strong> Through eschar to subcut fat only.",
            "<strong>Digits:</strong> Mid-lateral lines."
        ],
        alert: "Run finger along cut to ensure release."
    },
    {
        title: "Open Chest Drain",
        tags: "Trolley • Airway/Breathing",
        icon: "wind",
        color: "blue",
        steps: [
            "<strong>Site:</strong> Triangle of Safety (5th ICS).",
            "<strong>Access:</strong> Incision, blunt dissect, finger sweep.",
            "<strong>Insert:</strong> Tube posterior & apical.",
            "<strong>Secure:</strong> Mattress suture & Underwater seal."
        ],
        alert: "Never use a trocar."
    },
    {
        title: "Pericardiocentesis",
        tags: "Trolley • Cardiac",
        icon: "activity",
        color: "indigo",
        steps: [
            "<strong>Site:</strong> Left Subxiphoid.",
            "<strong>Aim:</strong> Towards Left Shoulder (45°).",
            "<strong>Aspirate:</strong> Constant suction on 20ml syringe.",
            "<strong>Capture:</strong> If successful, Seldinger wire -> Pigtail."
        ],
        alert: "Use U/S guidance if available."
    },
    {
        title: "Subclavian Central Line",
        tags: "Trolley • Access",
        icon: "git-commit",
        color: "cyan",
        steps: [
            "<strong>Pos:</strong> Head down (Trendelenburg).",
            "<strong>Target:</strong> Junction of medial/mid 3rd clavicle.",
            "<strong>Angle:</strong> Horizontal, under clavicle, aim Sternal Notch.",
            "<strong>Wire:</strong> Seldinger technique."
        ],
        alert: "High risk of Pneumothorax."
    },
    {
        title: "Lateral Canthotomy",
        tags: "Trolley • Eye",
        icon: "eye",
        color: "emerald",
        steps: [
            "<strong>Inject:</strong> LA into lateral canthus.",
            "<strong>Clamp:</strong> Crimp lateral canthus (1 min).",
            "<strong>Cut:</strong> Cut canthus horizontally (1cm).",
            "<strong>Release:</strong> Strum & cut inf. crus (inferiorly)."
        ],
        alert: "Indication: Retrobulbar Haematoma."
    },
    {
        title: "Max-Fax Bleed",
        tags: "Trolley • Airway",
        icon: "skull",
        color: "slate",
        steps: [
            "<strong>Position:</strong> Sit up + Lean forward.",
            "<strong>Manoeuvre:</strong> Pull maxilla forward (Floating Face).",
            "<strong>Pack:</strong> Rapid Rhino / Foley Catheters (inflate).",
            "<strong>Meds:</strong> TXA / Adrenaline soaked gauze."
        ],
        alert: "Secure airway early (avoid nasal)."
    },

    // --- QRH ONLY ITEMS ---
    {
        title: "Emergency Breech",
        tags: "QRH Only • Obstetric",
        icon: "user-x",
        color: "pink",
        steps: [
            "<strong>Hands Off:</strong> Wait until scapulae visible.",
            "<strong>Legs:</strong> Pinard Manoeuvre if stuck.",
            "<strong>Arms:</strong> Lovset (Rotate 90°, arm down, Rotate 180°).",
            "<strong>Head:</strong> Mauriceau-Smellie-Veit (Jaw flexion)."
        ],
        alert: "Do not pull! Keep back anterior."
    },
    {
        title: "External Pacing",
        tags: "QRH Only • Cardiac",
        icon: "zap",
        color: "yellow",
        steps: [
            "<strong>Pads:</strong> Anterior/Posterior preferred.",
            "<strong>Settings:</strong> Demand mode. Rate 70.",
            "<strong>Capture:</strong> Start 30mA, incr until Capture (Broad QRS).",
            "<strong>Confirm:</strong> Check palpable pulse (femoral)."
        ],
        alert: "Sedation usually required."
    },
    {
        title: "Lipid Rescue (LAST)",
        tags: "QRH Only • Tox",
        icon: "droplet",
        color: "lime",
        steps: [
            "<strong>Bolus:</strong> 1.5ml/kg 20% Lipid (approx 100ml).",
            "<strong>Repeat:</strong> x2 at 5 mins if no ROSC.",
            "<strong>Infusion:</strong> 15ml/kg/hr (approx 1000ml/hr).",
            "<strong>CPR:</strong> Continue for >1 hour."
        ],
        alert: "For Local Anaesthetic Toxicity."
    },
    {
        title: "Surgical Airway (eFONA)",
        tags: "QRH Only • Airway",
        icon: "scissors",
        color: "blue",
        steps: [
            "<strong>Plan D:</strong> Declare CICO.",
            "<strong>Cut:</strong> Transverse stab CTM. Blade to you.",
            "<strong>Bougie:</strong> Coude tip down blade.",
            "<strong>Railroad:</strong> Size 6.0 ETT."
        ],
        alert: "Scalpel-Bougie-Tube."
    }
];

// --- AUTHENTICATION & SYNC ---

// 1. Listen for Auth State
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('app-container').classList.remove('opacity-0');
        document.getElementById('user-display').textContent = user.email;
        
        // Start Realtime Sync
        initDataSync(user.uid);
        initGemini(user.uid);
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('app-container').classList.add('opacity-0');
        currentUser = null;
    }
});

// 2. Data Sync (Realtime)
function initDataSync(uid) {
    const docRef = doc(db, "users", uid, "projects", "halo");
    
    onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
            projectData = snap.data();
            refreshUI(); 
        } else {
            setDoc(docRef, projectData);
        }
    });
}

// 3. Init Gemini
async function initGemini(uid) {
    const keyRef = doc(db, "users", uid, "settings", "api_keys");
    const snap = await getDoc(keyRef);
    
    if (snap.exists() && snap.data().gemini) {
        const genAI = new GoogleGenerativeAI(snap.data().gemini);
        geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("AI Connected");
    } else {
        window.toggleSettings();
    }
}

// --- GLOBAL EXPORTS ---

window.login = () => signInWithPopup(auth, provider);
window.logout = () => signOut(auth);

window.saveApiKey = async () => {
    const key = document.getElementById('api-key-input').value;
    if (currentUser && key) {
        await setDoc(doc(db, "users", currentUser.uid, "settings", "api_keys"), { gemini: key }, { merge: true });
        window.toggleSettings();
        initGemini(currentUser.uid); 
        alert("Key Saved Securely!");
    }
};

window.addDataPoint = async () => {
    if (!currentUser) return;
    const date = document.getElementById('chart-date').value;
    const val = document.getElementById('chart-value').value;
    const note = document.getElementById('chart-note').value;
    
    if (date && val) {
        const newData = [...projectData.chartData, { date, value: val, type: 'data', note }];
        await setDoc(doc(db, "users", currentUser.uid, "projects", "halo"), { 
            ...projectData, 
            chartData: newData 
        });
    }
};

window.addPDSACycle = async () => {
    const title = prompt("Cycle Title:");
    if (title) {
        const newCycle = { id: Date.now().toString(), title, plan: "...", do: "...", study: "...", act: "..." };
        await setDoc(doc(db, "users", currentUser.uid, "projects", "halo"), {
            ...projectData,
            pdsa: [...projectData.pdsa, newCycle]
        });
    }
};

window.handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!geminiModel) return alert("Please save your API Key in settings first.");
    
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    addChatBubble(msg, 'user');
    input.value = '';
    
    try {
        const context = `
        Role: Medical QIP Coach.
        Current Data: ${JSON.stringify(projectData)}
        Protocols: ${JSON.stringify(haloProtocols)}
        User Query: ${msg}
        `;
        const result = await geminiModel.generateContent(context);
        addChatBubble(result.response.text(), 'ai');
    } catch (err) {
        addChatBubble("Error: " + err.message, 'ai');
    }
};

// --- UI RENDERING ---

function refreshUI() {
    // Only refresh if current view relies on dynamic data (charts/PDSA)
    const currentView = document.querySelector('.view-section:not(.hidden)');
    if (currentView && (currentView.id === 'view-data' || currentView.id === 'view-dashboard')) {
        window.router(currentView.id.replace('view-', ''));
    }
}

window.router = (viewId) => {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    
    if (viewId === 'dashboard') renderDashboard();
    if (viewId === 'halo') renderHalo();
    if (viewId === 'data') renderChart();
    if (viewId === 'pdsa') renderPDSA();
    if (viewId === 'checklist') renderChecklist();
    
    lucide.createIcons();
};

function renderDashboard() {
    const count = projectData.pdsa ? projectData.pdsa.length : 0;
    const container = document.getElementById('stats-grid');
    if(container) container.innerHTML = `
        <div class="glass p-6 rounded-xl border-l-4 border-emerald-500">
            <h3 class="text-slate-500 text-xs font-bold uppercase">PDSA Cycles</h3>
            <p class="text-3xl font-bold text-slate-800">${count}</p>
        </div>
        <div class="glass p-6 rounded-xl border-l-4 border-indigo-500">
            <h3 class="text-slate-500 text-xs font-bold uppercase">Protocols</h3>
            <p class="text-3xl font-bold text-slate-800">${haloProtocols.length}</p>
        </div>
        <div class="glass p-6 rounded-xl border-l-4 border-amber-500">
            <h3 class="text-slate-500 text-xs font-bold uppercase">Target</h3>
            <p class="text-3xl font-bold text-slate-800">${projectData.chartGoal}%</p>
        </div>
    `;
}

function renderHalo() {
    const grid = document.getElementById('halo-grid');
    if(grid) grid.innerHTML = haloProtocols.map(p => {
        // Check if Trolley or QRH
        const isTrolley = p.tags.includes('Trolley');
        const badgeColor = isTrolley ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700';
        
        return `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all">
            <div class="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-start">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-${p.color}-100 rounded-lg text-${p.color}-600">
                        <i data-lucide="${p.icon}" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-lg leading-tight">${p.title}</h3>
                        <span class="text-[10px] font-bold uppercase ${badgeColor} px-2 py-0.5 rounded-full">${isTrolley ? 'TROLLEY' : 'QRH ONLY'}</span>
                    </div>
                </div>
            </div>
            <div class="p-5">
                <div class="mb-4 bg-red-50 text-red-800 text-xs p-3 rounded border border-red-100 font-bold flex gap-2">
                    <i data-lucide="alert-triangle" class="w-4 h-4 shrink-0"></i> 
                    <span>${p.alert}</span>
                </div>
                <ol class="list-decimal pl-4 space-y-2 text-sm text-slate-700">
                    ${p.steps.map(s => `<li class="pl-1">${s}</li>`).join('')}
                </ol>
            </div>
        </div>
    `}).join('');
}

function renderChecklist() {
    const list = document.getElementById('checklist-container');
    if(!list) return;
    const fields = [
        {k:'title', l:'Project Title'}, {k:'aim', l:'SMART Aim'}, 
        {k:'status', l:'Current Status'}
    ];
    list.innerHTML = fields.map(f => `
        <div class="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
            <label class="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-wide">${f.l}</label>
            <div class="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed">${projectData.checklist[f.k] || '...'}</div>
        </div>
    `).join('');
}

function renderPDSA() {
    const list = document.getElementById('pdsa-list');
    if(!list) return;
    list.innerHTML = (projectData.pdsa || []).map(p => `
        <div class="bg-white rounded-xl shadow-sm border border-l-4 border-l-rcem-purple overflow-hidden">
            <div class="p-4 bg-slate-50 border-b flex justify-between items-center">
                <h3 class="font-bold text-rcem-purple text-lg">${p.title}</h3>
                <span class="text-xs font-mono text-slate-500 bg-white px-2 py-1 rounded border">${new Date(parseInt(p.id)).toLocaleDateString()}</span>
            </div>
            <div class="p-5 text-sm text-slate-600">
                <p>Plan/Do/Study/Act content...</p>
            </div>
        </div>
    `).join('');
}

function renderChart() {
    const ctx = document.getElementById('mainChart');
    if(!ctx) return;
    
    // Simple Chart Logic
    const data = projectData.chartData || [];
    const labels = data.map(d => d.date);
    const values = data.map(d => d.value);

    if(window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '% Confidence',
                data: values,
                borderColor: '#2d2e83',
                tension: 0.3
            }]
        }
    });
}

function addChatBubble(text, type) {
    const div = document.createElement('div');
    div.className = `p-3 rounded-lg text-sm max-w-[85%] mb-2 ${type === 'user' ? 'bg-rcem-purple text-white ml-auto' : 'bg-slate-100 text-slate-800 mr-auto'}`;
    div.innerHTML = marked.parse(text);
    const container = document.getElementById('chat-messages');
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// Initial Render
window.toggleSettings = () => document.getElementById('settings-modal').classList.toggle('hidden');
window.toggleChat = () => document.getElementById('chat-window').classList.toggle('hidden');
