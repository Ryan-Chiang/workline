const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>();

// 本模块在 instant 和本地墙钟时间之间转换，因为 Node Date 没有内置 IANA 时区算术类型。
type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

// Intl formatter 构造成本较高，按 timezone 缓存；使用 en-CA 数字 parts 保持格式稳定。
function formatterFor(timezone: string): Intl.DateTimeFormat {
  const cached = dateTimeFormatCache.get(timezone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  dateTimeFormatCache.set(timezone, formatter);
  return formatter;
}

function getZonedParts(date: Date, timezone: string): ZonedParts {
  const parts = formatterFor(timezone).formatToParts(date);
  const value = (type: string) => {
    const part = parts.find((item) => item.type === type);
    if (!part) {
      throw new Error(`Unable to format ${type} in timezone ${timezone}`);
    }
    return Number(part.value);
  };

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

// 计算某个 instant 下的时区偏移；偏移可能随日期变化，不能为夏令时地区全局缓存。
function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const parts = getZonedParts(date, timezone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

// 将指定时区的本地墙钟时间转换为 instant；第二次偏移修正用于处理首次猜测跨过偏移变化的情况。
export function zonedDateTimeToInstant(parts: ZonedParts, timezone: string): Date {
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let instant = new Date(localAsUtc - getTimezoneOffsetMs(new Date(localAsUtc), timezone));
  instant = new Date(localAsUtc - getTimezoneOffsetMs(instant, timezone));
  return instant;
}

export function getDefaultTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

// 默认周窗口使用用户本地周一 00:00，而不是 UTC 周边界；报告阅读和命名都按用户时区发生。
export function getDefaultWeeklyWindow(timezone = getDefaultTimezone(), now = new Date()) {
  const nowParts = getZonedParts(now, timezone);
  const localDateAsUtc = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);
  const dayOfWeek = new Date(localDateAsUtc).getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(localDateAsUtc - daysSinceMonday * 24 * 60 * 60 * 1000);
  const since = zonedDateTimeToInstant({
    year: monday.getUTCFullYear(),
    month: monday.getUTCMonth() + 1,
    day: monday.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  }, timezone);

  return { since, until: now };
}

export function formatInTimezone(date: Date, timezone: string): string {
  const parts = getZonedParts(date, timezone);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

export function formatFilenameDate(date: Date, timezone: string): string {
  const parts = getZonedParts(date, timezone);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${parts.year}${pad(parts.month)}${pad(parts.day)}`;
}
