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

export type ReportLanguageSource =
  | 'explicit'
  | 'local-agent-history'
  | 'system-locale'
  | 'timezone'
  | 'fallback';

export type ReportLanguageConfidence = 'high' | 'medium' | 'low';

export type ReportLanguageDecision = {
  language: ReportLanguage;
  source: ReportLanguageSource;
  confidence: ReportLanguageConfidence;
};

export type UserLanguageMessage = {
  text: string;
  time?: Date;
};

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

const supportedLanguages: readonly ReportLanguage[] = [
  'en',
  'zh-Hans',
  'zh-Hant',
  'ja',
  'ko',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'nl',
  'pl',
];

const fibonacciWeights = [34, 21, 13, 8, 5, 3, 2, 1];

// locale 环境变量可能包含编码、modifier 或 POSIX 分隔符；匹配语言和 script 前先归一化。
function normalizeLocaleTag(value: string): string {
  return value
    .split('.')[0]
    .split('@')[0]
    .replace(/_/g, '-')
    .trim()
    .toLowerCase();
}

function resolveSupportedReportLanguage(locale: string | undefined): ReportLanguage | undefined {
  if (!locale?.trim()) {
    return undefined;
  }
  const normalized = normalizeLocaleTag(locale);
  if ((supportedLanguages as readonly string[]).includes(normalized)) {
    return normalized as ReportLanguage;
  }
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

  return undefined;
}

function localeCandidates(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }
  return value
    .split(':')
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

function firstSupportedLocale(values: Array<string | undefined>): ReportLanguage | undefined {
  for (const value of values) {
    for (const candidate of localeCandidates(value)) {
      const language = resolveSupportedReportLanguage(candidate);
      if (language) {
        return language;
      }
    }
  }
  return undefined;
}

// 只解析已经有固定报告文案的语言；未支持 locale 回退英文，避免生成混合语言外壳。
export function resolveReportLanguage(locale: string | undefined): ReportLanguage {
  const language = firstSupportedLocale([locale]);
  if (language) {
    return language;
  }
  return 'en';
}

export function parseReportLanguageOverride(value: string | undefined): ReportLanguage | undefined {
  if (!value) {
    return undefined;
  }
  return resolveSupportedReportLanguage(value);
}

function timezoneLanguage(timezone: string | undefined): ReportLanguage | undefined {
  if (!timezone) {
    return undefined;
  }
  const normalized = timezone.toLowerCase();
  if (['asia/shanghai', 'asia/chongqing', 'asia/harbin', 'asia/urumqi'].includes(normalized)) {
    return 'zh-Hans';
  }
  if (['asia/taipei', 'asia/hong_kong', 'asia/macau'].includes(normalized)) {
    return 'zh-Hant';
  }
  if (normalized === 'asia/tokyo') {
    return 'ja';
  }
  if (normalized === 'asia/seoul') {
    return 'ko';
  }
  if (normalized === 'europe/madrid') {
    return 'es';
  }
  if (normalized === 'europe/paris') {
    return 'fr';
  }
  if (normalized === 'europe/berlin') {
    return 'de';
  }
  if (normalized === 'europe/rome') {
    return 'it';
  }
  if (normalized === 'europe/lisbon') {
    return 'pt';
  }
  if (normalized === 'europe/amsterdam') {
    return 'nl';
  }
  if (normalized === 'europe/warsaw') {
    return 'pl';
  }
  return undefined;
}

function looksMachineGenerated(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return true;
  }
  if (/^[a-z]:[\\/][^\s]+$/i.test(trimmed) || /^\/[^\s]+(?:\/[^\s]+)+$/.test(trimmed)) {
    return true;
  }
  const commandLike = /^(?:npm|pnpm|yarn|git|node|python|python3|mvn|cargo|rg|ls|cd|cat|grep|go|deno)\b/i.test(trimmed) ||
    /^Get-[A-Za-z]+\b/.test(trimmed);
  const hasNaturalLanguageCue = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(trimmed) ||
    /\b(please|failed|fails|can|could|why|how|help|explain|report|summary)\b/i.test(trimmed);
  if (commandLike && !hasNaturalLanguageCue) {
    return true;
  }
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function detectUserMessageLanguage(text: string): ReportLanguage | undefined {
  if (looksMachineGenerated(text)) {
    return undefined;
  }
  if (/[\u3040-\u30ff]/.test(text)) {
    return 'ja';
  }
  if (/[\uac00-\ud7af]/.test(text)) {
    return 'ko';
  }
  if (/[\u4e00-\u9fff]/.test(text)) {
    return /[繁體週報語請後續會議專案]/.test(text) ? 'zh-Hant' : 'zh-Hans';
  }

  const lower = text.toLowerCase();
  if (/[a-z]/.test(lower) && /\b(the|and|please|report|summary|work|write|use|in|this|that)\b/.test(lower)) {
    return 'en';
  }
  if (/[a-z]/.test(lower) && /\b(le|la|les|des|rapport|semaine)\b/.test(lower)) {
    return 'fr';
  }
  if (/[a-z]/.test(lower) && /\b(el|la|los|las|informe|semana)\b/.test(lower)) {
    return 'es';
  }
  if (/[a-z]/.test(lower) && /\b(der|die|das|bericht|woche)\b/.test(lower)) {
    return 'de';
  }
  return undefined;
}

export function inferReportLanguageFromUserMessages(
  messages: UserLanguageMessage[],
): { language: ReportLanguage; confidence: ReportLanguageConfidence } | undefined {
  const ordered = [...messages]
    .sort((left, right) => (right.time?.getTime() ?? 0) - (left.time?.getTime() ?? 0));
  const scores = new Map<ReportLanguage, number>();
  let weightIndex = 0;

  for (const message of ordered) {
    if (weightIndex >= fibonacciWeights.length) {
      break;
    }
    const language = detectUserMessageLanguage(message.text);
    if (!language) {
      continue;
    }
    scores.set(language, (scores.get(language) ?? 0) + fibonacciWeights[weightIndex]);
    weightIndex += 1;
  }

  const ranked = [...scores.entries()].sort((left, right) => right[1] - left[1]);
  const [winner, second] = ranked;
  if (!winner || winner[1] < 8) {
    return undefined;
  }
  const runnerUpScore = second?.[1] ?? 0;
  if (winner[1] - runnerUpScore < Math.max(3, runnerUpScore * 0.25)) {
    return undefined;
  }
  return {
    language: winner[0],
    confidence: winner[1] >= 21 ? 'high' : 'medium',
  };
}

export function getReportLanguageDecision(options: {
  explicitLanguage?: string;
  userMessages?: UserLanguageMessage[];
  env?: EnvLike;
  runtimeLocale?: string;
  timezone?: string;
} = {}): ReportLanguageDecision {
  const explicitLanguage = parseReportLanguageOverride(options.explicitLanguage);
  if (explicitLanguage) {
    return { language: explicitLanguage, source: 'explicit', confidence: 'high' };
  }

  const inferred = inferReportLanguageFromUserMessages(options.userMessages ?? []);
  if (inferred) {
    return { language: inferred.language, source: 'local-agent-history', confidence: inferred.confidence };
  }

  const env = options.env ?? process.env;
  const runtimeLocale = options.runtimeLocale ?? Intl.DateTimeFormat().resolvedOptions().locale;
  const systemLanguage = firstSupportedLocale([env.LC_ALL, env.LC_MESSAGES, env.LANG, env.LANGUAGE, runtimeLocale]);
  if (systemLanguage) {
    return { language: systemLanguage, source: 'system-locale', confidence: 'medium' };
  }

  const timezoneLanguageHint = timezoneLanguage(options.timezone);
  if (timezoneLanguageHint) {
    return { language: timezoneLanguageHint, source: 'timezone', confidence: 'low' };
  }

  return { language: 'en', source: 'fallback', confidence: 'low' };
}

export function getDefaultReportLanguage(
  env: EnvLike = process.env,
  runtimeLocale = Intl.DateTimeFormat().resolvedOptions().locale,
): ReportLanguage {
  return getReportLanguageDecision({ env, runtimeLocale }).language;
}

export function reportLanguageName(language: ReportLanguage): string {
  return languageNames[language];
}
