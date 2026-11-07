import '@fontsource-variable/noto-serif-display/wdth.css';
import '@fontsource-variable/onest/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { fitToWidth } from './fx/fit.js';
import { createKinetic } from './fx/kinetic.js';
import { createLoader, skipLoader } from './fx/loader.js';
import { createMenu } from './fx/menu.js';
import { createOrbit } from './fx/orbit.js';
import { clearReveals, revealIn } from './fx/reveal.js';
import { createScatter } from './fx/scatter.js';
import { createVerbs } from './fx/verbs.js';
import { createFlatBoard } from './hive-flat.js';
import { HiveGame } from './hive-game.js';
import { initHero } from './home.js';
import { STRINGS, getLang, pickLanguage, setLang, t } from './i18n.js';
import { onPoint, onTilt } from './input.js';
import { createLockup, createMiniHead, layoutFor } from './logo.js';
import { renderTeamData } from './people.js';
import { createRouter } from './router.js';
import { viewFromHash } from './routes.js';
import { lockScroll, reducedMotion, unlockScroll } from './scroll.js';


const root = document.documentElement;
const $ = (id) => document.getElementById(id);
const storedLanguage = () => { try { return localStorage.getItem('astrobot-lang'); } catch (e) { return null; } };

setLang(pickLanguage(storedLanguage(), navigator.language));

const host = $('lockup');
const lockup = createLockup(host);
lockup.layout(layoutFor(window.innerWidth, window.innerHeight));

const verbs = createVerbs(document.querySelector('.verbs'));
const scatter = createScatter();
const orbit = createOrbit($('orbit'));
const kinetic = createKinetic($('kinetic'));

function writeText() {
  clearReveals();
  root.lang = getLang();
  document.title = t('pageTitle');
  document.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = t(node.dataset.i18n); });
  document.querySelectorAll('[data-i18n-label]').forEach((node) => node.setAttribute('aria-label', t(node.dataset.i18nLabel)));
  document.querySelectorAll('[data-lang]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.lang === getLang())));
  renderTeamData();
  verbs.refresh();
  HiveGame.refresh();
}

// Effects that measure text can only run on the view that is showing.
function settle(view) {
  clearReveals();
  scatter.refresh(document.querySelector(`[data-view="${view}"]`));
  verbs.layout();
  orbit.refresh();
  document.querySelectorAll('[data-fit]').forEach((el) => fitToWidth(el, 1, 0.8));
  revealIn(document.querySelector(`[data-view="${view}"]`));
  ScrollTrigger.refresh();
}

let world = null;

if (import.meta.env.DEV) {
  window.gsap = gsap;
  window.astro = () => world;
}
let hero = null;

const router = createRouter({
  kinetic,
  onLeave(from, to) {
    if (from === 'home' && to === 'play') orbit.launch();
  },
  onShow(view) {
    orbit.reset();
    settle(view);
    if (view === 'home') hero?.measure();
  },
});

document.querySelectorAll('[data-lang]').forEach((button) => {
  button.addEventListener('click', (event) => {
    const next = button.dataset.lang;
    if (next === getLang()) return;
    router.coverFor(STRINGS[next].hello, { x: event.clientX, y: event.clientY }, () => {
      setLang(next);
      try { localStorage.setItem('astrobot-lang', next); } catch (e) { /* not essential */ }
      writeText();
      settle(router.current);
    });
  });
});

// Small heads in the nav and footer follow the pointer or finger too.
const heads = [createMiniHead($('nav-home')), createMiniHead($('footer-peek'))];
const lookAt = (x, y) => heads.forEach(({ svg, eyes }) => {
  const box = svg.getBoundingClientRect();
  const dx = x - (box.left + box.width / 2);
  const dy = y - (box.top + box.height / 2);
  const distance = Math.hypot(dx, dy) || 1;
  const reach = Math.min(distance / 30, 9);
  eyes.setAttribute('transform', `translate(${(dx / distance) * reach} ${(dy / distance) * reach * 0.8})`);
});
onPoint(lookAt);
onTilt((x, y) => heads.forEach(({ eyes }) => eyes.setAttribute('transform', `translate(${x * 9} ${y * 7})`)));

createMenu({ toggle: $('nav-toggle'), panel: $('menu'), nav: $('nav') });

if (!reducedMotion) {
  gsap.set('#footer-peek', { yPercent: 100 });
  new IntersectionObserver(([entry]) => {
    gsap.to('#footer-peek', {
      yPercent: entry.isIntersecting ? 28 : 100,
      duration: entry.isIntersecting ? 0.8 : 0.3,
      ease: entry.isIntersecting ? 'back.out(2)' : 'power2.in',
    });
  }, { threshold: 0.4 }).observe($('footer'));
}

// The nav colour follows whatever section is under it.
const themed = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) $('nav').dataset.theme = entry.target.dataset.nav;
  });
}, { rootMargin: '-3% 0px -96% 0px' });
document.querySelectorAll('[data-nav]').forEach((section) => themed.observe(section));

function wireWorld() {
  const { eclipse, planets, particles, hive: board } = world;
  hero = initHero({ hero: $('hero'), host, lockup, eclipse });
  eclipse.useLockup(lockup);
  eclipse.resize(window.innerWidth, window.innerHeight);
  hero.measure();

  ScrollTrigger.create({
    trigger: '#season',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.6,
    onUpdate: (self) => planets.setProgress(self.progress),
  });
  ScrollTrigger.create({
    trigger: '#orbit',
    start: 'top 85%',
    end: 'top top',
    scrub: 0.4,
    onUpdate: (self) => particles.setAssembly(self.progress),
  });

  const robot = $('orbit-enter');
  onPoint((x, y) => {
    planets.pointTo(x / window.innerWidth, y / window.innerHeight);
    board.pointTo(x / window.innerWidth, y / window.innerHeight);
    const box = robot.getBoundingClientRect();
    particles.pointTo(x - (box.left + box.width / 2), y - (box.top + box.height / 2));
  });
  onTilt((x, y) => {
    planets.pointTo(0.5 + x / 2, 0.5 + y / 2);
    board.pointTo(0.5 + x / 2, 0.5 + y / 2);
  });

  particles.followElement(robot);
  if (reducedMotion) particles.setAssembly(1);
  return world;
}

// First use of the GPU: open WebGL, compile the hero's shaders and start the stage.
let awake = false;
function wakeStage() {
  if (awake) return;
  awake = true;
  try {
    if (!world) throw new Error('no world');
    world.connect($('stage'));
    world.stage.watch([...document.querySelectorAll('[data-stage]')]);
  } catch (error) {
    console.warn('WebGL is not available', error);
    world = null;
    root.classList.add('no-webgl');
  }
  startGame();
}

function reveal(point, face) {
  if (!world) {
    root.classList.add('no-webgl');
    return;
  }
  const { eclipse } = world;
  eclipse.placeLight(point.x, point.y);
  if (reducedMotion) {
    eclipse.reveal.value = 1;
    gsap.set(face, { opacity: 0 });
    world.stage.redraw();
    return;
  }
  gsap.to(eclipse.reveal, { value: 1, duration: 2, ease: 'power2.out' });
  gsap.to(face, { opacity: 0, duration: 0.7, ease: 'power2.inOut' });
}

function finishIntro() {
  root.classList.remove('is-loading');
  unlockScroll();
  hero?.startWatching();
  ScrollTrigger.refresh();
}

// The 3D board needs WebGL and motion. Everyone else gets the flat one.
function startGame() {
  const flat = !world || reducedMotion;
  $('play').classList.toggle('is-flat', flat);
  HiveGame.init(flat ? createFlatBoard($('board')) : world.hive);
}

async function boot() {
  const firstView = viewFromHash(location.hash);
  const theShow = firstView === 'home' && !reducedMotion;
  writeText();
  router.show('home');
  lockScroll();

  const loaderRoot = $('loader');
  const fonts = Promise.all([
    document.fonts.load('900 100px "Noto Serif Display Variable"', 'AЯҚ'),
    document.fonts.load('400 16px "Onest Variable"', 'AЯҚ'),
  ]).then(() => settle('home'));
  const scenes = import('./stage/world.js')
    .then(async ({ createWorld }) => {
      world = await createWorld();
      wireWorld();
    })
    .catch((error) => console.warn('The 3D scenes could not load', error));
  const ready = Promise.allSettled([fonts, scenes]);

  if (theShow) {
    await createLoader({ root: loaderRoot, host, lockup, ready, wake: wakeStage, onLaunch: reveal, onDone: finishIntro }).start();
    return;
  }

  await ready;
  wakeStage();
  skipLoader({ root: loaderRoot, lockup, onLaunch: reveal, onDone: finishIntro });
  if (firstView !== 'home') router.show(firstView);
}

// A phone's address bar sliding away is a resize too, and must not disturb anything.
let resizing = 0;
let lastWidth = window.innerWidth;
window.addEventListener('resize', () => {
  if (window.innerWidth === lastWidth && matchMedia('(pointer: coarse)').matches) return;
  lastWidth = window.innerWidth;
  clearTimeout(resizing);
  resizing = setTimeout(() => {
    document.querySelectorAll('[data-fit]').forEach((el) => fitToWidth(el, 1, 0.8));
    if (router.current === 'home') hero?.measure();
    world?.stage?.redraw();
    ScrollTrigger.refresh();
  }, 150);
});

boot();
