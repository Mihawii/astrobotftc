/*
 * Full-screen page transition, from the pack's "page 10" (Kinetic Typography): lines of giant
 * type rotate and scale until the letters become the screen. Here the word is where you are going.
 */
import gsap from 'gsap';
import { reducedMotion } from '../scroll.js';

export function createKinetic(root) {
  const type = root.querySelector('.kinetic__type');
  const lines = [...root.querySelectorAll('.kinetic__line')];

  function cover(word, origin = { x: window.innerWidth / 2, y: window.innerHeight / 2 }) {
    lines.forEach((line) => { line.textContent = `${word} ${word} ${word} ${word}`; });
    const at = `${origin.x}px ${origin.y}px`;

    if (reducedMotion) {
      gsap.set(type, { opacity: 0 });
      gsap.set(root, { visibility: 'visible', clipPath: 'none', opacity: 0 });
      return gsap.to(root, { opacity: 1, duration: 0.2 }).then();
    }

    gsap.set(root, { visibility: 'visible', opacity: 1, clipPath: `circle(0% at ${at})` });
    gsap.set(type, { opacity: 1, scale: 1, rotation: 0 });
    gsap.set(lines, { x: '0%', opacity: 0.14 });

    return new Promise((resolve) => {
      gsap.timeline()
        .to(root, { clipPath: `circle(150% at ${at})`, duration: 0.55, ease: 'power2.in' }, 0)
        .to(type, { scale: 2.7, rotation: -90, duration: 1, ease: 'power2.inOut' }, 0.06)
        .to(lines, {
          keyframes: [
            { x: '20%', duration: 0.6, ease: 'power1.inOut' },
            { x: '-200%', duration: 0.8, ease: 'power1.in' },
          ],
          stagger: 0.022,
        }, 0.06)
        .to(lines, {
          keyframes: [
            { opacity: 1, duration: 0.5, ease: 'power1.in' },
            { opacity: 1, duration: 0.5 },
            { opacity: 0, duration: 0.3 },
          ],
        }, 0.06)
        .add(resolve, 0.98);
    });
  }

  function uncover() {
    const done = () => gsap.set(root, { visibility: 'hidden', clearProps: 'clipPath,opacity' });
    if (reducedMotion) return gsap.to(root, { opacity: 0, duration: 0.2, onComplete: done }).then();
    return gsap.fromTo(
      root,
      { clipPath: 'inset(0% 0% 0% 0%)' },
      { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.62, ease: 'power3.inOut', delay: 0.08, onComplete: done },
    ).then();
  }

  return { cover, uncover };
}
