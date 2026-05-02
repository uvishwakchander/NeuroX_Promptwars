/**
 * NeuroX Ecosystem · Core Logic
 */

// ───────── CONFIG & STATE ─────────
const API_BASE = window.location.origin;
let currentUser = null;

const STATE = {
    currentView: 'gateway',
    interruptionCount: 5,
    profiles: []
};

// ───────── INITIALIZATION ─────────
document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initNavigation();
    initLanding();
    initRelay();
    initWellness();
    initAuth();
});

// ───────── AUTHENTICATION (FIREBASE MOCK/REAL) ─────────
function initAuth() {
    const loginBtn = document.getElementById('googleLoginBtn');
    
    loginBtn.addEventListener('click', () => {
        // In a real production environment, you'd use:
        // const provider = new firebase.auth.GoogleAuthProvider();
        // firebase.auth().signInWithPopup(provider);
        
        // Mocking successful login for speed
        loginBtn.innerHTML = 'Connecting to Neural Net...';
        setTimeout(() => {
            currentUser = { displayName: 'Vishwak Chander', photoURL: null };
            document.body.classList.remove('auth-required');
            switchView('landing');
        }, 1500);
    });
}

// ───────── NAVIGATION / ROUTING ─────────
function initNavigation() {
    const enterAppBtn = document.getElementById('enterAppBtn');
    if (enterAppBtn) {
        enterAppBtn.addEventListener('click', () => switchView('dashboard', true));
    }

    const navItems = document.querySelectorAll('.nav-item[data-view]');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');
            switchView(view, true);
            
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

function switchView(viewId, isApp = false) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
    
    if (isApp) {
        document.getElementById('main-layout').classList.remove('hidden');
        document.getElementById('view-landing').classList.add('hidden');
        document.getElementById(`view-${viewId}`).classList.add('active');
    } else {
        document.getElementById('main-layout').classList.add('hidden');
        const view = document.getElementById(`view-${viewId}`);
        if (view) view.classList.remove('hidden');
    }
}

// ───────── LANDING: INTERRUPTION COST ─────────
function initLanding() {
    const slider = document.getElementById('interruptionSlider');
    const countDisplay = document.getElementById('interruptionCount');
    const minutesDisplay = document.getElementById('minutesLost');
    const drainDisplay = document.getElementById('cognitiveDrain');

    const updateCost = () => {
        const val = slider.value;
        countDisplay.textContent = val;
        
        // Calculation: Each interruption costs ~23 mins of flow (research standard)
        const lost = val * 23;
        minutesDisplay.textContent = lost;
        
        // Drain calculation
        const drain = Math.min(100, (val * 7));
        drainDisplay.textContent = `${drain}%`;
    };

    if (slider) {
        slider.addEventListener('input', updateCost);
        updateCost();
    }
}

// ───────── WELLNESS: BUBBLE FOCUS GAME ─────────
function initWellness() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let bubbles = [];
    let score = 0;
    let gameActive = false;

    const startBtn = document.getElementById('startGameBtn');
    startBtn.addEventListener('click', () => {
        gameActive = true;
        document.querySelector('.game-overlay-ui').classList.add('hidden');
        spawnBubbles();
        requestAnimationFrame(gameLoop);
    });

    canvas.addEventListener('mousedown', (e) => {
        if (!gameActive) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        bubbles = bubbles.filter(b => {
            const dist = Math.sqrt((x-b.x)**2 + (y-b.y)**2);
            if (dist < b.r) {
                score += 10;
                return false;
            }
            return true;
        });
    });

    function spawnBubbles() {
        if (!gameActive) return;
        if (bubbles.length < 5) {
            bubbles.push({
                x: Math.random() * canvas.width,
                y: canvas.height + 20,
                r: 20 + Math.random() * 30,
                speed: 1 + Math.random() * 2
            });
        }
        setTimeout(spawnBubbles, 1000);
    }

    function gameLoop() {
        if (!gameActive) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        bubbles.forEach(b => {
            b.y -= b.speed;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
            ctx.fill();
            ctx.strokeStyle = '#00f0ff';
            ctx.stroke();
        });
        
        bubbles = bubbles.filter(b => b.y + b.r > 0);
        requestAnimationFrame(gameLoop);
    }

    // AI Chat
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendChatBtn');
    const history = document.getElementById('chatHistory');

    const appendMsg = (text, type) => {
        const div = document.createElement('div');
        div.className = `chat-bubble chat-bubble--${type}`;
        div.textContent = text;
        history.appendChild(div);
        history.scrollTop = history.scrollHeight;
    };

    sendBtn.addEventListener('click', async () => {
        const msg = chatInput.value.trim();
        if (!msg) return;
        
        appendMsg(msg, 'user');
        chatInput.value = '';
        
        try {
            const res = await fetch(`${API_BASE}/therapy-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg })
            });
            const data = await res.json();
            appendMsg(data.reply, 'ai');
        } catch (e) {
            appendMsg("I'm having trouble connecting to your neural state right now.", 'ai');
        }
    });
}

// ───────── RELAY DASHBOARD LOGIC ─────────
async function initRelay() {
    const form = document.getElementById('relayForm');
    const grid = document.getElementById('profilesGrid');
    
    // Fetch initial profiles
    try {
        const res = await fetch(`${API_BASE}/health`);
        // Just checking connectivity for now
        updateStatus(true);
        loadMockProfiles();
    } catch (e) {
        updateStatus(false);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            task_id: document.getElementById('taskId').value,
            urgency: document.getElementById('urgency').value,
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDesc').value,
            source: document.getElementById('source').value,
            target_user_id: document.getElementById('targetUser').value
        };

        showGauge();
        
        try {
            const res = await fetch(`${API_BASE}/relay-nudge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            animateGauge(data.score, () => {
                hideGauge();
                alert(`Task ${data.status === 'redirected' ? 'Redirected' : 'Delivered'}: ${data.ai_summary}`);
            });
        } catch (err) {
            hideGauge();
            alert("Relay failed.");
        }
    });
}

function loadMockProfiles() {
    const grid = document.getElementById('profilesGrid');
    const mock = [
        { name: 'Vishwak Chander', state: 'Hyper-Focus', color: '#ff1744' },
        { name: 'Kiran Desai', state: 'Flow', color: '#7000ff' },
        { name: 'Aarav Mehta', state: 'Transitioning', color: '#00f0ff' }
    ];
    
    grid.innerHTML = mock.map(p => `
        <div class="profile-item">
            <div class="user-avatar" style="background:${p.color}">${p.name[0]}</div>
            <div>
                <strong>${p.name}</strong>
                <div style="font-size: 12px; color: ${p.color}">${p.state}</div>
            </div>
        </div>
    `).join('');
}

function updateStatus(online) {
    const dot = document.getElementById('apiDot');
    const txt = document.getElementById('apiStatus');
    dot.className = online ? 'dot online' : 'dot offline';
    txt.textContent = online ? 'Neural Net Online' : 'Offline';
}

// ───────── GAUGE ANIMATION ─────────
function showGauge() { document.getElementById('gaugeOverlay').classList.remove('hidden'); }
function hideGauge() { document.getElementById('gaugeOverlay').classList.add('hidden'); }

function animateGauge(target, callback) {
    const fill = document.getElementById('gaugeFill');
    const val = document.getElementById('gaugeValue');
    let current = 0;
    
    const itv = setInterval(() => {
        current += 2;
        if (current >= target) {
            current = target;
            clearInterval(itv);
            setTimeout(callback, 800);
        }
        val.textContent = Math.round(current);
        const offset = 283 - (283 * current / 100);
        fill.style.strokeDashoffset = offset;
    }, 20);
}

// ───────── PARTICLES (BASICS) ─────────
function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    let pts = [];
    for(let i=0; i<50; i++) {
        pts.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5
        });
    }

    function draw() {
        ctx.clearRect(0,0,canvas.width, canvas.height);
        ctx.fillStyle = '#00f0ff';
        pts.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if(p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if(p.y < 0 || p.y > canvas.height) p.vy *= -1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.5, 0, Math.PI*2);
            ctx.fill();
        });
        requestAnimationFrame(draw);
    }
    draw();
}
