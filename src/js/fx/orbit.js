/*
 * Rings of text around the particle robot, from the pack's "hero 16" (Circular Text Effect).
 * The rings run on scroll speed, spin up when you hover Play, and fly apart when you press it.
 */
import gsap from 'gsap';
import { t } from '../i18n.js';
import { reducedMotion } from '../scroll.js';

const SPEEDS = [3.2, -4.4, 6.2, -8.6];
const CENTRE = 700;
const LENGTHS = [2830, 2001, 1341, 836];
const SIZES = [176, 134, 104, 62];

export function createOrbit(root) {
  const rings = [...root.querySelectorAll('.ring')];
  const paths = rings.map((ring) => ring.querySelector('textPath'));
  const enter = root.querySelector('.orbit__enter');
  const label = enter.querySelector('.orbit__enter-text');
  const angles = rings.map((_, i) => i * 40);
  const spin = { boost: 0 };
  let visible = false;
  let lastScroll = window.scrollY;
  let velocity = 0;

  function draw() {
    rings.forEach((ring, i) => ring.setAttribute('transform', `rotate(${angles[i].toFixed(2)} ${CENTRE} ${CENTRE})`));
  }

  function tick(_, deltaMs) {
    const scrolled = window.scrollY - lastScroll;
    lastScroll = window.scrollY;
    velocity += (scrolled - velocity) * 0.08;
    if (!visible) return;
    const seconds = Math.min(deltaMs, 50) / 1000;
    angles.forEach((_, i) => {
      angles[i] += SPEEDS[i] * seconds * (1 + spin.boost + Math.abs(velocity) * 0.5);
    });
    draw();
  }

  if (!reducedMotion) gsap.ticker.add(tick);
  draw();

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible || root.dataset.intro || reducedMotion) return;
    root.dataset.intro = 'done';
    gsap.from(rings, { scale: 0.3, opacity: 0, svgOrigin: `${CENTRE} ${CENTRE}`, duration: 2.2, ease: 'expo.out', stagger: 0.12 });
    gsap.from(label, { y: 30, opacity: 0, duration: 1, ease: 'back.out(2)', delay: 0.7 });
  }, { threshold: 0.35 }).observe(root);

  enter.addEventListener('pointerenter', () => gsap.to(spin, { boost: 9, duration: 0.5, ease: 'power3.out' }));
  enter.addEventListener('pointerleave', () => gsap.to(spin, { boost: 0, duration: 2.4, ease: 'power3.out' }));

  // Repeat the phrase until it nearly closes the circle, then size the type to close it exactly.
  function fitRing(ring, i) {
    const path = paths[i];
    const phrase = `${t(`ring${i + 1}`)} `;
    ring.style.fontSize = `${SIZES[i]}px`;
    path.textContent = phrase;
    const single = ring.getComputedTextLength();
    if (!single) return;
    path.textContent = phrase.repeat(Math.max(1, Math.round(LENGTHS[i] / single)));
    ring.style.fontSize = `${(SIZES[i] * LENGTHS[i] * 0.997) / ring.getComputedTextLength()}px`;
  }

  return {
    refresh() {
      rings.forEach(fitRing);
    },
    // Rings fly apart on the way out, and are put back while the page is covered.
    launch() {
      if (reducedMotion) return;
      gsap.to(rings, {
        scale: (i) => 1.5 + (rings.length - i) * 0.3,
        opacity: 0,
        svgOrigin: `${CENTRE} ${CENTRE}`,
        duration: 0.9,
        ease: 'expo.inOut',
        stagger: 0.04,
      });
    },
    reset() {
      gsap.set(rings, { clearProps: 'opacity,scale,transform' });
      draw();
    },
  };
}
