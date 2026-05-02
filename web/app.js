/* ================================================================
   NeuroX Relay-Nudge · Application Logic
   ================================================================ */

"use strict";

// ─── Config ────────────────────────────────────────────────────────
const API_BASE = "http://127.0.0.1:8000";

// ─── DOM refs ──────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  canvas:       $("#particleCanvas"),
  apiDot:       $("#apiDot"),
  apiStatus:    $("#apiStatus"),
  profilesGrid: $("#profilesGrid"),
  form:         $("#relayForm"),
  submitBtn:    $("#submitBtn"),
  // response
  responseEmpty: $("#responseEmpty"),
  responseCard:  $("#responseCard"),
  responseError: $("#responseError"),
  resFrom:      $("#resFrom"),
  resTo:        $("#resTo"),
  resToState:   $("#resToState"),
  resScore:     $("#resScore"),
  resTaskId:    $("#resTaskId"),
  resSummary:   $("#resSummary"),
  responseBadge: $("#responseBadge"),
  errCode:      $("#errCode"),
  errDetail:    $("#errDetail"),
  historyList:  $("#historyList"),
  // gauge
  gaugeOverlay: $("#gaugeOverlay"),
  gaugeFill:    $("#gaugeFill"),
  gaugeValue:   $("#gaugeValue"),
};

// ─── State ─────────────────────────────────────────────────────────

/** @type {{ taskId: string; score: number; time: string }[]} */
const history = [];

/** Mock profiles (matches the FastAPI server's in-memory store) */
const profiles = [
  { userId: "user-100", name: "Vishwak Chander", state: "Hyper-Focus",    focusScore: 0.92 },
  { userId: "user-200", name: "Kiran Desai",     state: "Flow",           focusScore: 0.70 },
  { userId: "user-300", name: "Meena Rajput",     state: "Scattered",      focusScore: 0.20 },
  // Peers (not in target dropdown — they receive redirects)
  { userId: "peer-001", name: "Aarav Mehta",      state: "Transitioning",  focusScore: 0.35 },
  { userId: "peer-002", name: "Priya Sharma",     state: "Flow",           focusScore: 0.80 },
  { userId: "peer-003", name: "Rahul Iyer",       state: "Transitioning",  focusScore: 0.25 },
];

// ─── Init ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initParticles();
  renderProfiles();
  checkHealth();
  setInterval(checkHealth, 15_000);
  dom.form.addEventListener("submit", handleSubmit);
});

// ================================================================
//  Particle canvas (ambient effect)
// ================================================================
function initParticles() {
  const canvas = dom.canvas;
  const ctx = canvas.getContext("2d");
  let w, h;
  const particles = [];
  const COUNT = 70;

  function resize() {
    w = canvas.width  = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.5 + 0.5,
      dx: (Math.random() - 0.5) * 0.35,
      dy: (Math.random() - 0.5) * 0.35,
      alpha: Math.random() * 0.5 + 0.15,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(108, 92, 231, ${p.alpha})`;
      ctx.fill();
    }
    // Draw faint connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(108, 92, 231, ${0.08 * (1 - dist / 120)})`;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
}

// ================================================================
//  Profiles
// ================================================================
function renderProfiles() {
  dom.profilesGrid.innerHTML = profiles.map((p) => {
    const stateSlug = p.state.toLowerCase().replace(/[\s]+/g, "-");
    const initials = p.name.split(" ").map((w) => w[0]).join("");
    const avatarHue = hashStr(p.userId) % 360;
    return `
      <div class="profile-card" data-user="${p.userId}">
        <div class="profile-card__avatar" style="background: hsl(${avatarHue}, 55%, 40%);">${initials}</div>
        <div class="profile-card__info">
          <span class="profile-card__name">${p.name}</span>
          <span class="profile-card__state state--${stateSlug}">
            ${stateIcon(p.state)} ${p.state}
          </span>
          <span class="profile-card__focus">Focus: ${(p.focusScore * 100).toFixed(0)}%</span>
        </div>
      </div>
    `;
  }).join("");
}

/** Tiny hash for deterministic avatar colour */
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function stateIcon(state) {
  const map = {
    "Hyper-Focus":   "⚡",
    "Flow":          "🌊",
    "Transitioning": "🔄",
    "Scattered":     "💫",
    "Resting":       "😴",
  };
  return map[state] || "●";
}

// ================================================================
//  Health check
// ================================================================
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      dom.apiDot.className = "header__dot online";
      dom.apiStatus.textContent = "API Online";
    } else {
      throw new Error("non-200");
    }
  } catch {
    dom.apiDot.className = "header__dot offline";
    dom.apiStatus.textContent = "API Offline";
  }
}

// ================================================================
//  Form submission
// ================================================================
async function handleSubmit(e) {
  e.preventDefault();

  const payload = {
    task_id:        $("#taskId").value.trim(),
    title:          $("#taskTitle").value.trim(),
    description:    $("#taskDesc").value.trim(),
    urgency:        $("#urgency").value,
    source:         $("#source").value.trim(),
    target_user_id: $("#targetUser").value,
  };

  setLoading(true);
  hideAllResponses();

  try {
    const res = await fetch(`${API_BASE}/relay-nudge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (res.ok) {
      showGauge(data.task_score, () => {
        showSuccess(data);
        addHistory(data);
        highlightProfileCard(data.redirected_to);
      });
    } else {
      const errData = data.detail || data;
      showError(errData.code || `HTTP ${res.status}`, errData.detail || JSON.stringify(data));
    }
  } catch (err) {
    showError("NETWORK_ERROR", `Could not reach the API at ${API_BASE}. Is the server running?`);
  } finally {
    setLoading(false);
  }
}

// ================================================================
//  UI helpers
// ================================================================
function setLoading(on) {
  dom.submitBtn.classList.toggle("loading", on);
  dom.submitBtn.disabled = on;
}

function hideAllResponses() {
  dom.responseEmpty.classList.add("hidden");
  dom.responseCard.classList.add("hidden");
  dom.responseError.classList.add("hidden");
}

function showSuccess(data) {
  dom.resFrom.textContent    = data.original_target;
  dom.resTo.textContent      = data.redirected_to;
  dom.resToState.textContent  = data.redirected_to_state;
  dom.resScore.textContent   = data.task_score.toFixed(1);
  dom.resTaskId.textContent  = data.task_id;
  dom.resSummary.textContent = data.ai_summary;
  dom.responseBadge.textContent = "REDIRECTED";
  dom.responseCard.classList.remove("hidden");
}

function showError(code, detail) {
  dom.errCode.textContent   = code;
  dom.errDetail.textContent = detail;
  dom.responseError.classList.remove("hidden");
}

function addHistory(data) {
  const now = new Date().toLocaleTimeString();
  history.unshift({ taskId: data.task_id, score: data.task_score, time: now });
  if (history.length > 10) history.pop();
  renderHistory();
}

function renderHistory() {
  dom.historyList.innerHTML = history.map((h) => `
    <li class="history__item">
      <span class="history__item-id">${h.taskId}</span>
      <span class="history__item-score">${h.score.toFixed(1)}</span>
      <span class="history__item-time">${h.time}</span>
    </li>
  `).join("");
}

function highlightProfileCard(name) {
  $$(".profile-card").forEach((card) => {
    const n = card.querySelector(".profile-card__name");
    if (n && n.textContent === name) {
      card.style.borderColor = "var(--accent-2)";
      card.style.boxShadow = "0 0 16px var(--accent-2-glow)";
      setTimeout(() => {
        card.style.borderColor = "";
        card.style.boxShadow = "";
      }, 2500);
    }
  });
}

// ================================================================
//  Score gauge animation
// ================================================================
function showGauge(score, onDone) {
  dom.gaugeOverlay.classList.remove("hidden");
  const circumference = 2 * Math.PI * 52; // r=52
  const offset = circumference * (1 - score / 100);

  // Colour based on score
  const colour = score >= 70 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--error)";
  dom.gaugeFill.style.stroke = colour;

  // Reset
  dom.gaugeFill.style.transition = "none";
  dom.gaugeFill.style.strokeDashoffset = circumference;
  dom.gaugeValue.textContent = "0";

  requestAnimationFrame(() => {
    dom.gaugeFill.style.transition = `stroke-dashoffset 1.2s var(--ease-out), stroke .4s`;
    dom.gaugeFill.style.strokeDashoffset = offset;

    // Counter animation
    animateCounter(dom.gaugeValue, 0, score, 1100);

    setTimeout(() => {
      dom.gaugeOverlay.classList.add("hidden");
      if (onDone) onDone();
    }, 1600);
  });
}

function animateCounter(el, from, to, duration) {
  const start = performance.now();
  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(from + (to - from) * eased).toFixed(0);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
