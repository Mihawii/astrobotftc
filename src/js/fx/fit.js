// Sets the biggest type size that keeps one line inside its parent and within a share of the screen height.
export function fitToWidth(el, share, maxHeight) {
  const parent = el.parentElement;
  const style = getComputedStyle(parent);
  const room = (parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) * share;
  el.style.fontSize = '100px';
  if (!el.offsetWidth) return;
  el.style.fontSize = `${Math.min((100 * room) / el.offsetWidth, window.innerHeight * maxHeight)}px`;
}
