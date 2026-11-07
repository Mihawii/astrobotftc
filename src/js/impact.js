/* Pure helpers for team data. Shared by the page and the tests. */
// Mirrors the student privacy rule in the Competition Manual (A201).
export function safeName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || '';
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export function summarize(outreach) {
  const entries = Array.isArray(outreach) ? outreach : [];
  const sum = (key) => entries.reduce((total, e) => total + (Number(e[key]) || 0), 0);
  const recurring = entries.filter((e) => e.recurring).length;
  return {
    events: entries.length,
    people: sum('people'),
    hours: sum('hours'),
    newToFirst: sum('newToFirst'),
    recurringShare: entries.length ? Math.round((recurring / entries.length) * 100) : 0,
  };
}
