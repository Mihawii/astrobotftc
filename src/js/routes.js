/* Which view a URL hash points to. Hash routes work on any static host with no server rules. */
export const VIEWS = ['home', 'story', 'season', 'play'];

export function viewFromHash(hash) {
  const name = String(hash || '').replace(/^#\/?/, '').split(/[/?]/)[0];
  return VIEWS.includes(name) ? name : 'home';
}

export const hashForView = (view) => (view === 'home' ? '#/' : `#/${view}`);
