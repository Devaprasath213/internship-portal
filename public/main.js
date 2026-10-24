'use strict';
const $ = (id) => document.getElementById(id);
const els = { list: $('list'), status: $('status'), error: $('error'), empty: $('empty'),
  q: $('q'), domain: $('domain'), mode: $('mode'), dialog: $('apply-dialog'), form: $('apply-form') };
let lastFocus = null;
let timer = null;

// ---------- Loading list ----------
function setState(state) {
  els.error.hidden = state !== 'error';
  els.empty.hidden = state !== 'empty';
  els.list.hidden = state === 'error' || state === 'empty';
  els.status.textContent = { loading: 'Loading internships…', error: 'Failed to load internships.',
    empty: 'No internships found.', ready: '' }[state];
  if (state === 'loading') {
    els.list.replaceChildren(...Array.from({ length: 3 }, () => {
      const li = document.createElement('li'); li.className = 'skeleton'; li.setAttribute('aria-hidden', 'true'); return li;
    }));
  }
}

async function load() {
  setState('loading');
  const params = new URLSearchParams({ q: els.q.value.trim(), domain: els.domain.value, mode: els.mode.value });
  try {
    const res = await fetch('/api/internships?' + params);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const body = await res.json();
    if (body.status !== 'success') throw new Error('Bad envelope');
    if (!body.data.length) return setState('empty');
    render(body.data);
    setState('ready');
    els.status.textContent = `${body.pagination.total} internship(s) found.`;
  } catch {
    setState('error');
  }
}

function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text; // textContent only: API data is never parsed as HTML
  if (cls) n.className = cls;
  return n;
}

function render(items) {
  els.list.replaceChildren(...items.map((it) => {
    const li = el('li', undefined, 'card');
    li.append(el('h3', it.title),
      el('p', `${it.domain} · ${it.mode} · ${it.location}`, 'meta'),
      el('p', `${it.openings} opening${it.openings === 1 ? '' : 's'}`, 'meta'));
    const chips = el('ul', undefined, 'chips');
    it.skills.forEach((s) => chips.append(el('li', s)));
    const btn = el('button', 'Apply');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Apply for ${it.title}`);
    btn.addEventListener('click', () => openForm(it, btn));
    li.append(chips, btn);
    return li;
  }));
}

// ---------- Application form ----------
const FIELDS = ['name', 'email', 'portfolioUrl', 'message'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientValidate(v) {
  const e = {};
  if (!v.name.trim()) e.name = 'Name is required.';
  else if (v.name.length > 100) e.name = 'Name must be 100 characters or fewer.';
  if (!EMAIL_RE.test(v.email.trim())) e.email = 'Enter a valid email address.';
  if (v.portfolioUrl.trim()) {
    try { const u = new URL(v.portfolioUrl.trim()); if (!/^https?:$/.test(u.protocol)) throw 0; }
    catch { e.portfolioUrl = 'Portfolio must be a valid http(s) URL.'; }
  }
  if (v.message.length > 1000) e.message = 'Message must be 1000 characters or fewer.';
  return e;
}

function showErrors(errs, general) {
  FIELDS.forEach((f) => {
    $(f + '-err').textContent = errs[f] || '';
    $(f).setAttribute('aria-invalid', errs[f] ? 'true' : 'false');
  });
  $('form-err').textContent = general || '';
  const first = FIELDS.find((f) => errs[f]);
  if (first) $(first).focus();
}

function openForm(item, trigger) {
  lastFocus = trigger;
  els.form.reset();
  $('internshipId').value = item.id;
  $('apply-title').textContent = `Apply: ${item.title}`;
  $('form-ok').textContent = '';
  showErrors({}, '');
  $('submit').disabled = false;
  els.dialog.showModal();
  $('name').focus();
}

els.form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const v = { internshipId: $('internshipId').value };
  FIELDS.forEach((f) => { v[f] = $(f).value; });
  $('form-ok').textContent = '';
  const local = clientValidate(v);
  if (Object.keys(local).length) return showErrors(local, '');
  showErrors({}, '');

  $('submit').disabled = true;
  $('submit').textContent = 'Submitting…';
  try {
    const res = await fetch('/api/applications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v),
    });
    let body = {};
    try { body = await res.json(); } catch { /* non-JSON error */ }
    if (res.status === 201) {
      $('form-ok').textContent = 'Application submitted. Thank you!';
      els.form.reset();
    } else {
      const errs = {}; const general = [];
      (body.errors || []).forEach((e) => (e.field && FIELDS.includes(e.field) ? (errs[e.field] = e.message) : general.push(e.message)));
      if (res.status === 429) general.push('Too many attempts. Please wait and try again.');
      showErrors(errs, general.join(' ') || 'Submission failed. Please try again.');
    }
  } catch {
    showErrors({}, 'Network error. Check your connection and try again.');
  } finally {
    $('submit').disabled = false;
    $('submit').textContent = 'Submit application';
  }
});

function closeForm() { els.dialog.close(); if (lastFocus) lastFocus.focus(); }
$('cancel').addEventListener('click', closeForm);

// ---------- Wiring ----------
$('retry').addEventListener('click', load);
els.q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });
els.domain.addEventListener('change', load);
els.mode.addEventListener('change', load);
$('filters').addEventListener('submit', (e) => e.preventDefault());
load();
