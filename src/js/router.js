/* Moves between views behind the kinetic transition. */
import { getLang, t } from './i18n.js';
import { hashForView, viewFromHash } from './routes.js';
import { jumpToTop, lockScroll, unlockScroll } from './scroll.js';

const WORDS = { home: 'navHome', story: 'navStory', season: 'navSeason', play: 'navPlay' };

export function createRouter({ kinetic, onShow, onLeave }) {
  const views = [...document.querySelectorAll('[data-view]')];
  const main = document.getElementById('main');
  let current = null;
  let busy = false;

  function show(view) {
    current = view;
    views.forEach((el) => { el.hidden = el.dataset.view !== view; });
    jumpToTop();
    document.documentElement.dataset.page = view;
    document.querySelectorAll('.nav__links a, .menu__link').forEach((link) => {
      if (viewFromHash(link.getAttribute('href')) === view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    onShow(view);
  }

  async function go(view, origin, { push = true } = {}) {
    if (busy || view === current) return;
    busy = true;
    lockScroll();
    onLeave?.(current, view);
    await kinetic.cover(t(WORDS[view]), origin);
    show(view);
    if (push) history.pushState(null, '', hashForView(view));
    await kinetic.uncover();
    unlockScroll();
    main.focus({ preventScroll: true });
    busy = false;
  }

  // Any other full-screen change, such as switching language, shares the same cover.
  async function coverFor(word, origin, change) {
    if (busy) return;
    busy = true;
    lockScroll();
    await kinetic.cover(word, origin);
    change();
    await kinetic.uncover();
    unlockScroll();
    busy = false;
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#/"]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    const view = viewFromHash(link.getAttribute('href'));
    if (view === current) {
      jumpToTop();
      return;
    }
    go(view, { x: event.clientX, y: event.clientY });
  });

  window.addEventListener('popstate', () => go(viewFromHash(location.hash), undefined, { push: false }));

  return { show, go, coverFor, get current() { return current; }, lang: getLang };
}
