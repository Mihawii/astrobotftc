/* A still, flat version of the board, for reduced motion or devices without WebGL. */
import { DIRS, cells, key } from './hive-engine.js';

const NS = 'http://www.w3.org/2000/svg';
const SIZE = 34;

const toPixel = (q, r) => [SIZE * Math.sqrt(3) * (q + r / 2), SIZE * 1.5 * r];

function node(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value));
  return el;
}

function hexPoints(cx, cy) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = ((60 * i - 30) * Math.PI) / 180;
    return `${cx + (SIZE - 2) * Math.cos(angle)},${cy + (SIZE - 2) * Math.sin(angle)}`;
  }).join(' ');
}

export function createFlatBoard(svg) {
  let level = null;

  function draw(bot, pollenLeft) {
    const span = SIZE * Math.sqrt(3) * (level.radius + 0.75);
    const tall = SIZE * 1.5 * level.radius + SIZE * 1.3;
    svg.setAttribute('viewBox', `${-span} ${-tall} ${span * 2} ${tall * 2}`);
    svg.replaceChildren();
    const walls = new Set(level.walls.map(([q, r]) => key(q, r)));
    const pollen = new Set(pollenLeft);
    const hive = key(...level.hive);

    for (const [q, r] of cells(level.radius)) {
      const [x, y] = toPixel(q, r);
      const id = key(q, r);
      let kind = 'cell';
      if (walls.has(id)) kind = 'cell cell-wall';
      if (id === hive) kind = 'cell cell-hive';
      svg.append(node('polygon', { points: hexPoints(x, y), class: kind }));
      if (pollen.has(id)) svg.append(node('circle', { cx: x, cy: y, r: 10, class: 'pollen' }));
    }

    const [x, y] = toPixel(bot.q, bot.r);
    const [hx, hy] = toPixel(...DIRS[bot.dir]);
    const angle = (Math.atan2(hy, hx) * 180) / Math.PI + 90;
    const group = node('g', { transform: `translate(${x} ${y})` });
    group.append(node('path', { d: 'M0,-9 L8,7 L-8,7 Z', class: 'bot-heading', transform: `rotate(${angle}) translate(0 -27)` }));
    group.append(node('ellipse', { rx: 15, ry: 10, cy: 1, class: 'bot-backing' }));
    group.append(node('image', { href: './assets/mark.svg', x: -22, y: -20, width: 44, height: 40 }));
    svg.append(group);
  }

  const start = () => draw(level.start, level.pollen.map(([q, r]) => key(q, r)));

  return {
    load(next) {
      level = next;
      start();
    },
    reset: start,
    step(frame) {
      draw(frame, frame.pollen);
      return Promise.resolve();
    },
    finish: () => Promise.resolve(),
  };
}
