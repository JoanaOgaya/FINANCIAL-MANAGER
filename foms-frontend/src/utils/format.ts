/**
 * Display formatters — the only currency/date/aging/initials helpers in the app.
 * Values are formatted exactly as supplied; nothing is computed or defaulted here.
 */

const LOCALE = 'en-PH';
const CURRENCY = 'PHP';

export const NOT_AVAILABLE = 'N/A';

const isBlank = (v: unknown): v is null | undefined | '' => v === null || v === undefined || v === '';

export function formatCurrency(value: number | null | undefined): string {
  if (isBlank(value) || Number.isNaN(Number(value))) return NOT_AVAILABLE;
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2 }).format(Number(value));
}

export function formatNumber(value: number | null | undefined): string {
  if (isBlank(value) || Number.isNaN(Number(value))) return NOT_AVAILABLE;
  return new Intl.NumberFormat(LOCALE).format(Number(value));
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (isBlank(value) || Number.isNaN(Number(value))) return NOT_AVAILABLE;
  return `${Number(value).toFixed(fractionDigits)}%`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (isBlank(value)) return NOT_AVAILABLE;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return NOT_AVAILABLE;
  return d.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (isBlank(value)) return NOT_AVAILABLE;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return NOT_AVAILABLE;
  return d.toLocaleString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatRelative(value: string | Date | null | undefined): string {
  if (isBlank(value)) return NOT_AVAILABLE;
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return NOT_AVAILABLE;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Display text for a days-overdue figure supplied by the API (negative = days left). */
export function formatDaysOverdue(days: number | null | undefined): string {
  if (isBlank(days)) return NOT_AVAILABLE;
  if (days === 0) return 'Due today';
  return days > 0 ? `${days} day${days === 1 ? '' : 's'} overdue` : `${Math.abs(days)} day${days === -1 ? '' : 's'} left`;
}

/** Trend display: "N/A" when the API returns null. */
export function formatTrend(value: number | null | undefined): string {
  if (isBlank(value) || Number.isNaN(Number(value))) return NOT_AVAILABLE;
  const n = Number(value);
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export function getInitials(fullName: string | null | undefined): string {
  if (!fullName) return '';
  return fullName.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? '').split(/\s+/)[0] ?? '';
}
