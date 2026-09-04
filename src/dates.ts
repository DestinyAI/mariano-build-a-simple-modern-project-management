const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO yyyy-mm-dd for a Date, using local time (never UTC, so "today" is the user's today). */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Parses yyyy-mm-dd (or a longer ISO timestamp) into a local Date at midnight. Null when unparseable. */
export function parseISODate(value: string): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function isValidISODate(value: string): boolean {
  return parseISODate(value) !== null;
}

export function addDaysISO(value: string, days: number): string {
  const base = parseISODate(value) ?? new Date();
  base.setDate(base.getDate() + days);
  return toISODate(base);
}

export function addMonthsISO(value: string, months: number): string {
  const base = parseISODate(value) ?? new Date();
  const day = base.getDate();
  base.setDate(1);
  base.setMonth(base.getMonth() + months);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(day, lastDay));
  return toISODate(base);
}

/** "12 Mar 2026" — empty string when there is no date. */
export function formatDate(value: string): string {
  const date = parseISODate(value);
  if (!date) return '';
  return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

/** "12 Mar" — empty string when there is no date. */
export function formatShortDate(value: string): string {
  const date = parseISODate(value);
  if (!date) return '';
  return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
}

export function monthLabel(year: number, monthIndex: number): string {
  return `${MONTH_SHORT[monthIndex]} ${`${year}`.slice(2)}`;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/** Whole days until the date; negative when in the past. Null when there is no date. */
export function daysUntil(value: string): number | null {
  const date = parseISODate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return daysBetween(today, date);
}

export function isOverdue(dueDate: string): boolean {
  const diff = daysUntil(dueDate);
  return diff !== null && diff < 0;
}

export function dueLabel(dueDate: string): string {
  const diff = daysUntil(dueDate);
  if (diff === null) return '';
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff === -1) return '1 day overdue';
  if (diff < 0) return `${Math.abs(diff)} days overdue`;
  if (diff <= 14) return `Due in ${diff} days`;
  return `Due ${formatShortDate(dueDate)}`;
}

/** "just now" / "5m ago" / "3h ago" / "2d ago" / "12 Mar" */
export function relativeTime(isoTimestamp: string): string {
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return '';
  const diffSeconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSeconds < 45) return 'just now';
  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDate(isoTimestamp);
}

export interface MonthCell {
  year: number;
  monthIndex: number;
}

/** Inclusive list of months covering the range, oldest first. */
export function monthRange(start: Date, end: Date): MonthCell[] {
  const months: MonthCell[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  let guard = 0;
  while (cursor.getTime() <= last.getTime() && guard < 240) {
    months.push({ year: cursor.getFullYear(), monthIndex: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1);
    guard += 1;
  }
  return months;
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}
