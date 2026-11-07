/* Builds the logo as live SVG so every part can move, and rasterizes it for the shaders. */
import { EYE_LEFT, EYE_RIGHT, FACE, LETTERS, SHELL, SMILE, VIEWBOX } from './logo-parts.js';

const NS = 'http://www.w3.org/2000/svg';

// The tip of the antenna, in logo units. The loader fires its spark from here.
export const ANTENNA_TIP = { x: 105.17, y: 17.02, r: 17.12 };

// Solid part of the chin: the scroll zoom dives into this so the screen ends up pure orange.
export const CHIN = { x: 104, y: 181, width: 96, height: 19 };

const LAYOUTS = {
  wide: { viewBox: [0, 0, VIEWBOX.width, VIEWBOX.height], head: [0, 0, 1], word: [0, 0, 1] },
  tall: { viewBox: [0, 0, 780, 520], head: [193, 0, 1.7], word: [-246, 286, 1] },
};

export const layoutFor = (width, height) => (width / height < 0.95 ? 'tall' : 'wide');

function node(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  if (parent) parent.append(el);
  return el;
}

const place = ([x, y, s]) => `translate(${x} ${y}) scale(${s})`;

export function createLockup(host) {
  const svg = node('svg', { class: 'lockup', 'aria-hidden': 'true', focusable: 'false' });
  const defs = node('defs', {}, svg);
  node('rect', { x: -20, y: -20, width: 280, height: 66 }, node('clipPath', { id: 'lk-clip-antenna' }, defs));
  node('rect', { x: -20, y: 45, width: 280, height: 200 }, node('clipPath', { id: 'lk-clip-body' }, defs));

  const headSlot = node('g', {}, svg);
  const head = node('g', { class: 'lk-head' }, headSlot);
  const antenna = node('g', { class: 'lk-antenna' }, head);
  node('path', { d: SHELL, 'clip-path': 'url(#lk-clip-antenna)' }, antenna);
  const face = node('path', { class: 'lk-face', d: FACE }, head);
  const shell = node('path', { class: 'lk-shell', d: SHELL, 'clip-path': 'url(#lk-clip-body)' }, head);
  const eyes = node('g', { class: 'lk-eyes' }, head);
  const eyeLeft = node('ellipse', { ...EYE_LEFT }, eyes);
  const eyeRight = node('path', { d: EYE_RIGHT }, eyes);
  const smile = node('path', { class: 'lk-smile', d: SMILE }, head);

  const wordSlot = node('g', {}, svg);
  const word = node('g', { class: 'lk-word' }, wordSlot);
  const letters = LETTERS.map((d) => node('path', { class: 'lk-letter', d }, word));

  function layout(name) {
    const { viewBox, head: h, word: w } = LAYOUTS[name];
    svg.setAttribute('viewBox', viewBox.join(' '));
    headSlot.setAttribute('transform', place(h));
    wordSlot.setAttribute('transform', place(w));
    svg.dataset.layout = name;
  }

  host.append(svg);
  return { svg, head, antenna, face, shell, eyes, eyeLeft, eyeRight, smile, word, letters, layout };
}

// Small head for the nav and footer. It takes its colour from the surrounding text.
export function createMiniHead(host) {
  const svg = node('svg', { class: 'mini-head', viewBox: '0 0 232 211', 'aria-hidden': 'true', focusable: 'false' });
  node('path', { class: 'mini-head__face', d: FACE }, svg);
  node('path', { d: SHELL }, svg);
  const eyes = node('g', { class: 'mini-head__eyes' }, svg);
  node('ellipse', { ...EYE_LEFT }, eyes);
  node('path', { d: EYE_RIGHT }, eyes);
  node('path', { class: 'mini-head__smile', d: SMILE }, svg);
  host.append(svg);
  return { svg, eyes };
}

// Room around the logo in the raster, so a jumping head stays inside it.
export const RASTER_MARGIN = 0.1;

const matrixKey = ({ a, b, c, d, e, f }) => `${a.toFixed(3)},${b.toFixed(3)},${c.toFixed(3)},${d.toFixed(3)},${e.toFixed(2)},${f.toFixed(2)}`;

/*
 * A live silhouette of the logo for the shaders. Each part is drawn with the matrix it has on
 * screen right now, so a jump, an antenna wobble or a glance all show up in the light.
 */
export function createRaster(lockup, width) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const shell = new Path2D(SHELL);
  const eyeRight = new Path2D(EYE_RIGHT);
  const smile = new Path2D(SMILE);
  const letters = LETTERS.map((d) => new Path2D(d));
  let signature = '';

  function draw() {
    const screen = lockup.svg.getScreenCTM();
    if (!screen) return false;
    const toRoot = screen.inverse();
    const local = (el) => toRoot.multiply(el.getScreenCTM());
    const parts = {
      head: local(lockup.head),
      antenna: local(lockup.antenna),
      eyes: local(lockup.eyes),
      smile: local(lockup.smile),
      letters: lockup.letters.map(local),
    };
    const name = lockup.svg.dataset.layout;
    const next = [name, parts.head, parts.antenna, parts.eyes, parts.smile, ...parts.letters].map((m) => (typeof m === 'string' ? m : matrixKey(m))).join('|');
    if (next === signature) return false;
    signature = next;

    const { viewBox } = LAYOUTS[name];
    const margin = viewBox[2] * RASTER_MARGIN;
    const scale = width / (viewBox[2] + margin * 2);
    const height = Math.round((viewBox[3] + margin * 2) * scale);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const place = (m) => ctx.setTransform(scale * m.a, scale * m.b, scale * m.c, scale * m.d, scale * (m.e + margin), scale * (m.f + margin));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';

    ctx.save();
    place(parts.antenna);
    ctx.beginPath();
    ctx.rect(-20, -20, 280, 66);
    ctx.clip();
    ctx.fill(shell);
    ctx.restore();

    ctx.save();
    place(parts.head);
    ctx.beginPath();
    ctx.rect(-20, 45, 280, 200);
    ctx.clip();
    ctx.fill(shell);
    ctx.restore();

    place(parts.eyes);
    ctx.fill(eyeRight);
    ctx.translate(-55.51, 158.7);
    ctx.rotate((-86 * Math.PI) / 180);
    ctx.beginPath();
    ctx.ellipse(EYE_LEFT.cx, EYE_LEFT.cy, EYE_LEFT.rx, EYE_LEFT.ry, 0, 0, Math.PI * 2);
    ctx.fill();

    place(parts.smile);
    ctx.fill(smile);

    letters.forEach((letter, i) => {
      place(parts.letters[i]);
      ctx.fill(letter);
    });
    return true;
  }

  return { canvas, draw };
}
