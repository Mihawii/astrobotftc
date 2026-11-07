/* One WebGL canvas behind the whole site. Sections pick which scene it shows. */
import * as THREE from 'three';
import { reducedMotion } from '../scroll.js';

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x08070c, 1);

  const scenes = new Map();
  // The canvas is sized in CSS to the large viewport, so a collapsing address bar never resizes it.
  const size = { width: canvas.clientWidth, height: canvas.clientHeight };
  let active = null;
  let frame = 0;
  let last = 0;
  let elapsed = 0;

  function applySize() {
    if (!active) return;
    renderer.setPixelRatio(active.pixelRatio());
    renderer.setSize(size.width, size.height, false);
    active.resize(size.width, size.height);
  }

  function loop(now) {
    frame = requestAnimationFrame(loop);
    const delta = Math.min((now - last) / 1000, 0.1);
    last = now;
    elapsed += delta;
    if (active.tune?.(delta)) applySize();
    active.render(renderer, delta, elapsed);
  }

  function show(name) {
    const next = name ? scenes.get(name) : null;
    if (next === active) return;
    active = next;
    cancelAnimationFrame(frame);
    canvas.classList.toggle('is-off', !active);
    if (!active) return;
    applySize();
    last = performance.now();
    if (reducedMotion) redraw();
    else frame = requestAnimationFrame(loop);
  }

  // With reduced motion the stage is a still image, drawn only when something changes.
  function redraw() {
    if (active && reducedMotion) active.render(renderer, 0, 0);
  }

  window.addEventListener('resize', () => {
    if (canvas.clientWidth === size.width && canvas.clientHeight === size.height) return;
    size.width = canvas.clientWidth;
    size.height = canvas.clientHeight;
    applySize();
  });

  // The section taking up the most of the screen decides what the stage shows.
  function watch(sections) {
    const ratios = new Map();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
      let best = null;
      let top = 0;
      for (const [section, ratio] of ratios) {
        if (ratio > top) {
          top = ratio;
          best = section;
        }
      }
      show(best?.dataset.stage ?? null);
    }, { threshold: [0, 0.01, 0.1, 0.25, 0.5, 0.75, 1] });
    sections.forEach((section) => observer.observe(section));
  }

  return { renderer, add: (name, scene) => scenes.set(name, scene), show, watch, redraw };
}
