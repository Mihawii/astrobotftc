/* Sections driven by team.js: they stay hidden until the team fills in real data. */
import { t } from './i18n.js';
import { safeName, summarize } from './impact.js';
import { TEAM } from './team.js';

function el(tag, props, text) {
  const node = Object.assign(document.createElement(tag), props);
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderImpact() {
  const section = document.getElementById('impact');
  section.hidden = TEAM.outreach.length === 0;
  if (section.hidden) return;
  const s = summarize(TEAM.outreach);
  const stats = [
    [s.people, 'impactPeople'], [s.hours, 'impactHours'], [s.events, 'impactEvents'],
    [`${s.recurringShare}%`, 'impactRecurring'], [s.newToFirst, 'impactNew'],
  ];
  document.getElementById('impact-numbers').replaceChildren(...stats.map(([value, label]) => {
    const box = el('div');
    box.append(el('dd', {}, value), el('dt', {}, t(label)));
    return box;
  }));
  const recent = [...TEAM.outreach].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  document.getElementById('impact-list').replaceChildren(...recent.map((entry) => {
    const row = el('li');
    row.append(el('time', { dateTime: entry.date }, entry.date), el('span', {}, entry.title), el('b', {}, entry.people || ''));
    return row;
  }));
}

function renderPeople() {
  const section = document.getElementById('people');
  section.hidden = TEAM.roster.length === 0 && TEAM.sponsors.length === 0;
  document.getElementById('roster').replaceChildren(...TEAM.roster.map((person) => {
    const row = el('li');
    row.append(el('strong', {}, safeName(person.name)), el('span', {}, person.role || ''));
    return row;
  }));
  document.getElementById('sponsors').replaceChildren(...TEAM.sponsors.map((sponsor) => {
    const row = el('li');
    row.append(sponsor.url ? el('a', { href: sponsor.url, rel: 'noopener' }, sponsor.name) : el('span', {}, sponsor.name));
    return row;
  }));
}

function renderFooter() {
  const links = [
    [TEAM.schoolSite, 'linkSchool'],
    [TEAM.projectSite, 'linkProject'],
    [TEAM.instagram, 'linkInstagram'],
    [TEAM.contactEmail && `mailto:${TEAM.contactEmail}`, 'linkEmail'],
  ].filter(([href]) => href);
  document.getElementById('footer-links').replaceChildren(...links.map(([href, label]) => {
    const row = el('li');
    row.append(el('a', { href, rel: 'noopener' }, t(label)));
    return row;
  }));
}

export function renderTeamData() {
  renderImpact();
  renderPeople();
  renderFooter();
  document.getElementById('project-link').href = TEAM.projectSite;
}
