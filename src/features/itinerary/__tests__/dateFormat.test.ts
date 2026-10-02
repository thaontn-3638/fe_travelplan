import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../../i18n';
import { formatDate, formatDateRange, formatDateWithWeekday } from '../../../utils/dateFormat';

// 2026-09-20 là Chủ nhật, 2026-09-22 là thứ Ba.
const SUNDAY = '2026-09-20';
const TUESDAY = '2026-09-22';

async function setLanguage(language: string): Promise<void> {
  await i18n.changeLanguage(language);
}

describe('quy ước ghi ngày dùng chung', () => {
  beforeEach(async () => {
    await setLanguage('en');
  });

  it('en và vi dùng DD/MM/YYYY', async () => {
    await setLanguage('en');
    expect(formatDate(SUNDAY)).toBe('20/09/2026');

    await setLanguage('vi');
    expect(formatDate(SUNDAY)).toBe('20/09/2026');
  });

  it('ja dùng YYYY/MM/DD', async () => {
    await setLanguage('ja');
    expect(formatDate(SUNDAY)).toBe('2026/09/20');
  });

  it('dạng đầy đủ có thứ đứng trước, theo ngôn ngữ', async () => {
    await setLanguage('en');
    expect(formatDateWithWeekday(SUNDAY)).toBe('Sun, 20/09/2026');

    await setLanguage('vi');
    expect(formatDateWithWeekday(SUNDAY)).toBe('CN, 20/09/2026');

    await setLanguage('ja');
    expect(formatDateWithWeekday(SUNDAY)).toBe('日, 2026/09/20');
  });

  it('trip 1 ngày in một ngày kèm thứ; endDate trùng startDate cũng vậy', async () => {
    await setLanguage('en');
    expect(formatDateRange(SUNDAY, null)).toBe('Sun, 20/09/2026');
    expect(formatDateRange(SUNDAY, SUNDAY)).toBe('Sun, 20/09/2026');
  });

  it('khoảng ngày bỏ thứ, giữ đúng thứ tự của từng ngôn ngữ', async () => {
    await setLanguage('vi');
    expect(formatDateRange(SUNDAY, TUESDAY)).toBe('20/09/2026 – 22/09/2026');

    await setLanguage('ja');
    expect(formatDateRange(SUNDAY, TUESDAY)).toBe('2026/09/20 – 2026/09/22');
  });
});
