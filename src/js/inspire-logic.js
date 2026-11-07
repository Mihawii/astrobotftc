/* Inspire readiness rules. No DOM here, so they can be tested. */
export const LEVELS = ['todo', 'draft', 'ready'];

export const criterionId = (award, index) => `${award.id}-${index}`;

export function awardCovered(award, marks) {
  return award.criteria.every(([kind], i) => kind !== 'required' || marks[criterionId(award, i)] === 'ready');
}

export function groupStatus(awards, marks) {
  const status = {};
  for (const award of awards) {
    status[award.group] = status[award.group] || [];
    if (awardCovered(award, marks)) status[award.group].push(award.name);
  }
  return status;
}

// Table 6-2: at least one award per category, plus the team-wide requirements.
export function readiness(awards, teamGates, marks, checks) {
  const groups = groupStatus(awards, marks);
  const missingGroups = Object.keys(groups).filter((g) => groups[g].length === 0);
  const missingGates = teamGates.filter(([id]) => !checks[id]).map(([id]) => id);
  return { groups, missingGroups, missingGates, ready: !missingGroups.length && !missingGates.length };
}

// Imported files come from outside the app, so keep only known keys and values.
export function cleanState(raw, awards, teamGates, rules) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const inMarks = source.marks && typeof source.marks === 'object' ? source.marks : {};
  const inNotes = source.notes && typeof source.notes === 'object' ? source.notes : {};
  const inChecks = source.checks && typeof source.checks === 'object' ? source.checks : {};
  const state = { marks: {}, notes: {}, checks: {} };
  for (const award of awards) {
    award.criteria.forEach((_, i) => {
      const id = criterionId(award, i);
      if (LEVELS.includes(inMarks[id])) state.marks[id] = inMarks[id];
      if (typeof inNotes[id] === 'string') state.notes[id] = inNotes[id].slice(0, 2000);
    });
  }
  for (const [id] of [...teamGates, ...rules]) {
    if (inChecks[id] === true) state.checks[id] = true;
  }
  return state;
}
