/* Full-screen menu for phones: an orange circle grows from the button, and the words rise in. */
import gsap from 'gsap';
import { lockScroll, reducedMotion, unlockScroll } from '../scroll.js';

export function createMenu({ toggle, panel, nav }) {
  const words = [...panel.querySelectorAll('.menu__link span')];
  const languages = panel.querySelector('.menu__lang');
  let open = false;
  let theme = null;
  let running = null;

  function origin() {
    const box = toggle.getBoundingClientRect();
    return `${box.left + box.width / 2}px ${box.top + box.height / 2}px`;
  }

  function show() {
    if (open) return;
    open = true;
    theme = nav.dataset.theme;
    nav.dataset.theme = 'orange';
    nav.classList.add('is-menu');
    toggle.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    lockScroll();
    running?.kill();
    if (reducedMotion) {
      words[0]?.parentElement.focus({ preventScroll: true });
      return;
    }
    running = gsap.timeline()
      .fromTo(panel, { clipPath: `circle(0% at ${origin()})` }, { clipPath: `circle(150% at ${origin()})`, duration: 0.62, ease: 'power3.inOut' })
      .fromTo(words, { yPercent: 115, rotation: 5 }, { yPercent: 0, rotation: 0, duration: 0.7, ease: 'back.out(1.5)', stagger: 0.07 }, 0.2)
      .fromTo(languages, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.5);
    words[0]?.parentElement.focus({ preventScroll: true });
  }

  function hide() {
    if (!open) return;
    open = false;
    nav.dataset.theme = theme;
    nav.classList.remove('is-menu');
    toggle.setAttribute('aria-expanded', 'false');
    unlockScroll();
    running?.kill();
    const done = () => { panel.hidden = true; gsap.set(panel, { clearProps: 'clipPath' }); };
    if (reducedMotion) {
      done();
      return;
    }
    running = gsap.to(panel, { clipPath: `circle(0% at ${origin()})`, duration: 0.45, ease: 'power3.inOut', onComplete: done });
  }

  toggle.addEventListener('click', () => (open ? hide() : show()));
  panel.addEventListener('click', (event) => {
    if (event.target.closest('a')) hide();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) {
      hide();
      toggle.focus();
    }
  });

  return { hide };
}
