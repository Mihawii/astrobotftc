/* Hive Pilot controls. Rules live in hive-engine.js, and the board draws itself. */
import { LEVELS, countBlocks, flattenPaths, run } from './hive-engine.js';
import { t } from './i18n.js';
import { buzz } from './input.js';

const OPS = [['F', 'opF'], ['L', 'opL'], ['R', 'opR'], ['C', 'opC']];
const SLOTS = 5;

const ICONS = {
  F: '<path d="M12 20V5"/><path d="m5.5 11.5 6.5-6.5 6.5 6.5"/>',
  L: '<path d="M9 5 4 10l5 5"/><path d="M4 10h10a6 6 0 0 1 6 6v3"/>',
  R: '<path d="m15 5 5 5-5 5"/><path d="M20 10H10a6 6 0 0 0-6 6v3"/>',
  C: '<circle cx="12" cy="12" r="4.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="9"/>',
  loop: '<path d="m17 2.5 4 4-4 4"/><path d="M3 11.5V10a3.5 3.5 0 0 1 3.5-3.5H21"/><path d="m7 21.5-4-4 4-4"/><path d="M21 12.5V14a3.5 3.5 0 0 1-3.5 3.5H3"/>',
  run: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
  next: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  undo: '<path d="M8.5 5.5 4 10l4.5 4.5"/><path d="M4 10h10.5a5 5 0 0 1 0 10H11"/>',
  clear: '<path d="m6 6 12 12"/><path d="M18 6 6 18"/>',
};

const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

const state = { level: 0, program: [], openLoop: null, running: false, solved: new Set(), won: false, line: null };
const $ = (id) => document.getElementById(id);
let board = null;

function loadProgress() {
  try {
    JSON.parse(localStorage.getItem('astrobot-hive') || '[]').filter((i) => LEVELS[i]).forEach((i) => state.solved.add(i));
  } catch (e) { /* start fresh */ }
  const firstOpen = LEVELS.findIndex((_, i) => !state.solved.has(i));
  state.level = firstOpen === -1 ? 0 : firstOpen;
}

function saveProgress() {
  try { localStorage.setItem('astrobot-hive', JSON.stringify([...state.solved])); } catch (e) { /* not essential */ }
}

function hexButton(kind, label, name, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `hex hex--${kind}`;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = `<span class="hex__face">${icon(name)}</span>`;
  button.addEventListener('click', () => {
    buzz(5);
    onClick();
  });
  return button;
}

function drawPalette() {
  const buttons = OPS.map(([op, text]) => hexButton(op, t(text), op, () => addBlock(op)));
  const loop = hexButton('loop', t(state.openLoop ? 'opEnd' : 'opLoop'), 'loop', toggleLoop);
  loop.classList.toggle('is-open', Boolean(state.openLoop));
  $('palette').replaceChildren(...buttons, loop);
}

function chip(block, path) {
  const item = document.createElement('li');
  item.dataset.path = path.join('.');
  if (typeof block === 'string') {
    const [, text] = OPS.find(([op]) => op === block);
    item.className = `chip chip--${block}`;
    item.setAttribute('aria-label', t(text));
    item.innerHTML = `<span class="hex__face">${icon(block)}</span>`;
    return item;
  }
  item.className = 'loop';
  item.classList.toggle('is-open', block === state.openLoop);
  const count = document.createElement('button');
  count.type = 'button';
  count.className = 'loop__count';
  count.title = t('loopHint');
  count.setAttribute('aria-label', `${t('opLoop')} ×${block.repeat}. ${t('loopHint')}`);
  count.textContent = `×${block.repeat}`;
  count.addEventListener('click', () => {
    if (state.running) return;
    block.repeat = block.repeat >= 6 ? 2 : block.repeat + 1;
    clearResult();
    drawProgram();
  });
  const body = document.createElement('ol');
  body.append(...block.body.map((inner, i) => chip(inner, [...path, i])));
  item.append(count, body);
  return item;
}

function drawProgram() {
  const items = state.program.map((block, i) => chip(block, [i]));
  for (let i = items.length; i < SLOTS; i++) {
    const slot = document.createElement('li');
    slot.className = 'chip chip--slot';
    slot.setAttribute('aria-hidden', 'true');
    slot.innerHTML = '<span class="hex__face"></span>';
    items.push(slot);
  }
  $('program').replaceChildren(...items);
  const rail = $('program');
  rail.scrollLeft = rail.scrollWidth;
  drawActions();
}

function drawActions() {
  const empty = state.program.length === 0;
  const finished = state.level === LEVELS.length - 1;
  const main = state.won
    ? hexButton('run', t(finished ? 'replay' : 'next'), 'next', () => goTo((state.level + 1) % LEVELS.length))
    : hexButton('run', t('run'), 'run', execute);
  main.disabled = state.running || (!state.won && empty);
  const undoButton = hexButton('tool', t('undo'), 'undo', undo);
  const clearButton = hexButton('tool', t('clear'), 'clear', clearProgram);
  undoButton.disabled = clearButton.disabled = state.running || empty;
  $('actions').replaceChildren(undoButton, clearButton, main);
}

function drawLevels() {
  $('level-dots').replaceChildren(...LEVELS.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'level-hex';
    dot.title = `${t('level')} ${i + 1}`;
    dot.setAttribute('aria-label', `${t('level')} ${i + 1}`);
    dot.classList.toggle('is-solved', state.solved.has(i));
    if (i === state.level) dot.setAttribute('aria-current', 'step');
    dot.addEventListener('click', () => goTo(i));
    return dot;
  }));
}

function drawLine() {
  const line = $('hud-line');
  line.textContent = state.line ?? t(`goal${state.level + 1}`);
  line.dataset.tone = state.lineTone ?? '';
}

function say(text, tone) {
  state.line = text;
  state.lineTone = tone;
  drawLine();
}

function clearResult() {
  state.won = false;
  say(null, '');
  board.reset();
}

function addBlock(op) {
  if (state.running) return;
  if (state.won || state.line) clearResult();
  (state.openLoop ? state.openLoop.body : state.program).push(op);
  drawProgram();
}

function toggleLoop() {
  if (state.running) return;
  if (state.won || state.line) clearResult();
  if (state.openLoop) {
    state.openLoop = null;
  } else {
    state.openLoop = { repeat: 3, body: [] };
    state.program.push(state.openLoop);
  }
  drawPalette();
  drawProgram();
}

function undo() {
  if (state.running) return;
  clearResult();
  const target = state.openLoop ? state.openLoop.body : state.program;
  if (state.openLoop && target.length === 0) {
    state.program.pop();
    state.openLoop = null;
  } else {
    target.pop();
  }
  drawPalette();
  drawProgram();
}

function clearProgram() {
  if (state.running) return;
  state.program = [];
  state.openLoop = null;
  clearResult();
  drawPalette();
  drawProgram();
}

function mark(path) {
  document.querySelectorAll('#program .is-now').forEach((el) => el.classList.remove('is-now'));
  if (path) document.querySelector(`#program [data-path="${path.join('.')}"]`)?.classList.add('is-now');
}

function resultMessage(status, blocks) {
  const level = LEVELS[state.level];
  if (status !== 'win') return t({ crash: 'resCrash', pollen: 'resPollen', lost: 'resLost' }[status]);
  const text = t(blocks <= level.par ? 'resPar' : 'resWin').replace('{n}', blocks);
  return state.level === LEVELS.length - 1 ? `${text} ${t('resDone')}` : text;
}

async function execute() {
  if (state.running || state.program.length === 0) return;
  clearResult();
  state.openLoop = null;
  drawPalette();
  const result = run(LEVELS[state.level], state.program);
  const paths = flattenPaths(state.program);
  state.running = true;
  drawProgram();

  for (let i = 0; i < result.trace.length; i++) {
    mark(paths[i]);
    await board.step(result.trace[i]);
  }
  mark(null);
  await board.finish(result.status);

  state.running = false;
  state.won = result.status === 'win';
  if (state.won) {
    state.solved.add(state.level);
    saveProgress();
    drawLevels();
  }
  say(resultMessage(result.status, countBlocks(state.program)), state.won ? 'win' : 'miss');
  drawProgram();
}

function goTo(index) {
  if (state.running) return;
  state.level = index;
  state.program = [];
  state.openLoop = null;
  state.won = false;
  state.line = null;
  state.lineTone = '';
  board.load(LEVELS[index]);
  refresh();
}

function refresh() {
  if (!board) return;
  drawLine();
  drawPalette();
  drawProgram();
  drawLevels();
}

function init(chosenBoard) {
  board = chosenBoard;
  loadProgress();
  board.load(LEVELS[state.level]);
  refresh();
}

export const HiveGame = { init, refresh };
