/* ================================================================
   VANILLA JS PORT of the React pipeline app.
   Same model (pipeline.js), same rules, same UI/CSS — no React,
   no build step. State lives in `state`; the DOM is rebuilt via
   small template-string render functions per region, and events
   are (re)wired after every render of that region.
   ================================================================ */

const STORAGE_KEY = "recruitment-pipeline:v1";

function cryptoId() { return Math.random().toString(36).slice(2, 10); }
function nowStamp() { return new Date().toTimeString().slice(0, 8); }

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
function escapeAttr(v) { return escapeHtml(v == null ? "" : v); }

function loadInitialPipeline() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return RecruitmentPipeline.deserialize(raw);
  } catch {
    /* fall through to seed */
  }
  return seedPipeline();
}

/* ---------------------------------------------------------------
   STATE
   --------------------------------------------------------------- */
const state = {
  pipeline: loadInitialPipeline(),
  logs: [{ id: cryptoId(), kind: "info", text: "Pipeline loaded.", ts: nowStamp() }],
  toasts: [],
  lastTouchedId: null,
  ui: {
    addOpen: false,
    addForm: {},
    addErrors: {},
    openCandidateId: null,
    detailForm: {},
    stagesOpen: false,
    stagesTab: "add",
    stagesForm: { newName: "", afterName: "", insertName: "", removeName: "" },
    analyzeOpen: false,
    analyzeSkill: "",
    analyzeOutput: null,
    consoleOpen: false,
    activeStage: null, // which stage's column is shown on the mobile tab view
  },
};

function persist() {
  try { localStorage.setItem(STORAGE_KEY, state.pipeline.serialize()); } catch { /* storage unavailable */ }
}

function pushLog(kind, text) {
  state.logs = [...state.logs.slice(-199), { id: cryptoId(), kind, text, ts: nowStamp() }];
  renderConsole();
}

function pushToast(kind, text) {
  const id = cryptoId();
  state.toasts = [...state.toasts, { id, kind, text }];
  renderToasts();
  setTimeout(() => {
    state.toasts = state.toasts.filter(t => t.id !== id);
    renderToasts();
  }, 3400);
}

function report(result, extraLines) {
  pushLog(result.ok ? "ok" : "err", result.msg);
  (extraLines || []).forEach(line => pushLog("ok", line));
  pushToast(result.ok ? "ok" : "err", result.msg);
  return result;
}

function touch(id) { state.lastTouchedId = id; }
function clearLastTouched() { state.lastTouchedId = null; }

/* ---------------------------------------------------------------
   ACTIONS (mirror PipelineContext's `actions` object 1:1)
   --------------------------------------------------------------- */
const actions = {
  addCandidate(stageName, data) {
    const r = state.pipeline.addCandidate(stageName, data);
    report(r);
    if (r.ok) { touch(data.id); bump(); }
    return r;
  },
  moveCandidate(id, dest) {
    const r = state.pipeline.moveCandidate(id, dest);
    report(r);
    if (r.ok) { touch(id); bump(); }
    return r;
  },
  withdrawCandidate(id) {
    const r = state.pipeline.withdrawCandidate(id);
    report(r);
    if (r.ok) bump();
    return r;
  },
  updateTechnicalScore(id, score) {
    const r = state.pipeline.updateTechnicalScore(id, score);
    report(r);
    if (r.ok) { touch(id); bump(); }
    return r;
  },
  updateInterviewScore(id, score) {
    const r = state.pipeline.updateInterviewScore(id, score);
    report(r);
    if (r.ok) { touch(id); bump(); }
    return r;
  },
  addStage(name) {
    const r = state.pipeline.addStage(name);
    report(r);
    if (r.ok) bump();
    return r;
  },
  insertStage(newName, afterName) {
    const r = state.pipeline.insertStage(newName, afterName);
    report(r);
    if (r.ok) bump();
    return r;
  },
  removeStage(name) {
    const r = state.pipeline.removeStage(name);
    report(r);
    if (r.ok) bump();
    return r;
  },
  reversePipeline() {
    const r = state.pipeline.reversePipeline();
    report(r);
    bump();
    return r;
  },
  promoteEligibleCandidates() {
    const r = state.pipeline.promoteEligibleCandidates();
    report(r, r.log);
    bump();
    return r;
  },
  getBestCandidate() { return state.pipeline.getBestCandidate(); },
  findCandidatesBySkill(skill) { return state.pipeline.findCandidatesBySkill(skill); },
  getMostCrowdedStage() { return state.pipeline.getMostCrowdedStage(); },
  checkPipelineIntegrity() {
    const r = state.pipeline.checkPipelineIntegrity();
    report(r);
    return r;
  },
  hasCycle() {
    const cyclic = state.pipeline.hasCycle();
    pushLog(cyclic ? "err" : "ok", cyclic ? "Cycle detected in the stage list." : "No cycle detected in the stage list.");
    return cyclic;
  },
  displayStatistics() { return state.pipeline.displayStatistics(); },
  allStages() { return state.pipeline.allStages(); },
};

// Called after every mutating action: persists + re-renders the parts
// of the UI that show live pipeline data (topbar/funnel, board, sidebar,
// and whichever modal happens to be open).
function bump() {
  persist();
  renderTopBar();
  renderMain();
  renderModals();
}

function renderAll() {
  renderTopBar();
  renderMain();
  renderConsole();
  renderToasts();
  renderModals();
}

/* ---------------------------------------------------------------
   TOP BAR + FUNNEL
   --------------------------------------------------------------- */
function renderTopBar() {
  const stages = actions.allStages();
  const total = stages.reduce((s, st) => s + st.candidates.length, 0);
  const el = document.getElementById("topbar-root");
  el.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark"></span>
        <div class="brand-text"><h1>Pipeline</h1><p>Recruitment tracker</p></div>
      </div>
      ${renderFunnelHTML(stages, total)}
      <div class="topbar-actions">
        <button class="btn btn-primary" id="btn-add-candidate">Add candidate</button>
        <button class="btn btn-ghost" id="btn-open-stages">Stages</button>
        <button class="btn btn-ghost" id="btn-open-analyze">Analyze</button>
        <button class="btn btn-icon" title="Toggle activity log" id="btn-toggle-console">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h10M4 18h7" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
      </div>
    </header>
  `;
  document.getElementById("btn-add-candidate").onclick = openAddModal;
  document.getElementById("btn-open-stages").onclick = openStagesModal;
  document.getElementById("btn-open-analyze").onclick = openAnalyzeModal;
  document.getElementById("btn-toggle-console").onclick = toggleConsole;
}

function renderFunnelHTML(stages, total) {
  if (stages.length === 0) return `<div class="funnel-wrap"></div>`;
  const segs = stages.map(s => {
    const pct = total > 0 ? (s.candidates.length / total) * 100 : 100 / stages.length;
    const label = pct > 9 ? `${escapeHtml(s.name)} · ${s.candidates.length}` : (s.candidates.length || "");
    return `<div class="funnel-seg ${s.candidates.length === 0 ? "empty" : ""}" style="width:${pct}%" title="${escapeAttr(s.name)}: ${s.candidates.length}">${label}</div>`;
  }).join("");
  return `<div class="funnel-wrap"><div class="funnel-track">${segs}</div><span class="funnel-hint">${total} in pipeline</span></div>`;
}

/* ---------------------------------------------------------------
   BOARD + SIDEBAR
   --------------------------------------------------------------- */
function renderMain() {
  const stages = actions.allStages();
  const best = actions.getBestCandidate();
  const crowded = actions.getMostCrowdedStage();
  const bestId = best ? best.candidate.id : null;
  const total = stages.reduce((s, st) => s + st.candidates.length, 0);

  const el = document.getElementById("main-root");
  el.className = "main-layout";
  el.innerHTML = renderBoardHTML(stages, crowded, bestId) + renderSidebarHTML(stages, total, best, crowded);
  wireBoardEvents();
}

function renderBoardHTML(stages, crowded, bestId) {
  if (stages.length === 0) {
    return `<div class="board-wrap"><div class="board-empty"><h3>No stages yet</h3><p>Use the Stages panel to build a pipeline.</p></div></div>`;
  }

  // Which stage is shown on the mobile tab view. Falls back to the first
  // stage if none is set yet, or if the remembered one no longer exists
  // (renamed/removed/reversed).
  let activeFound = false;
  for (let i = 0; i < stages.length; i++) {
    if (stages[i].name === state.ui.activeStage) { activeFound = true; break; }
  }
  if (!activeFound) state.ui.activeStage = stages[0].name;

  const tabs = stages.map(s => `
    <button class="stage-tab ${s.name === state.ui.activeStage ? "active" : ""}" data-tab-stage="${escapeAttr(s.name)}">
      ${escapeHtml(s.name)} <span class="stage-tab-count">${s.candidates.length}</span>
    </button>
  `).join("");

  const cols = stages.map((stage, i) => {
    const isCrowded = crowded === stage && stage.candidates.length > 0;
    const isActive = stage.name === state.ui.activeStage;
    const cards = stage.candidates.length === 0
      ? `<div class="column-empty">No candidates in this stage</div>`
      : stage.candidates.map(c => renderCardHTML(c, c.id === bestId)).join("");
    return `
      <div class="column col-enter ${isCrowded ? "crowded" : ""} ${isActive ? "active" : ""}" style="animation-delay:${i * 55}ms" data-stage="${escapeAttr(stage.name)}">
        <div class="column-head">
          <span class="column-title">${escapeHtml(stage.name)}</span>
          <span class="column-count">${stage.candidates.length}</span>
        </div>
        <div class="column-body">${cards}</div>
      </div>
    `;
  }).join("");

  return `<div class="board-wrap"><div class="stage-tabs">${tabs}</div><div class="board">${cols}</div></div>`;
}

function renderCardHTML(c, isBest) {
  const isFlashing = c.id === state.lastTouchedId;
  const skills = c.skills.length > 0
    ? `<div class="card-skills">${c.skills.slice(0, 4).map(s => `<span class="skill-chip">${escapeHtml(s)}</span>`).join("")}</div>`
    : "";
  return `
    <div class="card ${isBest ? "best" : ""} ${isFlashing ? "flash" : ""}" draggable="true" data-id="${c.id}">
      <div class="card-top">
        <div class="avatar" style="background:${avatarGradient(c.name)}">${initials(c.name)}</div>
        <div class="card-id-name">
          <div class="card-name-row"><span class="card-name">${escapeHtml(c.name)}</span>${isBest ? '<span class="crown-chip">TOP</span>' : ""}</div>
          <div class="card-uni">${escapeHtml(c.university)}</div>
        </div>
        <span class="card-id">#${c.id}</span>
      </div>
      <div class="card-metrics">
        <div class="metric"><span class="metric-label">CGPA</span><span class="metric-value">${fmt(c.cgpa)}</span></div>
        <div class="metric"><span class="metric-label">Tech</span><span class="metric-value">${c.technicalScore}</span></div>
        <div class="metric"><span class="metric-label">HR</span><span class="metric-value">${c.interviewScore}</span></div>
      </div>
      ${skills}
    </div>
  `;
}

function wireBoardEvents() {
  const board = document.querySelector("#main-root .board");
  if (!board) return;

  const boardWrap = document.querySelector("#main-root .board-wrap");
  if (boardWrap) {
    boardWrap.querySelectorAll(".stage-tab").forEach(tab => {
      tab.onclick = () => {
        state.ui.activeStage = tab.dataset.tabStage;
        renderMain();
      };
    });
  }

  board.querySelectorAll(".card").forEach(card => {
    card.addEventListener("dragstart", e => {
      card.classList.add("dragging");
      e.dataTransfer.setData("text/plain", String(card.dataset.id));
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      board.querySelectorAll(".column").forEach(c => c.classList.remove("drag-over"));
    });
    card.addEventListener("click", () => {
      clearLastTouched();
      openDetailModal(Number(card.dataset.id));
    });

    // Touch devices don't fire HTML5 drag events at all, so cards are
    // also made draggable by hand-tracking touch movement.
    wireCardTouchDrag(card, board);
  });

  board.querySelectorAll(".column").forEach(col => {
    col.addEventListener("dragover", e => {
      e.preventDefault();
      board.querySelectorAll(".column").forEach(c => c.classList.remove("drag-over"));
      col.classList.add("drag-over");
    });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", e => {
      e.preventDefault();
      col.classList.remove("drag-over");
      const id = Number(e.dataTransfer.getData("text/plain"));
      if (id) actions.moveCandidate(id, col.dataset.stage);
    });
  });
}

// Manual touch-drag: mirrors the desktop dragstart/dragover/drop flow above,
// but driven by touchstart/touchmove/touchend since those are what actually
// fire on phones and tablets.
function wireCardTouchDrag(card, board) {
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let clone = null;
  const id = Number(card.dataset.id);

  card.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragging = false;
  }, { passive: true });

  card.addEventListener("touchmove", e => {
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    if (!dragging) {
      // Small movements are still just a tap/scroll — only start dragging
      // once the finger has clearly moved.
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      dragging = true;
      card.classList.add("dragging");

      clone = card.cloneNode(true);
      clone.style.position = "fixed";
      clone.style.width = card.offsetWidth + "px";
      clone.style.left = touch.clientX - card.offsetWidth / 2 + "px";
      clone.style.top = touch.clientY - 24 + "px";
      clone.style.zIndex = "200";
      clone.style.pointerEvents = "none";
      clone.style.opacity = "0.92";
      clone.style.transform = "rotate(2deg)";
      clone.style.boxShadow = "0 20px 40px -12px rgba(0,0,0,.6)";
      document.body.appendChild(clone);
    }

    // Prevent the page from scrolling while a card is actively being dragged.
    e.preventDefault();
    clone.style.left = touch.clientX - card.offsetWidth / 2 + "px";
    clone.style.top = touch.clientY - 24 + "px";

    board.querySelectorAll(".column").forEach(c => c.classList.remove("drag-over"));
    const under = document.elementFromPoint(touch.clientX, touch.clientY);
    const col = under ? under.closest(".column") : null;
    if (col) col.classList.add("drag-over");
  }, { passive: false });

  card.addEventListener("touchend", e => {
    if (dragging) {
      const touch = e.changedTouches[0];
      const under = document.elementFromPoint(touch.clientX, touch.clientY);
      const col = under ? under.closest(".column") : null;

      if (clone) clone.remove();
      card.classList.remove("dragging");
      board.querySelectorAll(".column").forEach(c => c.classList.remove("drag-over"));

      if (col) actions.moveCandidate(id, col.dataset.stage);
    }
    dragging = false;
    clone = null;
  });
}

function renderSidebarHTML(stages, total, best, crowded) {
  const withdrawnCount = state.pipeline.withdrawnIds.length;

  const spotlight = best ? `
    <div class="spotlight-card">
      <div class="spotlight-top">
        <div class="avatar" style="width:40px;height:40px;border-radius:11px;font-size:14px;background:${avatarGradient(best.candidate.name)}">${initials(best.candidate.name)}</div>
        <div>
          <div class="spotlight-name">${escapeHtml(best.candidate.name)}</div>
          <div class="spotlight-sub">${escapeHtml(best.candidate.university)}</div>
        </div>
      </div>
      <div class="spotlight-score"><span class="num">${fmt(best.score)}</span><span class="lbl">final score</span></div>
      <div class="spotlight-bars">
        ${miniBarHTML("CGPA", best.candidate.cgpa, 4, fmt(best.candidate.cgpa))}
        ${miniBarHTML("Technical", best.candidate.technicalScore, 100, best.candidate.technicalScore)}
        ${miniBarHTML("Interview", best.candidate.interviewScore, 100, best.candidate.interviewScore)}
      </div>
    </div>
  ` : `<div class="spotlight-empty">No candidates yet — add one to see the top match.</div>`;

  const crowdedNote = (crowded && crowded.candidates.length > 0)
    ? `<div class="crowded-note"><b>${escapeHtml(crowded.name)}</b> currently has the most candidates in the pipeline.</div>`
    : "";

  return `
    <aside class="sidebar">
      <div>
        <div class="sidebar-label" style="margin-bottom:8px">Spotlight</div>
        ${spotlight}
      </div>
      <div>
        <div class="sidebar-label" style="margin-bottom:8px">At a glance</div>
        <div class="stat-tiles">
          <div class="stat-tile"><div class="num">${stages.length}</div><div class="lbl">stages</div></div>
          <div class="stat-tile"><div class="num">${total}</div><div class="lbl">candidates</div></div>
          <div class="stat-tile"><div class="num">${withdrawnCount}</div><div class="lbl">withdrawn</div></div>
          <div class="stat-tile"><div class="num">${crowded ? crowded.candidates.length : 0}</div><div class="lbl">busiest stage</div></div>
        </div>
      </div>
      ${crowdedNote}
    </aside>
  `;
}

function miniBarHTML(label, value, max, display) {
  return `
    <div class="mini-bar-row">
      <span class="lbl">${label}</span>
      <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${Math.min(100, (value / max) * 100)}%"></div></div>
      <span class="val">${display}</span>
    </div>
  `;
}

/* ---------------------------------------------------------------
   CONSOLE DRAWER
   --------------------------------------------------------------- */
function renderConsole() {
  const el = document.getElementById("console-root");
  el.innerHTML = `
    <section class="console-drawer ${state.ui.consoleOpen ? "open" : ""}">
      <div class="console-header">
        <span class="console-dot"></span>
        <span class="console-title">activity log</span>
        <span class="console-hint">every operation, as the original program would have printed it</span>
        <button class="console-close" id="console-close-btn">&times;</button>
      </div>
      <div class="console-body" id="console-body">
        ${state.logs.map(l => `<div class="log-line ${l.kind}"><span class="ts">${l.ts}</span>${escapeHtml(l.text)}</div>`).join("")}
      </div>
    </section>
  `;
  document.getElementById("console-close-btn").onclick = () => { state.ui.consoleOpen = false; renderConsole(); };
  const body = document.getElementById("console-body");
  body.scrollTop = body.scrollHeight;
}

function toggleConsole() {
  state.ui.consoleOpen = !state.ui.consoleOpen;
  renderConsole();
}

/* ---------------------------------------------------------------
   TOASTS
   --------------------------------------------------------------- */
function renderToasts() {
  const el = document.getElementById("toast-root");
  el.innerHTML = `<div class="toast-stack">${state.toasts.map(t => `<div class="toast ${t.kind === "ok" ? "" : t.kind}">${escapeHtml(t.text)}</div>`).join("")}</div>`;
}

/* ---------------------------------------------------------------
   MODALS (all four are always in the DOM; `open` class toggles them)
   --------------------------------------------------------------- */
function renderModals() {
  document.getElementById("modal-root").innerHTML =
    renderAddModalHTML() +
    renderDetailModalHTML() +
    renderStagesModalHTML() +
    renderAnalyzeModalHTML();
  wireAddModal();
  wireDetailModal();
  wireStagesModal();
  wireAnalyzeModal();
}

/* ---- Add candidate ---- */
function openAddModal() {
  const stages = actions.allStages();
  const maxId = stages.reduce((m, s) => s.candidates.reduce((mm, c) => Math.max(mm, c.id), m), 100);
  state.ui.addOpen = true;
  state.ui.addForm = {
    id: String(maxId + 1), name: "", university: "", experience: "0", cgpa: "3.0",
    technicalScore: "0", interviewScore: "0", skills: "", stage: stages[0]?.name || "",
  };
  state.ui.addErrors = {};
  renderModals();
}
function closeAddModal() { state.ui.addOpen = false; renderModals(); }

function renderAddModalHTML() {
  const open = state.ui.addOpen;
  const stages = actions.allStages();
  const f = state.ui.addForm || {};
  const errors = state.ui.addErrors || {};
  const cls = k => `field ${errors[k] ? "invalid" : ""}`;
  const errMsg = k => (errors[k] ? `<p class="field-error">${escapeHtml(errors[k])}</p>` : "");

  return `
  <div class="modal-overlay ${open ? "open" : ""}" data-modal="add">
    <div class="modal">
      <div class="modal-head">
        <div><h2>Add a candidate</h2><p>Enters the pipeline at whichever stage you choose</p></div>
        <button class="modal-close" data-close="add">&times;</button>
      </div>
      <div class="modal-body">
        <form id="add-form" novalidate>
          <div class="field-row" style="margin-bottom:14px">
            <div class="${cls("id")}">
              <label>Candidate ID</label>
              <input type="number" name="id" value="${escapeAttr(f.id)}">
              ${errMsg("id")}
            </div>
            <div class="field">
              <label>Starting stage</label>
              <select name="stage">
                ${stages.map(s => `<option value="${escapeAttr(s.name)}" ${s.name === f.stage ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}
              </select>
            </div>
          </div>

          <div class="${cls("name")}" style="margin-bottom:14px">
            <label>Full name</label>
            <input type="text" name="name" placeholder="e.g. Zainab Hussain" value="${escapeAttr(f.name)}">
            ${errMsg("name")}
          </div>

          <div class="field-row" style="margin-bottom:14px">
            <div class="${cls("university")}">
              <label>University</label>
              <input type="text" name="university" placeholder="e.g. FAST" value="${escapeAttr(f.university)}">
              ${errMsg("university")}
            </div>
            <div class="${cls("experience")}">
              <label>Experience (yrs)</label>
              <input type="number" min="0" name="experience" value="${escapeAttr(f.experience)}">
              ${errMsg("experience")}
            </div>
          </div>

          <div class="field-row" style="margin-bottom:14px">
            <div class="${cls("cgpa")}">
              <label>CGPA (/4.0)</label>
              <input type="number" step="0.01" min="0" max="4" name="cgpa" value="${escapeAttr(f.cgpa)}">
              ${errMsg("cgpa")}
            </div>
            <div class="${cls("technicalScore")}">
              <label>Technical</label>
              <input type="number" min="0" max="100" name="technicalScore" value="${escapeAttr(f.technicalScore)}">
              ${errMsg("technicalScore")}
            </div>
            <div class="${cls("interviewScore")}">
              <label>Interview</label>
              <input type="number" min="0" max="100" name="interviewScore" value="${escapeAttr(f.interviewScore)}">
              ${errMsg("interviewScore")}
            </div>
          </div>

          <div class="field">
            <label>Skills</label>
            <input type="text" name="skills" placeholder="C++, Python, Machine Learning" value="${escapeAttr(f.skills)}">
            <p class="field-hint">Comma-separated. Screening requires at least 2 to be eligible for promotion.</p>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-outline" data-close="add">Cancel</button>
            <button type="submit" class="btn btn-primary btn-block">Add candidate</button>
          </div>
        </form>
      </div>
    </div>
  </div>
  `;
}

function wireAddModal() {
  const overlay = document.querySelector('[data-modal="add"]');
  if (!overlay) return;
  overlay.addEventListener("mousedown", e => { if (e.target === overlay) closeAddModal(); });
  overlay.querySelectorAll('[data-close="add"]').forEach(b => (b.onclick = closeAddModal));

  const form = document.getElementById("add-form");
  form.addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(form);
    const stage = fd.get("stage");
    const raw = {
      id: fd.get("id"), name: fd.get("name"), university: fd.get("university"),
      experience: fd.get("experience"), cgpa: fd.get("cgpa"),
      technicalScore: fd.get("technicalScore"), interviewScore: fd.get("interviewScore"),
      skills: fd.get("skills"), stage,
    };
    const data = {
      id: Number(raw.id),
      name: raw.name.trim(),
      university: raw.university.trim(),
      cgpa: Number(raw.cgpa),
      experience: Number(raw.experience),
      technicalScore: Number(raw.technicalScore),
      interviewScore: Number(raw.interviewScore),
      skills: raw.skills.split(",").map(s => s.trim()).filter(Boolean),
    };

    const fieldErrors = validateCandidate(data);
    if (Object.keys(fieldErrors).length > 0) {
      state.ui.addErrors = fieldErrors;
      state.ui.addForm = raw;
      renderModals();
      return;
    }

    const result = actions.addCandidate(stage, data);
    if (result.ok) {
      closeAddModal();
    } else if (result.msg.startsWith("Duplicate")) {
      state.ui.addErrors = { id: result.msg };
      state.ui.addForm = raw;
      renderModals();
    }
  });
}

/* ---- Candidate detail ---- */
function openDetailModal(id) {
  state.ui.openCandidateId = id;
  const stages = actions.allStages();
  let stage = null, candidate = null;
  for (const s of stages) { const found = s.candidates.find(c => c.id === id); if (found) { stage = s; candidate = found; break; } }
  const otherStages = stage ? stages.filter(s => s !== stage) : [];
  state.ui.detailForm = {
    moveTo: otherStages[0]?.name || "",
    techScore: candidate ? candidate.technicalScore : 0,
    intvScore: candidate ? candidate.interviewScore : 0,
    techError: null,
    intvError: null,
  };
  renderModals();
}
function closeDetailModal() { state.ui.openCandidateId = null; renderModals(); }

function renderDetailModalHTML() {
  const open = state.ui.openCandidateId !== null;
  const stages = actions.allStages();
  let stage = null, candidate = null;
  if (open) {
    for (const s of stages) { const found = s.candidates.find(c => c.id === state.ui.openCandidateId); if (found) { stage = s; candidate = found; break; } }
  }
  if (!open || !candidate) return `<div class="modal-overlay" data-modal="detail"><div class="modal wide"></div></div>`;

  const otherStages = stages.filter(s => s !== stage);
  const f = state.ui.detailForm || {};
  const skills = candidate.skills.length > 0
    ? `<div class="card-skills" style="margin-bottom:4px">${candidate.skills.map(s => `<span class="skill-chip">${escapeHtml(s)}</span>`).join("")}</div>`
    : "";

  return `
  <div class="modal-overlay open" data-modal="detail">
    <div class="modal wide">
      <div class="modal-head">
        <div class="detail-header">
          <div style="display:flex;gap:11px;align-items:center">
            <div class="avatar" style="width:38px;height:38px;border-radius:10px;font-size:13px;background:${avatarGradient(candidate.name)}">${initials(candidate.name)}</div>
            <div>
              <div class="detail-name">${escapeHtml(candidate.name)}</div>
              <div class="detail-sub">#${candidate.id} · ${escapeHtml(candidate.university)} · ${candidate.experience} yr(s) experience</div>
            </div>
          </div>
          <span class="detail-stage-badge">${escapeHtml(stage.name)}</span>
        </div>
        <button class="modal-close" data-close="detail">&times;</button>
      </div>

      <div class="modal-body">
        <div class="detail-metrics">
          <div class="detail-metric"><div class="num">${fmt(candidate.cgpa)}</div><div class="lbl">CGPA</div></div>
          <div class="detail-metric"><div class="num">${candidate.technicalScore}</div><div class="lbl">Technical</div></div>
          <div class="detail-metric"><div class="num">${candidate.interviewScore}</div><div class="lbl">Interview</div></div>
        </div>

        ${skills}

        <div class="section-title">Move to another stage</div>
        <div class="field-row" style="align-items:flex-end">
          <div class="field">
            <select id="detail-moveto">
              ${otherStages.map(s => `<option value="${escapeAttr(s.name)}" ${s.name === f.moveTo ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}
            </select>
          </div>
          <button class="btn btn-primary" id="detail-move-btn">Move</button>
        </div>

        <div class="section-title">Update technical score</div>
        <p class="field-hint" style="margin-top:-6px;margin-bottom:10px">Only takes effect while the candidate is in Technical Interview</p>
        <div class="field-row" style="align-items:flex-end">
          <div class="field ${f.techError ? "invalid" : ""}">
            <input type="number" min="0" max="100" id="detail-tech-input" value="${escapeAttr(f.techScore)}">
            ${f.techError ? `<p class="field-error">${escapeHtml(f.techError)}</p>` : ""}
          </div>
          <button class="btn btn-outline" id="detail-tech-btn">Update</button>
        </div>

        <div class="section-title">Update interview score</div>
        <p class="field-hint" style="margin-top:-6px;margin-bottom:10px">Only takes effect while the candidate is in HR Interview</p>
        <div class="field-row" style="align-items:flex-end">
          <div class="field ${f.intvError ? "invalid" : ""}">
            <input type="number" min="0" max="100" id="detail-intv-input" value="${escapeAttr(f.intvScore)}">
            ${f.intvError ? `<p class="field-error">${escapeHtml(f.intvError)}</p>` : ""}
          </div>
          <button class="btn btn-outline" id="detail-intv-btn">Update</button>
        </div>

        <div class="divider"></div>
        <button class="btn btn-danger btn-block" id="detail-withdraw-btn">Withdraw candidate</button>
      </div>
    </div>
  </div>
  `;
}

function wireDetailModal() {
  const overlay = document.querySelector('[data-modal="detail"]');
  if (!overlay) return;
  overlay.addEventListener("mousedown", e => { if (e.target === overlay) closeDetailModal(); });
  overlay.querySelectorAll('[data-close="detail"]').forEach(b => (b.onclick = closeDetailModal));

  const candidateId = state.ui.openCandidateId;
  if (candidateId === null) return;

  const moveBtn = document.getElementById("detail-move-btn");
  if (moveBtn) moveBtn.onclick = () => {
    const moveTo = document.getElementById("detail-moveto").value;
    if (!moveTo) return;
    const result = actions.moveCandidate(candidateId, moveTo);
    if (result.ok) closeDetailModal();
  };

  const techBtn = document.getElementById("detail-tech-btn");
  if (techBtn) techBtn.onclick = () => {
    const value = Number(document.getElementById("detail-tech-input").value);
    const err = validateScore(value);
    if (err) { state.ui.detailForm.techError = err; state.ui.detailForm.techScore = value; renderModals(); return; }
    state.ui.detailForm.techError = null;
    actions.updateTechnicalScore(candidateId, value);
  };

  const intvBtn = document.getElementById("detail-intv-btn");
  if (intvBtn) intvBtn.onclick = () => {
    const value = Number(document.getElementById("detail-intv-input").value);
    const err = validateScore(value);
    if (err) { state.ui.detailForm.intvError = err; state.ui.detailForm.intvScore = value; renderModals(); return; }
    state.ui.detailForm.intvError = null;
    actions.updateInterviewScore(candidateId, value);
  };

  const withdrawBtn = document.getElementById("detail-withdraw-btn");
  if (withdrawBtn) withdrawBtn.onclick = () => {
    const stages = actions.allStages();
    let candidate = null;
    for (const s of stages) { const found = s.candidates.find(c => c.id === candidateId); if (found) { candidate = found; break; } }
    if (!candidate) return;
    if (!window.confirm(`Withdraw ${candidate.name} (#${candidate.id})? This cannot be undone.`)) return;
    const result = actions.withdrawCandidate(candidateId);
    if (result.ok) closeDetailModal();
  };
}

/* ---- Stages management ---- */
const STAGES_TABS = [
  { id: "add", label: "Add" },
  { id: "insert", label: "Insert after" },
  { id: "remove", label: "Remove" },
  { id: "reverse", label: "Reverse" },
];

function openStagesModal() {
  const stages = actions.allStages();
  state.ui.stagesOpen = true;
  state.ui.stagesTab = "add";
  state.ui.stagesForm = { newName: "", afterName: stages[0]?.name || "", insertName: "", removeName: stages[0]?.name || "" };
  renderModals();
}
function closeStagesModal() { state.ui.stagesOpen = false; renderModals(); }

function renderStagesModalHTML() {
  const open = state.ui.stagesOpen;
  const stages = actions.allStages();
  const tab = state.ui.stagesTab;
  const f = state.ui.stagesForm || {};

  const tabsHtml = STAGES_TABS.map(t => `<button class="tab-btn ${tab === t.id ? "active" : ""}" data-tab="${t.id}">${t.label}</button>`).join("");

  let body = "";
  if (tab === "add") {
    body = `
      <form id="stages-add-form">
        <div class="field"><label>Stage name</label><input type="text" name="newName" placeholder="e.g. Final Offer" value="${escapeAttr(f.newName)}" required autofocus></div>
        <p class="field-hint" style="margin-bottom:16px">Appended to the end of the pipeline.</p>
        <button type="submit" class="btn btn-primary btn-block">Add stage</button>
      </form>
    `;
  } else if (tab === "insert") {
    body = `
      <form id="stages-insert-form">
        <div class="field"><label>New stage name</label><input type="text" name="insertName" placeholder="e.g. Online Assessment" value="${escapeAttr(f.insertName)}" required autofocus></div>
        <div class="field">
          <label>Insert after</label>
          <select name="afterName">${stages.map(s => `<option value="${escapeAttr(s.name)}" ${s.name === f.afterName ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}</select>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Insert stage</button>
      </form>
    `;
  } else if (tab === "remove") {
    body = `
      <form id="stages-remove-form">
        <div class="field">
          <label>Stage</label>
          <select name="removeName">${stages.map(s => `<option value="${escapeAttr(s.name)}" ${s.name === f.removeName ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}</select>
        </div>
        <p class="field-hint" style="margin-bottom:16px">Only an empty stage (no candidates) can be removed.</p>
        <button type="submit" class="btn btn-danger btn-block">Remove stage</button>
      </form>
    `;
  } else if (tab === "reverse") {
    body = `
      <div>
        <p class="field-hint" style="margin-bottom:16px">Flips the order of every stage in the pipeline — candidates stay exactly where they are, only the chain's direction changes. Reversible.</p>
        <button class="btn btn-primary btn-block" id="stages-reverse-btn">Reverse pipeline order</button>
      </div>
    `;
  }

  return `
  <div class="modal-overlay ${open ? "open" : ""}" data-modal="stages">
    <div class="modal">
      <div class="modal-head">
        <div><h2>Manage stages</h2><p>Shape the pipeline itself</p></div>
        <button class="modal-close" data-close="stages">&times;</button>
      </div>
      <div class="modal-body">
        <div class="tabs">${tabsHtml}</div>
        ${body}
      </div>
    </div>
  </div>
  `;
}

function syncStagesFormFromDom() {
  const f = state.ui.stagesForm;
  const addForm = document.getElementById("stages-add-form");
  if (addForm) f.newName = new FormData(addForm).get("newName") || "";
  const insertForm = document.getElementById("stages-insert-form");
  if (insertForm) { const fd = new FormData(insertForm); f.insertName = fd.get("insertName") || ""; f.afterName = fd.get("afterName") || f.afterName; }
  const removeForm = document.getElementById("stages-remove-form");
  if (removeForm) f.removeName = new FormData(removeForm).get("removeName") || f.removeName;
}

function wireStagesModal() {
  const overlay = document.querySelector('[data-modal="stages"]');
  if (!overlay) return;
  overlay.addEventListener("mousedown", e => { if (e.target === overlay) closeStagesModal(); });
  overlay.querySelectorAll('[data-close="stages"]').forEach(b => (b.onclick = closeStagesModal));
  overlay.querySelectorAll("[data-tab]").forEach(btn => {
    btn.onclick = () => {
      syncStagesFormFromDom();
      state.ui.stagesTab = btn.dataset.tab;
      renderModals();
    };
  });

  const addForm = document.getElementById("stages-add-form");
  if (addForm) addForm.addEventListener("submit", e => {
    e.preventDefault();
    const name = new FormData(addForm).get("newName").trim();
    const r = actions.addStage(name);
    if (r.ok) closeStagesModal();
  });

  const insertForm = document.getElementById("stages-insert-form");
  if (insertForm) insertForm.addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(insertForm);
    const r = actions.insertStage(fd.get("insertName").trim(), fd.get("afterName"));
    if (r.ok) closeStagesModal();
  });

  const removeForm = document.getElementById("stages-remove-form");
  if (removeForm) removeForm.addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(removeForm);
    const r = actions.removeStage(fd.get("removeName"));
    if (r.ok) closeStagesModal();
  });

  const reverseBtn = document.getElementById("stages-reverse-btn");
  if (reverseBtn) reverseBtn.onclick = () => { actions.reversePipeline(); closeStagesModal(); };
}

/* ---- Analyze ---- */
const ANALYZE_OPS = [
  { id: "promote", label: "Promote eligible candidates", desc: "Advances anyone who clears the next stage's bar, one hop at a time" },
  { id: "best", label: "Get best candidate", desc: "Weighted 40% CGPA · 35% technical · 25% interview" },
  { id: "integrity", label: "Check pipeline integrity", desc: "Looks for a candidate listed in two stages at once" },
  { id: "cycle", label: "Detect a cycle", desc: "Floyd's algorithm over the stage linked list" },
  { id: "crowded", label: "Most crowded stage", desc: "" },
  { id: "stats", label: "Display statistics", desc: "Per-stage averages across the pipeline" },
];

function openAnalyzeModal() {
  state.ui.analyzeOpen = true;
  state.ui.analyzeSkill = "";
  state.ui.analyzeOutput = null;
  renderModals();
}
function closeAnalyzeModal() { state.ui.analyzeOpen = false; renderModals(); }

function renderAnalyzeModalHTML() {
  const open = state.ui.analyzeOpen;
  const output = state.ui.analyzeOutput;
  let outputHtml = "";
  if (output) {
    outputHtml = output.type === "text"
      ? `<div class="analyze-output">${escapeHtml(output.value)}</div>`
      : `<div class="analyze-output">${renderStatsOutputHTML(output.rows, output.total)}</div>`;
  }
  const opsHtml = ANALYZE_OPS.map(op => `
    <button class="analyze-btn" data-op="${op.id}">${escapeHtml(op.label)}${op.desc ? `<span class="desc">${escapeHtml(op.desc)}</span>` : ""}</button>
  `).join("");

  return `
  <div class="modal-overlay ${open ? "open" : ""}" data-modal="analyze">
    <div class="modal wide">
      <div class="modal-head">
        <div><h2>Analyze pipeline</h2><p>Read-only checks and pipeline-wide operations</p></div>
        <button class="modal-close" data-close="analyze">&times;</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Find candidates by skill</label>
          <div style="display:flex;gap:8px">
            <input type="text" id="analyze-skill-input" placeholder="e.g. Python" value="${escapeAttr(state.ui.analyzeSkill)}" style="flex:1">
            <button class="btn btn-primary btn-sm" id="analyze-skill-btn">Search</button>
          </div>
        </div>

        <div class="section-title">Pipeline-wide operations</div>
        <div class="analyze-grid">${opsHtml}</div>

        ${outputHtml}
      </div>
    </div>
  </div>
  `;
}

function renderStatsOutputHTML(rows, total) {
  const maxCount = Math.max(1, ...rows.map(r => r.count));
  const rowsHtml = rows.map(r => `
    <div class="bar-row">
      <div class="bar-row-head"><span>${escapeHtml(r.name)}</span><span>${r.count} candidate(s)</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(r.count / maxCount) * 100}%"></div></div>
      <p class="field-hint">${r.count > 0 ? `Avg CGPA ${fmt(r.avgCgpa)} · Avg technical ${fmt(r.avgTech)} · Avg interview ${fmt(r.avgIntv)}` : "No candidates"}</p>
    </div>
  `).join("");
  return `${rowsHtml}<p class="field-hint" style="margin-top:8px">Total candidates in pipeline: <b style="color:var(--text-hi)">${total}</b></p>`;
}

function wireAnalyzeModal() {
  const overlay = document.querySelector('[data-modal="analyze"]');
  if (!overlay) return;
  overlay.addEventListener("mousedown", e => { if (e.target === overlay) closeAnalyzeModal(); });
  overlay.querySelectorAll('[data-close="analyze"]').forEach(b => (b.onclick = closeAnalyzeModal));

  const skillInput = document.getElementById("analyze-skill-input");
  const skillBtn = document.getElementById("analyze-skill-btn");
  function runSkillSearch() {
    state.ui.analyzeSkill = skillInput.value;
    const term = skillInput.value.trim();
    if (!term) return;
    const results = actions.findCandidatesBySkill(term);
    state.ui.analyzeOutput = results.length === 0
      ? { type: "text", value: `No candidate found with the skill "${term}".` }
      : { type: "text", value: results.map(r => `${r.stage} — #${r.candidate.id} ${r.candidate.name}`).join("\n") };
    renderModals();
  }
  if (skillBtn) skillBtn.onclick = runSkillSearch;
  if (skillInput) skillInput.addEventListener("keydown", e => { if (e.key === "Enter") runSkillSearch(); });

  overlay.querySelectorAll("[data-op]").forEach(btn => { btn.onclick = () => runAnalyzeOp(btn.dataset.op); });
}

function runAnalyzeOp(id) {
  if (id === "promote") {
    const r = actions.promoteEligibleCandidates();
    state.ui.analyzeOutput = { type: "text", value: (r.log && r.log.length) ? r.log.join("\n") : r.msg };
  } else if (id === "best") {
    const best = actions.getBestCandidate();
    state.ui.analyzeOutput = !best
      ? { type: "text", value: "No candidates available." }
      : { type: "text", value: `#${best.candidate.id} ${best.candidate.name}\n${best.candidate.university} · CGPA ${fmt(best.candidate.cgpa)} · Technical ${best.candidate.technicalScore} · Interview ${best.candidate.interviewScore}\nFinal score: ${fmt(best.score)}` };
  } else if (id === "integrity") {
    const r = actions.checkPipelineIntegrity();
    state.ui.analyzeOutput = { type: "text", value: r.msg };
  } else if (id === "cycle") {
    const cyclic = actions.hasCycle();
    state.ui.analyzeOutput = { type: "text", value: cyclic ? "Cycle detected." : "No cycle detected — the pipeline is a clean chain." };
  } else if (id === "crowded") {
    const stage = actions.getMostCrowdedStage();
    state.ui.analyzeOutput = !stage
      ? { type: "text", value: "Pipeline is empty." }
      : { type: "text", value: `${stage.name}\n${stage.candidates.length} candidate(s)` };
  } else if (id === "stats") {
    const { rows, total } = actions.displayStatistics();
    state.ui.analyzeOutput = { type: "stats", rows, total };
  }
  renderModals();
}

/* ---------------------------------------------------------------
   GLOBAL: Escape closes whichever modal(s) are open
   --------------------------------------------------------------- */
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (state.ui.addOpen) closeAddModal();
  if (state.ui.openCandidateId !== null) closeDetailModal();
  if (state.ui.stagesOpen) closeStagesModal();
  if (state.ui.analyzeOpen) closeAnalyzeModal();
});

/* ---------------------------------------------------------------
   BOOT
   --------------------------------------------------------------- */
renderAll();
