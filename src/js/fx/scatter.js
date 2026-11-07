/*
 * Letters that dodge the pointer, from the pack's "text 16" (MenuXL Text Displacement).
 * Reworked to survive scrolling, wrapping and language changes.
 */
import gsap from 'gsap';
import { onPoint, recentlyTouched, touchDevice } from '../input.js';
import { reducedMotion } from '../scroll.js';

const RADIUS = 1.5;
const PUSH = 1.25;
const EASE = 0.12;

const pointer = { x: -9999, y: -9999 };
const blocks = [];

function splitInto(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  const pieces = text.split(/(\s+)/).filter(Boolean).map((part) => {
    if (/^\s+$/.test(part)) return document.createTextNode(' ');
    const word = document.createElement('span');
    word.className = 'sc-word';
    word.setAttribute('aria-hidden', 'true');
    Array.from(part).forEach((char) => {
      const span = document.createElement('span');
      span.className = 'sc-char';
      span.textContent = char;
      word.append(span);
    });
    return word;
  });
  el.replaceChildren(...pieces);
  return [...el.querySelectorAll('.sc-char')].map((node) => ({ node, x: 0, y: 0, cx: 0, cy: 0, tx: 0, ty: 0 }));
}

// Letter centres are stored relative to the block, so scrolling never invalidates them.
function measure(block) {
  const box = block.el.getBoundingClientRect();
  block.size = parseFloat(getComputedStyle(block.el).fontSize);
  block.letters.forEach((letter) => {
    const rect = letter.node.getBoundingClientRect();
    letter.cx = rect.left + rect.width / 2 - box.left - letter.x;
    letter.cy = rect.top + rect.height / 2 - box.top - letter.y;
  });
}

// With no cursor on a phone, an unseen sweep ripples through the words every few seconds.
// It pushes gently: a narrow screen has no room for letters to fly off and still read.
const SWEEP_FORCE = 0.42;

function sweep(box, time) {
  const across = ((time * 0.34) % 2.3) - 0.2;
  return { x: box.left + across * box.width, y: box.top + box.height * (0.5 + 0.4 * Math.sin(time * 1.6)) };
}

function step(time) {
  for (const block of blocks) {
    if (!block.visible) continue;
    const box = block.el.getBoundingClientRect();
    const reach = block.size * RADIUS;
    const idle = touchDevice && !recentlyTouched();
    const aim = idle ? sweep(box, time) : pointer;
    const push = block.size * PUSH * (idle ? SWEEP_FORCE : 1);
    for (const letter of block.letters) {
      const dx = box.left + letter.cx - aim.x;
      const dy = box.top + letter.cy - aim.y;
      const distance = Math.hypot(dx, dy) || 1;
      const force = distance < reach ? (1 - distance / reach) * push : 0;
      letter.tx = (dx / distance) * force;
      letter.ty = (dy / distance) * force;
      letter.x += (letter.tx - letter.x) * EASE;
      letter.y += (letter.ty - letter.y) * EASE;
      if (Math.abs(letter.x) + Math.abs(letter.y) < 0.05) {
        if (letter.moved) letter.node.style.transform = '';
        letter.moved = false;
        continue;
      }
      letter.moved = true;
      letter.node.style.transform = `translate(${letter.x}px, ${letter.y}px) rotate(${letter.x * 0.12}deg)`;
    }
  }
}

export function createScatter() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const block = blocks.find((b) => b.el === entry.target);
      if (block) block.visible = entry.isIntersecting;
    });
  });

  if (!reducedMotion) {
    onPoint((x, y) => {
      pointer.x = x;
      pointer.y = y;
    });
    gsap.ticker.add(step);
  }

  const measureAll = () => blocks.forEach(measure);
  window.addEventListener('resize', measureAll);

  return {
    // Re-split after text changes. Skipped elements keep their plain text.
    refresh(root = document) {
      blocks.splice(0).forEach((block) => observer.unobserve(block.el));
      root.querySelectorAll('[data-scatter]').forEach((el) => {
        const block = { el, letters: splitInto(el), visible: false, size: 100 };
        blocks.push(block);
        observer.observe(el);
      });
      measureAll();
    },
    measureAll,
  };
}
