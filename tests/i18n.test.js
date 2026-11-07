import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { LANGS, STRINGS, pickLanguage } from '../src/js/i18n.js';

test('every language has every string', () => {
  const keys = Object.keys(STRINGS.en);
  for (const lang of LANGS) {
    assert.deepStrictEqual(keys.filter((k) => !(k in STRINGS[lang])), [], lang);
    assert.deepStrictEqual(Object.keys(STRINGS[lang]).filter((k) => !(k in STRINGS.en)), [], lang);
    assert.deepStrictEqual(keys.filter((k) => !STRINGS[lang][k]), [], `${lang} empty`);
  }
});

test('a saved language wins, then the browser, then English', () => {
  assert.strictEqual(pickLanguage('kk', 'ru-RU'), 'kk');
  assert.strictEqual(pickLanguage(null, 'ru-RU'), 'ru');
  assert.strictEqual(pickLanguage('xx', 'kk'), 'kk');
  assert.strictEqual(pickLanguage(null, 'de-DE'), 'en');
  assert.strictEqual(pickLanguage(null, undefined), 'en');
});

test('every string the page asks for exists', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const wanted = [...html.matchAll(/data-(?:i18n|i18n-label|verb)="(\w+)"/g)].map((match) => match[1]);
  assert.ok(wanted.length > 20);
  assert.deepStrictEqual(wanted.filter((id) => !(id in STRINGS.en)), []);
});
