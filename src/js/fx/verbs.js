/*
 * Manifesto words, after the pack's "text 8" (Animated Verbs): every letter is its own element,
 * so a word can act out what it means. The motion itself lives in css/verbs.css.
 */
import { t } from '../i18n.js';
import { fitToWidth } from './fit.js';

const ECHOES = 13;

// Repeatable pseudo-random numbers, so a word falls apart the same way every time.
const wobble = (i, seed) => {
  const x = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function split(el, text) {
  el.setAttribute('aria-label', text);
  const chars = Array.from(text);
  const middle = (chars.length - 1) / 2 || 1;
  el.replaceChildren(...chars.map((char, i) => {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = char;
    span.dataset.char = char;
    span.setAttribute('aria-hidden', 'true');
    const side = (i - middle) / middle;
    span.style.setProperty('--i', i);
    span.style.setProperty('--side', side.toFixed(3));
    span.style.setProperty('--edge', Math.abs(side).toFixed(3));
    span.style.setProperty('--tilt', `${((wobble(i, 1) - 0.5) * 62).toFixed(1)}deg`);
    span.style.setProperty('--drop', `${(8 + wobble(i, 2) * 30).toFixed(1)}%`);
    return span;
  }));
}

// Tall screens have room to spare, so the word repeats above and below itself like a poster.
function echo(el, text) {
  const stack = document.createElement('span');
  stack.className = 'verb__echo';
  stack.setAttribute('aria-hidden', 'true');
  stack.append(...Array.from({ length: ECHOES }, (_, i) => {
    const row = document.createElement('span');
    const away = Math.abs(i - (ECHOES - 1) / 2);
    row.textContent = text;
    row.style.setProperty('--away', away);
    if (away === 0) row.style.visibility = 'hidden';
    return row;
  }));
  el.append(stack);
}

export function createVerbs(root) {
  const words = [...root.querySelectorAll('[data-verb]')];
  const panels = [...root.querySelectorAll('.verb')];

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.target.classList.toggle('is-live', entry.isIntersecting));
  }, { threshold: 0.3 });
  panels.forEach((panel) => observer.observe(panel));

  const layout = () => words.forEach((word) => fitToWidth(word, 0.94, 0.74));
  window.addEventListener('resize', layout);

  return {
    refresh() {
      words.forEach((word) => {
        split(word, t(word.dataset.verb));
        echo(word, t(word.dataset.verb));
      });
      layout();
    },
    layout,
  };
}
