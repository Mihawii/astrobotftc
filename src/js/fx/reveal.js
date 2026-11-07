/*
 * Line-by-line block reveal, from the pack's "text 15" (Copy.jsx), without React.
 * A coloured bar sweeps across each line, the text appears behind it, and the bar leaves.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { reducedMotion } from '../scroll.js';

gsap.registerPlugin(SplitText, ScrollTrigger);

const active = [];

function build(el) {
  let shown = false;
  let trigger = null;

  const split = SplitText.create(el, {
    type: 'lines',
    linesClass: 'rv-line',
    autoSplit: true,
    onSplit(self) {
      trigger?.kill();
      const lines = [];
      const blocks = [];
      self.lines.forEach((line) => {
        const wrapper = document.createElement('span');
        wrapper.className = 'rv-wrap';
        line.parentNode.insertBefore(wrapper, line);
        wrapper.append(line);
        const block = document.createElement('span');
        block.className = 'rv-block';
        wrapper.append(block);
        lines.push(line);
        blocks.push(block);
      });
      if (shown) return;

      gsap.set(lines, { opacity: 0 });
      gsap.set(blocks, { scaleX: 0, transformOrigin: 'left center' });
      trigger = ScrollTrigger.create({
        trigger: el,
        // Near the very bottom edge, so a line sitting low on a phone screen still appears unprompted.
        start: 'top 97%',
        once: true,
        onEnter() {
          shown = true;
          blocks.forEach((block, i) => {
            gsap.timeline({ delay: i * 0.1 })
              .to(block, { scaleX: 1, duration: 0.55, ease: 'power4.inOut' })
              .set(lines[i], { opacity: 1 })
              .set(block, { transformOrigin: 'right center' })
              .to(block, { scaleX: 0, duration: 0.55, ease: 'power4.inOut' });
          });
        },
      });
    },
  });
  return { split, kill: () => trigger?.kill() };
}

// Call with a view once it is visible: line breaks can only be measured on screen.
export function revealIn(root) {
  if (reducedMotion) return;
  root.querySelectorAll('[data-reveal]').forEach((el) => active.push(build(el)));
}

export function clearReveals() {
  while (active.length) {
    const { split, kill } = active.pop();
    kill();
    split.revert();
  }
}
