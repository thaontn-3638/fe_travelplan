import { format, parseISO } from 'date-fns';

export function formatCurrencyJPY(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

export function formatTripDateRange(startDate: string, endDate: string): string {
  return `${format(parseISO(startDate), 'MM/dd')} – ${format(parseISO(endDate), 'MM/dd')}`;
}

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';

  return (first + last).toUpperCase();
}
