import { describe, expect, it } from 'vitest';
import { CATEGORY_EVENT_COLORS } from '../utils/categoryColors';
import { CATEGORY_KEYS } from '../../places/utils';
import { palette } from '../../../theme/palette';

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

describe('màu block trên lưới giờ', () => {
  it('mỗi category có một bộ màu riêng', () => {
    const fills = CATEGORY_KEYS.map((key) => CATEGORY_EVENT_COLORS[key].fill);
    expect(new Set(fills).size).toBe(CATEGORY_KEYS.length);

    const borders = CATEGORY_KEYS.map((key) => CATEGORY_EVENT_COLORS[key].border);
    expect(new Set(borders).size).toBe(CATEGORY_KEYS.length);
  });

  it('nền pastel, chữ đủ tương phản để đọc (>= 4.5:1)', () => {
    for (const key of CATEGORY_KEYS) {
      const { fill, text } = CATEGORY_EVENT_COLORS[key];
      expect(relativeLuminance(fill)).toBeGreaterThan(0.6); // nền nhạt
      expect(contrastRatio(fill, text)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('lấy màu từ palette dùng chung, không hardcode', () => {
    expect(CATEGORY_EVENT_COLORS.attraction).toEqual({
      fill: palette.oceanTint,
      border: palette.ocean,
      text: palette.oceanDark,
    });
  });
});
