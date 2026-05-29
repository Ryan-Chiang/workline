import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDefaultReportLanguage,
  getReportLanguageDecision,
  inferReportLanguageFromUserMessages,
  reportLanguageName,
  resolveReportLanguage,
} from '../src/locale.ts';

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
  assert.equal(getDefaultReportLanguage({ LANGUAGE: 'ru_RU:zh_CN:en_US' }, 'en-US'), 'zh-Hans');
  assert.equal(getDefaultReportLanguage({}, 'ko-KR'), 'ko');
  assert.equal(getDefaultReportLanguage({ LC_ALL: 'ru_RU.UTF-8' }, 'en-US'), 'en');
});

test('resolves report language decisions by explicit, history, locale, timezone, and fallback order', () => {
  assert.deepEqual(getReportLanguageDecision({
    explicitLanguage: 'ko',
    userMessages: [{ text: '请帮我生成中文报告', time: new Date('2026-05-06T12:00:00.000Z') }],
    env: { LC_ALL: 'zh_CN.UTF-8' },
    runtimeLocale: 'zh-CN',
    timezone: 'Asia/Shanghai',
  }), {
    language: 'ko',
    source: 'explicit',
    confidence: 'high',
  });

  assert.deepEqual(getReportLanguageDecision({
    userMessages: [
      { text: 'Please summarize the work in English.', time: new Date('2026-05-06T10:00:00.000Z') },
      { text: '请用中文整理这周的工作进展。', time: new Date('2026-05-06T12:00:00.000Z') },
    ],
    env: { LC_ALL: 'en_US.UTF-8' },
    runtimeLocale: 'en-US',
    timezone: 'America/Los_Angeles',
  }), {
    language: 'zh-Hans',
    source: 'local-agent-history',
    confidence: 'high',
  });

  assert.deepEqual(getReportLanguageDecision({
    env: { LC_ALL: 'ru_RU.UTF-8' },
    runtimeLocale: 'ru-RU',
    timezone: 'Asia/Tokyo',
  }), {
    language: 'ja',
    source: 'timezone',
    confidence: 'low',
  });

  assert.deepEqual(getReportLanguageDecision({
    env: { LC_ALL: 'ru_RU.UTF-8' },
    runtimeLocale: 'ru-RU',
    timezone: 'UTC',
  }), {
    language: 'en',
    source: 'fallback',
    confidence: 'low',
  });
});

test('resolves cross-OS locale signals without OS-specific shell probes', () => {
  assert.deepEqual(getReportLanguageDecision({
    env: {},
    runtimeLocale: 'zh-CN',
    timezone: 'America/Los_Angeles',
  }), {
    language: 'zh-Hans',
    source: 'system-locale',
    confidence: 'medium',
  });

  assert.deepEqual(getReportLanguageDecision({
    env: {},
    runtimeLocale: 'ja-JP',
    timezone: 'UTC',
  }), {
    language: 'ja',
    source: 'system-locale',
    confidence: 'medium',
  });

  assert.deepEqual(getReportLanguageDecision({
    env: { LC_ALL: 'fr_FR.UTF-8' },
    runtimeLocale: 'en-US',
    timezone: 'UTC',
  }), {
    language: 'fr',
    source: 'system-locale',
    confidence: 'medium',
  });

  assert.deepEqual(getReportLanguageDecision({
    env: { LANGUAGE: 'ru_RU:de_DE:en_US' },
    runtimeLocale: 'en-US',
    timezone: 'UTC',
  }), {
    language: 'de',
    source: 'system-locale',
    confidence: 'medium',
  });
});

test('infers user input language with recent Fibonacci weights and ignores machine text', () => {
  assert.deepEqual(inferReportLanguageFromUserMessages([
    { text: 'Please write this in English.', time: new Date('2026-05-06T10:00:00.000Z') },
    { text: '请按中文输出最终报告，保留产品名。', time: new Date('2026-05-06T12:00:00.000Z') },
  ]), {
    language: 'zh-Hans',
    confidence: 'high',
  });

  assert.equal(inferReportLanguageFromUserMessages([
    { text: 'npm test -- --reporter dot', time: new Date('2026-05-06T12:00:00.000Z') },
    { text: '{"language":"zh_CN","path":"C:\\\\repo\\\\workline"}', time: new Date('2026-05-06T11:00:00.000Z') },
    { text: 'C:\\Users\\Example\\project\\workline\\src\\locale.ts', time: new Date('2026-05-06T10:00:00.000Z') },
  ]), undefined);

  assert.deepEqual(inferReportLanguageFromUserMessages([
    { text: 'npm test 失败了，请继续用中文报告问题。', time: new Date('2026-05-06T12:00:00.000Z') },
  ]), {
    language: 'zh-Hans',
    confidence: 'high',
  });
});

test('returns stable human-readable report language names', () => {
  assert.equal(reportLanguageName('zh-Hans'), 'Simplified Chinese');
  assert.equal(reportLanguageName('zh-Hant'), 'Traditional Chinese');
  assert.equal(reportLanguageName('ja'), 'Japanese');
  assert.equal(reportLanguageName('ko'), 'Korean');
  assert.equal(reportLanguageName('fr'), 'French');
});
