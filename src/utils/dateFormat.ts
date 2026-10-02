import { format, parseISO } from 'date-fns';
import i18n from '../i18n';

// Một quy ước ghi ngày duy nhất cho toàn bộ app:
//   en, vi → "Th 3, 20/09/2026"
//   ja     → "火, 2026/09/20"
// Khoảng ngày bỏ thứ ở hai đầu (hai thứ trong một chuỗi là nhiễu), chỉ giữ
// đúng thứ tự ngày/tháng/năm của từng ngôn ngữ.
const JA_PATTERN = 'yyyy/MM/dd';
const DEFAULT_PATTERN = 'dd/MM/yyyy';

function patternFor(language: string): string {
  return language.split('-')[0] === 'ja' ? JA_PATTERN : DEFAULT_PATTERN;
}

function currentLanguage(): string {
  return i18n.language || 'en';
}

function weekdayLabel(date: Date): string {
  const labels = i18n.t('common.weekdaysShort', { returnObjects: true }) as string[];
  return labels[date.getDay()] ?? '';
}

/** "20/09/2026" — không kèm thứ. Dùng cho khoảng ngày và chỗ hẹp. */
export function formatDate(isoDate: string): string {
  return format(parseISO(isoDate), patternFor(currentLanguage()));
}

/** "Th 3, 20/09/2026" — dạng đầy đủ, dùng ở mọi chỗ hiển thị một ngày cụ thể. */
export function formatDateWithWeekday(isoDate: string): string {
  const date = parseISO(isoDate);
  return `${weekdayLabel(date)}, ${format(date, patternFor(currentLanguage()))}`;
}

/** `endDate` null hoặc trùng `startDate` ⇒ trip 1 ngày, chỉ in một ngày. */
export function formatDateRange(startDate: string, endDate: string | null): string {
  if (!endDate || endDate === startDate) {
    return formatDateWithWeekday(startDate);
  }
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

/**
 * Ngày hôm nay dạng "yyyy-MM-dd" theo GIỜ MÁY của người dùng.
 *
 * KHÔNG dùng `new Date().toISOString().slice(0, 10)`: đó là ngày theo UTC, ở
 * Nhật (UTC+9) trước 9h sáng sẽ ra ngày hôm qua.
 */
export function todayISO(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd');
}
