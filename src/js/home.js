/* The hero: the star follows the pointer, and scrolling dives into the robot's chin. */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { onPoint, onTilt } from './input.js';
import { CHIN, layoutFor } from './logo.js';
import { reducedMotion } from './scroll.js';

export function initHero({ hero, host, lockup, eclipse }) {
  const svg = lockup.svg;
  const pin = hero.querySelector('.hero__pin');
  const nav = document.getElementById('nav');
  const stage = document.getElementById('stage');
  const view = { chinX: 0, chinY: 0, unit: 1, dive: 1 };
  let progress = 0;

  function apply() {
    const p = progress;
    const scale = view.dive ** (p ** 1.5);
    const pull = Math.min(p * 1.6, 1);
    gsap.set(host, {
      x: (window.innerWidth / 2 - view.chinX) * pull,
      y: (window.innerHeight / 2 - view.chinY) * pull,
      scale,
    });
    eclipse.setRect(svg.getBoundingClientRect());
    eclipse.uniforms.uPower.value = 1 - p * 0.7;
    if (p > 0 && p < 1) nav.dataset.theme = p > 0.76 ? 'orange' : 'night';
  }

  function measure() {
    gsap.set(host, { clearProps: 'transform' });
    const name = layoutFor(window.innerWidth, window.innerHeight);
    if (svg.dataset.layout !== name) lockup.layout(name);
    // The parent's matrix: the head itself may be mid-animation.
    const matrix = lockup.head.parentNode.getScreenCTM();
    const chin = new DOMPoint(CHIN.x, CHIN.y).matrixTransform(matrix);
    const box = host.getBoundingClientRect();
    view.chinX = chin.x;
    view.chinY = chin.y;
    view.unit = matrix.a;
    view.dive = Math.max(
      (stage.clientHeight * 1.08) / (CHIN.height * view.unit),
      (stage.clientWidth * 1.08) / (CHIN.width * view.unit),
    );
    gsap.set(host, { transformOrigin: `${chin.x - box.left}px ${chin.y - box.top}px` });
    eclipse.resize(stage.clientWidth, stage.clientHeight);
    apply();
  }

  if (!reducedMotion) {
    ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      // Measured from the pin, not the window: a phone's address bar changes the window's height.
      end: () => `+=${hero.offsetHeight - pin.offsetHeight}`,
      scrub: true,
      onUpdate(self) {
        progress = self.progress;
        apply();
      },
    });
  }

  onPoint((x, y) => {
    if (progress < 0.5) eclipse.pointTo(x, y);
  });
  onTilt((x, y) => eclipse.lean(x, y));

  // The robot keeps an eye on the star.
  const eyeX = gsap.quickTo(lockup.eyes, 'x', { duration: 0.35, ease: 'power3' });
  const eyeY = gsap.quickTo(lockup.eyes, 'y', { duration: 0.35, ease: 'power3' });
  let watching = false;
  function watchStar() {
    if (!watching || progress > 0.3) return;
    const head = lockup.head.getBoundingClientRect();
    const dx = eclipse.light.x * window.innerWidth - (head.left + head.width / 2);
    const dy = (1 - eclipse.light.y) * window.innerHeight - (head.top + head.height / 2);
    const distance = Math.hypot(dx, dy) || 1;
    const reach = Math.min(distance / 90, 7);
    eyeX((dx / distance) * reach);
    eyeY((dy / distance) * reach * 0.8);
  }
  gsap.ticker.add(watchStar);

  // Poke the robot and it jumps.
  svg.addEventListener('click', () => {
    if (!watching) return;
    gsap.timeline()
      .to(lockup.head, { y: -36, scaleY: 1.08, scaleX: 0.94, duration: 0.2, ease: 'power3.out', transformOrigin: '50% 100%' })
      .to(lockup.head, { y: 0, scaleY: 0.88, scaleX: 1.1, duration: 0.16, ease: 'power2.in' })
      .to(lockup.head, { scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1.2, 0.3)' });
    gsap.fromTo(lockup.antenna, { rotation: -18 }, { rotation: 0, svgOrigin: '104 46', duration: 1.1, ease: 'elastic.out(1.5, 0.15)' });
  });

  return {
    measure,
    startWatching() { watching = true; },
  };
}
