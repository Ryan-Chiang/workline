import test from 'node:test';
import assert from 'node:assert/strict';

import { getDefaultReportLanguage, reportLanguageName, resolveReportLanguage } from '../src/locale.ts';

test('resolves supported report languages from locale tags', () => {
  assert.equal(resolveReportLanguage('en-US'), 'en');
  assert.equal(resolveReportLanguage('zh-CN'), 'zh-Hans');
  assert.equal(resolveReportLanguage('zh-TW'), 'zh-Hant');
  assert.equal(resolveReportLanguage('ja-JP'), 'ja');
  assert.equal(resolveReportLanguage('ko-KR'), 'ko');
  assert.equal(resolveReportLanguage('es-ES'), 'es');
  assert.equal(resolveReportLanguage('fr-FR'), 'fr');
  assert.equal(resolveReportLanguage('de-DE'), 'de');
  assert.equal(resolveReportLanguage('it-IT'), 'it');
  assert.equal(resolveReportLanguage('pt-BR'), 'pt');
  assert.equal(resolveReportLanguage('nl-NL'), 'nl');
  assert.equal(resolveReportLanguage('pl-PL'), 'pl');
});

test('falls back to English for unknown or missing locale tags', () => {
  assert.equal(resolveReportLanguage('ru-RU'), 'en');
  assert.equal(resolveReportLanguage(''), 'en');
  assert.equal(resolveReportLanguage(undefined), 'en');
});

test('resolves report language from system environment candidates', () => {
  assert.equal(getDefaultReportLanguage({ LC_ALL: 'zh_HK.UTF-8' }, 'en-US'), 'zh-Hant');
  assert.equal(getDefaultReportLanguage({ LANG: 'ja_JP.UTF-8' }, 'en-US'), 'ja');
  assert.equal(getDefaultReportLanguage({ LANGUAGE: 'de_DE:en_US' }, 'en-US'), 'de');
  assert.equal(getDefaultReportLanguage({}, 'ko-KR'), 'ko');
  assert.equal(getDefaultReportLanguage({ LC_ALL: 'ru_RU.UTF-8' }, 'en-US'), 'en');
});

test('returns stable human-readable report language names', () => {
  assert.equal(reportLanguageName('zh-Hans'), 'Simplified Chinese');
  assert.equal(reportLanguageName('zh-Hant'), 'Traditional Chinese');
  assert.equal(reportLanguageName('ja'), 'Japanese');
  assert.equal(reportLanguageName('ko'), 'Korean');
  assert.equal(reportLanguageName('fr'), 'French');
});
