/* Inspire Tracker page. */
import '@fontsource-variable/noto-serif-display/wdth.css';
import '@fontsource-variable/onest/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import { AWARDS, GROUPS, PORTFOLIO_RULES, TEAM_GATES } from './inspire-data.js';
import { LEVELS, awardCovered, cleanState, criterionId, readiness } from './inspire-logic.js';

const STORE = 'astrobot-inspire';
const LEVEL_NAMES = { todo: 'Not started', draft: 'Drafted', ready: 'Ready' };
const $ = (id) => document.getElementById(id);

let state = load();

function load() {
  try {
    return cleanState(JSON.parse(localStorage.getItem(STORE)), AWARDS, TEAM_GATES, PORTFOLIO_RULES);
  } catch (e) {
    return cleanState(null, AWARDS, TEAM_GATES, PORTFOLIO_RULES);
  }
}

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch (e) {
    $('save-status').textContent = 'This browser is blocking saves. Use Export to keep your progress.';
  }
}

function el(tag, props, text) {
  const node = Object.assign(document.createElement(tag), props);
  if (text !== undefined) node.textContent = text;
  return node;
}

function checkRow(id, text) {
  const row = el('li');
  const label = el('label', { className: 'check' });
  const box = el('input', { type: 'checkbox', checked: Boolean(state.checks[id]) });
  box.addEventListener('change', () => {
    if (box.checked) state.checks[id] = true;
    else delete state.checks[id];
    save();
    drawGates();
  });
  label.append(box, el('span', {}, text));
  row.append(label);
  return row;
}

function drawGates() {
  const result = readiness(AWARDS, TEAM_GATES, state.marks, state.checks);
  const groupRows = Object.entries(GROUPS).map(([id, name]) => {
    const covered = result.groups[id] || [];
    const row = el('li', { className: covered.length ? 'gate gate-ok' : 'gate' });
    row.append(el('strong', {}, name), el('span', {}, covered.length ? covered.join(', ') : 'No award covered yet'));
    return row;
  });
  const gates = $('gates');
  const checks = gates.querySelectorAll('.check');
  if (checks.length === 0) {
    gates.replaceChildren(...groupRows, ...TEAM_GATES.map(([id, text]) => checkRow(id, text)));
  } else {
    gates.querySelectorAll('.gate').forEach((old) => old.remove());
    gates.prepend(...groupRows);
  }
  const left = result.missingGroups.length + result.missingGates.length;
  $('verdict').textContent = result.ready
    ? 'All Inspire requirements are covered. Now practice saying it in the interview.'
    : `${left} of ${Object.keys(GROUPS).length + TEAM_GATES.length} requirements still open.`;
  $('verdict').classList.toggle('verdict-ok', result.ready);
}

function criterionRow(award, kind, text, index) {
  const id = criterionId(award, index);
  const row = el('li', { className: 'criterion' });
  const head = el('div', { className: 'criterion-head' });
  head.append(el('span', { className: `tag tag-${kind}` }, kind === 'required' ? 'Required' : 'Encouraged'), el('p', {}, text));

  const select = el('select', { ariaLabel: `Status: ${text}` });
  select.append(...LEVELS.map((level) => el('option', { value: level }, LEVEL_NAMES[level])));
  select.value = state.marks[id] || 'todo';
  select.addEventListener('change', () => {
    state.marks[id] = select.value;
    save();
    drawGates();
    drawAwardBadges();
  });

  const note = el('textarea', { rows: 1, placeholder: 'Evidence: portfolio page, or who says it in the interview', ariaLabel: `Evidence: ${text}` });
  note.value = state.notes[id] || '';
  note.addEventListener('input', () => { state.notes[id] = note.value; save(); });

  row.append(head, select, note);
  return row;
}

function drawAwards() {
  $('awards').replaceChildren(...AWARDS.map((award) => {
    const card = el('details', { className: 'award', open: award.group === 'think' });
    const summary = el('summary');
    summary.append(
      el('span', { className: 'award-name' }, award.name),
      el('span', { className: 'award-ref' }, `${GROUPS[award.group]} · ${award.ref}`),
      el('span', { className: 'badge', id: `badge-${award.id}` }),
    );
    const list = el('ul', { className: 'criteria' });
    list.append(...award.criteria.map(([kind, text], i) => criterionRow(award, kind, text, i)));
    card.append(summary, list);
    return card;
  }));
  drawAwardBadges();
}

function drawAwardBadges() {
  for (const award of AWARDS) {
    const covered = awardCovered(award, state.marks);
    const badge = $(`badge-${award.id}`);
    badge.textContent = covered ? 'Covered' : 'Open';
    badge.classList.toggle('badge-ok', covered);
  }
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const link = el('a', { href: URL.createObjectURL(blob), download: 'astrobot-inspire.json' });
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importState(event) {
  const [file] = event.target.files;
  if (!file) return;
  try {
    state = cleanState(JSON.parse(await file.text()), AWARDS, TEAM_GATES, PORTFOLIO_RULES);
    save();
    drawAll();
    $('save-status').textContent = 'Progress imported.';
  } catch (e) {
    $('save-status').textContent = 'That file could not be read. Choose a file made with Export.';
  }
  event.target.value = '';
}

function drawAll() {
  $('gates').replaceChildren();
  drawGates();
  drawAwards();
  $('rules').replaceChildren(...PORTFOLIO_RULES.map(([id, text]) => checkRow(id, text)));
}

$('export').addEventListener('click', exportState);
$('import').addEventListener('change', importState);
drawAll();
