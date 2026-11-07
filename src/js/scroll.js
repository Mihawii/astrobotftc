/* Smooth scrolling, wired into GSAP so scroll-driven effects stay in step with it. */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const lenis = reducedMotion ? null : new Lenis({ lerp: 0.11, wheelMultiplier: 0.9 });

if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

export const lockScroll = () => lenis?.stop();
export const unlockScroll = () => lenis?.start();

export function jumpToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
}
