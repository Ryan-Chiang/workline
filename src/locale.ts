export type ReportLanguage =
  | 'en'
  | 'zh-Hans'
  | 'zh-Hant'
  | 'ja'
  | 'ko'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pt'
  | 'nl'
  | 'pl';

type EnvLike = Record<string, string | undefined>;

// 语言名称靠近 locale 解析逻辑维护，agent-context 可输出稳定可读名称，同时不翻译原始事实。
const languageNames: Record<ReportLanguage, string> = {
  en: 'English',
  'zh-Hans': 'Simplified Chinese',
  'zh-Hant': 'Traditional Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  pl: 'Polish',
};

// locale 环境变量可能包含编码、modifier 或 POSIX 分隔符；匹配语言和 script 前先归一化。
function normalizeLocaleTag(value: string): string {
  return value
    .split(':')[0]
    .split('.')[0]
    .split('@')[0]
    .replace(/_/g, '-')
    .trim()
    .toLowerCase();
}

// 只解析已经有固定报告文案的语言；未支持 locale 回退英文，避免生成混合语言外壳。
export function resolveReportLanguage(locale: string | undefined): ReportLanguage {
  if (!locale) {
    return 'en';
  }

  const normalized = normalizeLocaleTag(locale);
  const parts = normalized.split('-').filter(Boolean);
  const language = parts[0];

  if (language === 'zh') {
    if (parts.includes('hant') || parts.some((part) => ['tw', 'hk', 'mo'].includes(part))) {
      return 'zh-Hant';
    }
    return 'zh-Hans';
  }

  if (language === 'ja' || language === 'ko' || language === 'en' ||
    language === 'es' || language === 'fr' || language === 'de' ||
    language === 'it' || language === 'pt' || language === 'nl' ||
    language === 'pl') {
    return language;
  }

  return 'en';
}

export function getDefaultReportLanguage(
  env: EnvLike = process.env,
  runtimeLocale = Intl.DateTimeFormat().resolvedOptions().locale,
): ReportLanguage {
  // 优先尊重进程显式 locale 变量，再回退到 Intl 报告的运行时 locale。
  for (const value of [env.LC_ALL, env.LC_MESSAGES, env.LANG, env.LANGUAGE, runtimeLocale]) {
    const language = resolveReportLanguage(value);
    if (language !== 'en' || value?.toLowerCase().startsWith('en')) {
      return language;
    }
  }
  return 'en';
}

export function reportLanguageName(language: ReportLanguage): string {
  return languageNames[language];
}
