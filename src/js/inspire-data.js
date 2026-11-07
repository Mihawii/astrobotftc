/*
 * Criteria from the 2026-2027 FIRST Tech Challenge Competition Manual (version TU07),
 * Section 6.3, in short form. Recheck against the latest manual: FIRST updates it in-season.
 */
const R = 'required';
const E = 'encouraged';

export const AWARDS = [
  {
    id: 'think', name: 'Think', group: 'think', ref: '6.3.2',
    criteria: [
      [R, 'Portfolio submitted, with at least one of: engineering process evidence, lessons applied to the robot design, compared design choices, or math behind decisions'],
      [E, 'Portfolio is easy to read and information is easy to find'],
    ],
  },
  {
    id: 'innovate', name: 'Innovate', group: 'mci', ref: '6.3.6',
    criteria: [
      [R, 'Examples of engineering work show how the design was developed'],
      [R, 'Robot or mechanism design is creative, unique, or both'],
      [R, 'Design is stable, reliable, and helps reach game goals most of the time'],
      [E, 'Can explain how design risks were reduced'],
    ],
  },
  {
    id: 'control', name: 'Control', group: 'mci', ref: '6.3.7',
    criteria: [
      [R, 'Portfolio covers control components, the challenge each solves, and the function of each'],
      [R, 'Uses at least one solution with external feedback to control the robot'],
      [E, 'Control solutions work consistently in most matches'],
      [E, 'Can explain or demonstrate how reliable the solution is'],
      [E, 'Can describe what was learned using the engineering process'],
    ],
  },
  {
    id: 'design', name: 'Design', group: 'mci', ref: '6.3.8',
    criteria: [
      [R, 'Robot is elegant, efficient, and/or practical to maintain'],
      [R, 'Whole robot or its detailed design process is considered, not one component'],
      [E, 'Robot stands out in both appearance and function'],
      [E, 'Reasons behind design choices are clear'],
      [E, 'Design works consistently and fits the game strategy'],
    ],
  },
  {
    id: 'connect', name: 'Connect', group: 'ta', ref: '6.3.3',
    criteria: [
      [R, 'Skill plan explains learning goals and the steps toward them'],
      [E, 'Maintains meaningful relationships with STEM professionals'],
      [E, 'Actively works with the engineering community'],
    ],
  },
  {
    id: 'reach', name: 'Reach', group: 'ta', ref: '6.3.4',
    criteria: [
      [R, 'Can explain outreach objectives, strategy, and how it grows the FIRST community'],
      [R, 'Recruited new teams, coaches, mentors, or volunteers new to FIRST'],
      [E, 'Acts as an ambassador and raises public awareness of FIRST'],
      [E, 'Creates and keeps improving outreach materials'],
    ],
  },
  {
    id: 'sustain', name: 'Sustain', group: 'ta', ref: '6.3.5',
    criteria: [
      [R, 'Long-term plan covers finances, season planning, and/or team sustainability goals'],
      [R, 'Can explain how progress on those plans is measured and tracked'],
      [E, 'Clear team roles and a process for preparing future student leaders'],
      [E, 'Identifies constraints, mitigates risks, and adapts plans'],
    ],
  },
];

export const GROUPS = {
  mci: 'Machine, Creativity, and Innovation',
  ta: 'Team Attributes',
  think: 'Think',
};

export const TEAM_GATES = [
  ['portfolio', 'A portfolio is ready to submit'],
  ['inclusive', 'Team is positive and inclusive, and every member contributes'],
  ['share', 'Every member can share the team’s experience and knowledge with judges'],
];

export const PORTFOLIO_RULES = [
  ['cover', 'One cover page with the team number'],
  ['pages', 'No more than 15 content pages after the cover'],
  ['size', 'US Letter or A4, and under 15MB if digital'],
  ['dates', 'Only covers progress since January 1, 2026 (earlier seasons only to show growth)'],
  ['names', 'Students appear by first name and last initial only'],
  ['read', 'No fonts under 10 pt or low-contrast text on images'],
  ['inside', 'Everything judges need is on the page, with no reliance on links or videos'],
  ['credit', 'AI or research tools used are credited in a footnote or endnote'],
  ['numbers', 'Outreach shows measured impact and sustained work, not one-off events'],
];
