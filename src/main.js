import { makeModel, run, imagePart, nanoStatus, downloadNano, InferenceMode, InferenceSource } from './hybrid.js';
import { cloudConfigured } from './firebase.js';
import { TASKS } from './tasks.js';
import { checkSchema } from './schema.js';
import { grade } from './grade.js';
import { decide, configSnippet } from './verdict.js';
import { draftInputs, fixPrompt } from './helpers.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const srcLabel = (s) => (s === InferenceSource.ON_DEVICE ? 'on-device' : s === InferenceSource.IN_CLOUD ? 'cloud' : s);

let task = null;      // working copy of the selected task
let inputs = [];      // [{ text, file, url }]
let lastRows = [];    // results of the last run
let nano = 'checking';

/* ---------- status pills + Nano setup ---------- */

async function refreshNano() {
  nano = await nanoStatus();
  const label = { available: 'ready', downloadable: 'not downloaded', downloading: 'downloading', unavailable: 'not supported here', 'no-api': 'off' }[nano] || nano;
  $('nanoPill').textContent = `Nano: ${label}`;
  $('nanoPill').dataset.ok = nano === 'available';
  const setup = $('setup');
  setup.hidden = nano === 'available';
  if (nano === 'no-api') {
    $('setupMsg').textContent = "This browser has no Prompt API, so only the cloud side will run. To test Nano you need Chrome on desktop:";
    $('setupSteps').innerHTML = `
      <li>Chrome 139 or newer on Windows, macOS or Linux. 16 GB RAM or a GPU with more than 4 GB, and 22 GB free disk.</li>
      <li>Open <code>chrome://flags/#prompt-api-for-gemini-nano-multimodal-input</code>, set it to <b>Enabled</b>, restart Chrome.</li>
      <li>Come back here and press <b>Download Gemini Nano</b>.</li>`;
    $('dlBtn').hidden = true;
  } else if (nano === 'unavailable') {
    $('setupMsg').textContent = 'Chrome says this device cannot run Gemini Nano (not enough memory, GPU or disk). The cloud side still works.';
    $('setupSteps').innerHTML = '';
    $('dlBtn').hidden = true;
  } else {
    $('setupMsg').textContent = 'Gemini Nano is supported here but not downloaded yet (about 4 GB, one time).';
    $('setupSteps').innerHTML = '';
    $('dlBtn').hidden = false;
  }
}

$('dlBtn').onclick = async () => {
  $('dlBtn').disabled = true;
  $('dlBar').hidden = false;
  try {
    const m = makeModel({ mode: InferenceMode.PREFER_ON_DEVICE });
    await downloadNano(m, (p) => {
      $('dlFill').style.width = `${p}%`;
      $('dlPct').textContent = `${Math.floor(p)}%`;
    });
  } catch (e) {
    $('dlPct').textContent = `Download failed: ${e.message}`;
  }
  $('dlBtn').disabled = false;
  refreshNano();
};

$('cloudPill').textContent = cloudConfigured ? 'Cloud: ready' : 'Cloud: not set up';
$('cloudPill').dataset.ok = cloudConfigured;

/* ---------- task editor ---------- */

function renderChips() {
  $('chips').innerHTML = TASKS.map((t) => `<button class="chip" data-id="${t.id}">${esc(t.name)}</button>`).join('');
  $('chips').onclick = (e) => {
    const b = e.target.closest('.chip');
    if (b) selectTask(b.dataset.id);
  };
}

async function selectTask(id) {
  const t = TASKS.find((x) => x.id === id);
  task = { ...t, schema: t.schema ? structuredClone(t.schema) : null };
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.id === id));
  $('taskBlurb').textContent = t.blurb;
  $('system').value = t.system;
  $('schema').value = t.schema ? JSON.stringify(t.schema, null, 2) : '';
  $('schemaBox').open = !!t.schema && id === 'custom';
  inputs = await Promise.all(t.inputs.map(async (i) => {
    const file = i.image ? await i.image() : null;
    return { text: i.text, file, url: file ? URL.createObjectURL(file) : null };
  }));
  $('draftNote').hidden = true;
  renderInputs();
}

function renderInputs() {
  $('inputs').innerHTML = inputs.map((inp, i) => `
    <div class="input" data-i="${i}">
      ${inp.url ? `<img src="${inp.url}" alt="input image ${i + 1}" />` : ''}
      <textarea rows="2" data-i="${i}" placeholder="Test input ${i + 1}">${esc(inp.text)}</textarea>
      <div class="input-tools">
        <label class="btn ghost small">Image<input type="file" accept="image/png,image/jpeg" data-i="${i}" hidden /></label>
        ${inputs.length > 1 ? `<button class="btn ghost small" data-del="${i}" aria-label="Remove input">x</button>` : ''}
      </div>
    </div>`).join('');
}

$('inputs').addEventListener('input', (e) => {
  if (e.target.tagName === 'TEXTAREA') inputs[+e.target.dataset.i].text = e.target.value;
});
$('inputs').addEventListener('change', (e) => {
  if (e.target.type !== 'file') return;
  const f = e.target.files[0];
  if (!f) return;
  const i = +e.target.dataset.i;
  inputs[i].file = f;
  inputs[i].url = URL.createObjectURL(f);
  renderInputs();
});
$('inputs').addEventListener('click', (e) => {
  const d = e.target.closest('[data-del]');
  if (d) { inputs.splice(+d.dataset.del, 1); renderInputs(); }
});
$('addBtn').onclick = () => { inputs.push({ text: '', file: null, url: null }); renderInputs(); };

$('draftBtn').onclick = async () => {
  const system = $('system').value.trim();
  if (!system) { $('draftNote').hidden = false; $('draftNote').textContent = 'Write the system prompt first.'; return; }
  $('draftBtn').disabled = true;
  $('draftNote').hidden = false;
  $('draftNote').textContent = 'Drafting...';
  try {
    const r = await draftInputs(system);
    inputs = r.inputs.map((text) => ({ text, file: null, url: null }));
    renderInputs();
    $('draftNote').innerHTML = `Drafted ${badge(r.source, r.ms)} with <code>PREFER_ON_DEVICE</code>: a cheap job, so Nano first.`;
  } catch (e) {
    $('draftNote').textContent = `Could not draft: ${e.message}`;
  }
  $('draftBtn').disabled = false;
};

function readTask() {
  $('schemaErr').textContent = '';
  let schema = null;
  const raw = $('schema').value.trim();
  if (raw) {
    try { schema = JSON.parse(raw); } catch (e) { $('schemaErr').textContent = `Schema is not valid JSON: ${e.message}`; return null; }
  }
  return { ...task, system: $('system').value.trim(), schema };
}

/* ---------- run ---------- */

const badge = (source, ms) => `<span class="badge" data-src="${source}">${srcLabel(source)}${ms != null ? ` . ${(ms / 1000).toFixed(1)} s` : ''}</span>`;

async function runSide(model, inp, t) {
  try {
    const parts = inp.file ? [inp.text || 'See image.', await imagePart(inp.file)] : inp.text;
    const r = await run(model, parts);
    const schemaErrs = t.schema ? (r.json ? checkSchema(r.json, t.schema) : ['not valid JSON']) : [];
    return { ok: true, ...r, schemaErrs };
  } catch (e) {
    return { ok: false, error: friendlyError(e), schemaErrs: [] };
  }
}

function friendlyError(e) {
  const m = String(e?.message || e);
  if (/API key not valid|API_KEY_INVALID/i.test(m)) return 'Cloud is not set up yet (no Firebase project in this build).';
  if (/app-check|App Check|attestation/i.test(m)) return 'App Check blocked this request. Reload the page and try again.';
  if (/quota|429|RESOURCE_EXHAUSTED/i.test(m)) return 'Cloud free-tier limit reached for now. Try again in a minute.';
  if (/on-device|not available|unavailable/i.test(m)) return 'Gemini Nano is not available in this browser.';
  return m.length > 200 ? `${m.slice(0, 200)}...` : m;
}

function sideHtml(name, s) {
  if (!s) return `<div class="side"><div class="side-h">${name} <span class="muted">waiting...</span></div></div>`;
  if (!s.ok) return `<div class="side"><div class="side-h">${name}</div><div class="err">${esc(s.error)}</div></div>`;
  const body = s.json ? JSON.stringify(s.json, null, 2) : s.text;
  const check = s.schemaErrs.length ? `<div class="err">Schema: ${esc(s.schemaErrs.join('; '))}</div>` : '';
  return `<div class="side"><div class="side-h">${name} ${badge(s.source, s.ms)}</div><pre>${esc(body)}</pre>${check}</div>`;
}

function renderRows(rows) {
  $('results').innerHTML = rows.map((r, i) => `
    <div class="res">
      <div class="res-in">${r.input.url ? `<img src="${r.input.url}" alt="" />` : ''}<span><b>Input ${i + 1}.</b> ${esc(r.input.text)}</span></div>
      <div class="sides">${sideHtml('Gemini Nano', r.nano)}${sideHtml('Gemini cloud', r.cloud)}</div>
      ${r.grade ? `<div class="grade" data-s="${r.grade.score}"><b>${r.grade.score}/5</b> ${esc(r.grade.verdict.replace('_', ' '))}: ${esc(r.grade.reason)}</div>`
        : r.nano?.ok && r.cloud?.ok ? '<div class="grade muted">grading...</div>'
        : r.nano && r.cloud ? '<div class="grade muted">Not graded: both sides must answer.</div>' : ''}
    </div>`).join('');
}

$('runBtn').onclick = runAll;

async function runAll() {
  const t = readTask();
  if (!t) return;
  const ins = inputs.filter((i) => i.text.trim() || i.file);
  if (!t.system || !ins.length) { $('runStatus').textContent = 'Add a system prompt and at least one input.'; return; }
  task = t;
  $('runBtn').disabled = true;
  $('verdictCard').hidden = true;
  $('resultsCard').hidden = false;
  const hasImage = ins.some((i) => i.file);
  const nanoModel = makeModel({ mode: InferenceMode.ONLY_ON_DEVICE, system: t.system, schema: t.schema, image: hasImage });
  const cloudModel = makeModel({ mode: InferenceMode.ONLY_IN_CLOUD, system: t.system, schema: t.schema, image: hasImage });
  const rows = ins.map((input) => ({ input, nano: null, cloud: null, grade: null }));
  renderRows(rows);

  // Cloud calls go in parallel. Nano runs one at a time (it shares one local model).
  const cloudJobs = rows.map(async (r) => { r.cloud = await runSide(cloudModel, r.input, t); renderRows(rows); });
  for (const [i, r] of rows.entries()) {
    $('runStatus').textContent = `Nano: input ${i + 1} of ${rows.length}...`;
    if (nano === 'available') r.nano = await runSide(nanoModel, r.input, t);
    else r.nano = { ok: false, error: 'Gemini Nano is not available in this browser.', schemaErrs: [] };
    renderRows(rows);
  }
  await Promise.all(cloudJobs);

  $('runStatus').textContent = 'Grading Nano against the cloud...';
  await Promise.all(rows.map(async (r) => {
    if (r.nano.ok && r.cloud.ok) {
      try { r.grade = await grade({ task: t, input: r.input, nanoText: r.nano.text, cloudText: r.cloud.text }); }
      catch (e) { r.grade = { score: 0, verdict: 'wrong', reason: `grader error: ${e.message}` }; }
      renderRows(rows);
    }
  }));
  $('runStatus').textContent = '';
  $('runBtn').disabled = false;
  lastRows = rows;
  showVerdict(rows, t);
}

/* ---------- verdict ---------- */

function showVerdict(rows, t) {
  const v = decide(rows, { privacy: $('needPrivacy').checked, offline: $('needOffline').checked });
  $('verdictCard').hidden = false;
  const name = v.mode ? Object.entries(InferenceMode).find(([, m]) => m === v.mode)[0] : 'no verdict yet';
  $('vMode').innerHTML = `Ship: <code>${name}</code>`;
  const s = v.stats;
  $('vStats').innerHTML = [
    ['Nano score', s.avg != null ? `${s.avg}/5` : 'n/a'],
    ['Valid JSON (Nano)', s.schemaPass != null ? `${Math.round(s.schemaPass * 100)}%` : 'n/a'],
    ['Nano median', s.nanoMs != null ? `${(s.nanoMs / 1000).toFixed(1)} s` : 'n/a'],
    ['Cloud median', s.cloudMs != null ? `${(s.cloudMs / 1000).toFixed(1)} s` : 'n/a'],
  ].map(([k, val]) => `<div><span>${k}</span><b>${val}</b></div>`).join('');
  $('vWhy').innerHTML = v.why.map((w) => `<li>${esc(w)}</li>`).join('');
  $('vCode').textContent = configSnippet(v.mode || InferenceMode.PREFER_ON_DEVICE, t);
  $('vCode').hidden = $('copyBtn').parentElement.hidden = !v.mode;
  const weak = rows.some((r) => r.grade && r.grade.score > 0 && r.grade.score < 4) || rows.some((r) => r.nano?.schemaErrs.length);
  $('fixBox').hidden = !weak;
  $('fixOut').hidden = true;
  $('verdictCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('copyBtn').onclick = async () => {
  await navigator.clipboard.writeText($('vCode').textContent);
  $('copyBtn').textContent = 'Copied';
  setTimeout(() => ($('copyBtn').textContent = 'Copy'), 1500);
};

$('fixBtn').onclick = async () => {
  const failures = lastRows
    .filter((r) => (r.grade && r.grade.score < 4) || r.nano?.schemaErrs.length)
    .map((r) => ({ input: r.input.text, nano: r.nano.text, cloud: r.cloud.text, reason: r.grade?.reason || r.nano.schemaErrs.join('; ') }));
  $('fixBtn').disabled = true;
  $('fixBtn').textContent = 'Rewriting...';
  try {
    const r = await fixPrompt(task, failures);
    $('fixOut').hidden = false;
    $('fixNote').innerHTML = `${badge(r.source, r.ms)} <code>PREFER_IN_CLOUD</code>: rewriting needs the big model. ${esc(r.changes)}`;
    $('fixPrompt').value = r.prompt;
  } catch (e) {
    $('fixOut').hidden = false;
    $('fixNote').textContent = `Could not rewrite: ${e.message}`;
  }
  $('fixBtn').disabled = false;
  $('fixBtn').textContent = 'Fix my prompt for Nano';
};

$('applyBtn').onclick = () => {
  $('system').value = $('fixPrompt').value;
  window.scrollTo({ top: $('system').offsetTop - 80, behavior: 'smooth' });
  runAll();
};

/* ---------- start ---------- */
renderChips();
selectTask('ticket');
refreshNano();
