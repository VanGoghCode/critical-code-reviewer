/* ═══════════════════════════════════════════════════════
   Critical Code Reviewer — Demo Sequencer
   Mirrors the real CCR workflow from example-workflow.yml
   ═══════════════════════════════════════════════════════ */

'use strict';

/* ─── Finding data ─── */
const FINDINGS = [
  {
    id:       'f1',
    lineId:   'f1-line',
    lineNum:  5,
    severity: 'high',
    title:    'Deficit-Based Performance Label',
    detail:   'The key STRUGGLING frames a learner\'s difficulty as a fixed trait rather than a moment in growth — this label surfaces in logs, admin dashboards, and reports in ways that can stigmatize learners far beyond this file.',
    rec:      'Could the label reflect a phase instead? Something like developing or building-skills shifts the frame from identity to progress.',
    stage:    'Cultural & Accessibility Equity',
    scanPct:  28,
    delay:    5400,
  },
  {
    id:       'f2',
    lineId:   'f2-line',
    lineNum:  17,
    severity: 'high',
    title:    'Nuclear Family Structure Assumption',
    detail:   'Hard-coding fatherName and motherName encodes a specific family model — learners raised by single parents, same-sex couples, grandparents, or legal guardians are excluded at the data layer.',
    rec:      'A single guardianName field, or a free-text salutation drawn from the enrollment profile, would serve a broader range of family structures without schema changes later.',
    stage:    'Cultural & Accessibility Equity',
    scanPct:  56,
    delay:    7200,
  },
  {
    id:       'f3',
    lineId:   'f3-line',
    lineNum:  21,
    severity: 'medium',
    title:    'Binary Gender Option Set',
    detail:   'GENDER_OPTIONS contains only Male and Female. Non-binary, genderqueer, and intersex learners may encounter enrollment failures or forced misrepresentation when this list drives form validation or database constraints.',
    rec:      'Adding Non-binary, Prefer not to say, or a write-in option — consistent with the platform\'s stated identity policy — avoids downstream data integrity issues.',
    stage:    'Protected Attribute Governance',
    scanPct:  74,
    delay:    8900,
  },
  {
    id:       'f4',
    lineId:   'f4-line',
    lineNum:  24,
    severity: 'medium',
    title:    'Hover-Only Badge Accessibility Gap',
    detail:   'The progress badge uses a title attribute as its only accessible label. Screen readers inconsistently announce title, and the tooltip is unreachable for keyboard-only and touch users — the badge is functionally invisible to a meaningful share of learners.',
    rec:      'Adding aria-label on the wrapper div and a descriptive alt on the image makes this badge accessible without any visual change to the design.',
    stage:    'Cultural & Accessibility Equity',
    scanPct:  91,
    delay:    10400,
  },
];

/* ─── Total demo duration (ms) ─── */
const DEMO_DURATION = 14000;

/* ─── Timer management ─── */
let timers = [];

function schedule(fn, ms) {
  timers.push(setTimeout(fn, ms));
}

function clearAll() {
  timers.forEach(clearTimeout);
  timers = [];
}

/* ═══════════════════════════════════════════════════════
   STATE HELPERS
   ═══════════════════════════════════════════════════════ */

function setStepState(stepId, state) {
  const el = document.getElementById(stepId);
  if (!el) return;
  el.dataset.state = state;
}

function setStepDur(durId, text) {
  const el = document.getElementById(durId);
  if (el) el.textContent = text;
}

function setWfStatus(state, label) {
  const dot  = document.getElementById('wf-dot');
  const text = document.getElementById('wf-status-text');
  if (dot)  { dot.className = `wf-dot ${state}`; }
  if (text) { text.textContent = label; }
}

function setScanFill(pct) {
  const el = document.getElementById('scan-fill');
  if (el) el.style.width = `${pct}%`;
}

function setScanLabel(text) {
  const el = document.getElementById('scan-label');
  if (el) el.textContent = text;
}

function setCcrSub(text) {
  const el = document.getElementById('ccr-sub');
  if (el) el.textContent = text;
}

function setDemoProgress(pct) {
  const el = document.getElementById('demo-fill');
  if (el) el.style.width = `${pct}%`;
}

/* ═══════════════════════════════════════════════════════
   FINDING REVEAL
   ═══════════════════════════════════════════════════════ */

function revealFinding(f) {
  /* 1. Highlight the diff line */
  const line = document.getElementById(f.lineId);
  if (line) {
    line.classList.add(`fl-${f.severity}`);

    /* Inline flag badge */
    const flag = document.createElement('span');
    flag.className = `inline-flag ${f.severity}`;
    flag.innerHTML = `&#9679; ${f.severity === 'high' ? '⚠' : '●'} finding`;
    const code = line.querySelector('code');
    if (code) code.appendChild(flag);

    /* Scroll line into view */
    line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* 2. Inject finding card into sidebar */
  const list = document.getElementById('findings-list');
  if (!list) return;

  const card = document.createElement('div');
  card.className = `finding-card ${f.severity}`;
  card.id = `card-${f.id}`;
  card.innerHTML = `
    <div class="fc-head">
      <span class="fc-title">${escHtml(f.title)}</span>
      <span class="fc-sev ${f.severity}">${f.severity.toUpperCase()}</span>
    </div>
    <div class="fc-body">
      <p class="fc-detail">${escHtml(f.detail)}</p>
      <p class="fc-rec">${escHtml(f.rec)}</p>
    </div>
    <div class="fc-meta">
      <span class="fc-stage">${escHtml(f.stage)}</span>
      <span class="fc-line">adaptive.js:${f.lineNum}</span>
    </div>
  `;
  list.appendChild(card);

  /* Scroll sidebar to show new card */
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ═══════════════════════════════════════════════════════
   RESET DEMO
   ═══════════════════════════════════════════════════════ */

function resetDemo() {
  clearAll();

  /* Event badge */
  document.getElementById('event-badge').classList.remove('visible');

  /* WF status */
  setWfStatus('queued', 'Queued');

  /* Steps */
  ['step-checkout', 'step-ccr'].forEach(id => setStepState(id, 'pending'));
  setStepDur('dur-checkout', '');
  setStepDur('dur-ccr', '');
  setCcrSub('VanGoghCode/critical-code-reviewer@main');

  /* Analysis card */
  const analysis = document.getElementById('analysis-card');
  analysis.classList.remove('visible');
  setScanFill(0);
  setScanLabel('Initializing…');
  document.getElementById('findings-list').innerHTML = '';

  /* Scan beam */
  const beam = document.getElementById('scan-beam');
  beam.classList.remove('active');
  /* Force reflow to restart animation later */
  void beam.offsetWidth;

  /* Diff line highlights */
  document.querySelectorAll('.dl.fl-high, .dl.fl-medium').forEach(el => {
    el.classList.remove('fl-high', 'fl-medium');
  });
  document.querySelectorAll('.inline-flag').forEach(el => el.remove());

  /* Summary card */
  document.getElementById('summary-card').classList.remove('visible');

  /* Progress bar */
  setDemoProgress(0);
}

/* ═══════════════════════════════════════════════════════
   RUN DEMO
   ═══════════════════════════════════════════════════════ */

function startDemo() {
  resetDemo();

  /* ── Progressive demo progress bar ── */
  const totalMs = DEMO_DURATION;
  const tickMs  = 120;
  let elapsed   = 0;
  const progressTimer = setInterval(() => {
    elapsed += tickMs;
    setDemoProgress(Math.min((elapsed / totalMs) * 100, 100));
    if (elapsed >= totalMs) clearInterval(progressTimer);
  }, tickMs);
  timers.push(progressTimer);

  /* ── Phase 0 (t=0.6s): PR event badge appears ── */
  schedule(() => {
    document.getElementById('event-badge').classList.add('visible');
    setWfStatus('running', 'Running');
  }, 600);

  /* ── Phase 1 (t=1.2s): Checkout step starts ── */
  schedule(() => {
    setStepState('step-checkout', 'running');
  }, 1200);

  /* ── Phase 2 (t=2.8s): Checkout completes ── */
  schedule(() => {
    setStepState('step-checkout', 'done');
    setStepDur('dur-checkout', '2s');
  }, 2800);

  /* ── Phase 3 (t=3.3s): CCR step starts ── */
  schedule(() => {
    setStepState('step-ccr', 'running');
    setCcrSub('Fetching PR diff…');
  }, 3300);

  /* ── Phase 4 (t=4.0s): Analysis panel appears ── */
  schedule(() => {
    document.getElementById('analysis-card').classList.add('visible');
    setScanLabel('Building prompt stack…');
    setScanFill(8);
  }, 4000);

  /* ── Phase 5 (t=4.5s): LLM call begins, scan beam starts ── */
  schedule(() => {
    setCcrSub('Sending to gpt5_2 · single-pass…');
    setScanLabel('Scanning changed files…');
    setScanFill(14);
    const beam = document.getElementById('scan-beam');
    void beam.offsetWidth;
    beam.classList.add('active');
  }, 4500);

  /* ── Phase 6: Each finding revealed ── */
  FINDINGS.forEach(f => {
    schedule(() => {
      setScanFill(f.scanPct);
      setScanLabel(`Analyzing line ${f.lineNum}…`);
      revealFinding(f);
    }, f.delay);
  });

  /* ── Phase 7 (t=12.0s): Scan complete ── */
  schedule(() => {
    setScanFill(100);
    setScanLabel('Complete — 4 findings');
    setCcrSub('Posting inline comments…');
  }, 12000);

  /* ── Phase 8 (t=12.8s): CCR step done ── */
  schedule(() => {
    setStepState('step-ccr', 'done');
    setStepDur('dur-ccr', '12s');
    setWfStatus('done', 'Success');
    setCcrSub('2 inline comments posted');
  }, 12800);

  /* ── Phase 9 (t=13.2s): Summary card reveals ── */
  schedule(() => {
    document.getElementById('summary-card').classList.add('visible');
    document.getElementById('summary-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 13200);
}

/* ─── Boot ─── */
document.getElementById('replay-btn').addEventListener('click', startDemo);
document.addEventListener('DOMContentLoaded', () => {
  /* Small delay so the page paints before the demo begins */
  setTimeout(startDemo, 500);
});
