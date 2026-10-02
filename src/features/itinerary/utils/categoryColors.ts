import type { CategoryKey } from '../../places/utils';
import { palette } from '../../../theme/palette';
import type { ItineraryItem, Place } from '../../../types';

// One hue family per category, reusing existing palette pairs (base for the
// dot/border, tint for the active chip background) — see palette.ts.
export const CATEGORY_COLOR_CLASSES: Record<CategoryKey, { dot: string; text: string; tint: string; border: string }> = {
  attraction: { dot: 'bg-ocean', text: 'text-ocean-dark', tint: 'bg-ocean-tint', border: 'border-ocean' },
  restaurant: { dot: 'bg-coral', text: 'text-coral-dark', tint: 'bg-coral-tint', border: 'border-coral' },
  hotel: { dot: 'bg-mint', text: 'text-mint-dark', tint: 'bg-mint-tint', border: 'border-mint' },
  shopping: { dot: 'bg-violet', text: 'text-violet-dark', tint: 'bg-violet-tint', border: 'border-violet' },
  other: { dot: 'bg-idea', text: 'text-idea-dark', tint: 'bg-idea-tint', border: 'border-idea' },
};

// No duration field on Place — a reasonable suggested-visit-length per
// category, shown in the place detail pane's "Thời gian nên dành" box.
const SUGGESTED_DURATION_MINUTES: Record<CategoryKey, number> = {
  attraction: 120,
  restaurant: 90,
  hotel: 0,
  shopping: 90,
  other: 60,
};

export function suggestedDurationMinutes(category?: string): number | null {
  const key = category as CategoryKey;
  const minutes = key in SUGGESTED_DURATION_MINUTES ? SUGGESTED_DURATION_MINUTES[key] : null;
  return minutes || null;
}

// Màu block trên lưới giờ của Bước 3: nền pastel (tint), viền đậm (base),
// chữ đậm hơn nữa để tương phản đủ trên nền nhạt. `coralDeep`/`mintDeep` tồn
// tại riêng vì `coralDark`/`mintDark` chỉ đạt ~3.6:1 trên nền tint tương ứng —
// dưới ngưỡng WCAG AA; test categoryColors.test.ts khoá lại ngưỡng 4.5:1. Lấy thẳng từ
// palette.ts nên không lệch với màu chip/chấm ở các màn khác.
export interface EventColor {
  fill: string;
  border: string;
  text: string;
}

export const CATEGORY_EVENT_COLORS: Record<CategoryKey, EventColor> = {
  attraction: { fill: palette.oceanTint, border: palette.ocean, text: palette.oceanDark },
  restaurant: { fill: palette.coralTint, border: palette.coral, text: palette.coralDeep },
  hotel: { fill: palette.mintTint, border: palette.mint, text: palette.mintDeep },
  shopping: { fill: palette.violetTint, border: palette.violet, text: palette.violetDark },
  other: { fill: palette.ideaTint, border: palette.idea, text: palette.ideaDark },
};

// Category hiệu lực của một item: place lấy từ Place, hoạt động tự do lấy từ
// chính nó (mặc định 'other'). Dùng chung cho màu sắc và bộ lọc.
export function itemCategory(item: ItineraryItem, placesById: Map<string, Place>): CategoryKey {
  const raw =
    item.kind === 'activity' ? item.category : placesById.get(item.placeId ?? '')?.category;

  return raw && raw in CATEGORY_EVENT_COLORS ? (raw as CategoryKey) : 'other';
}
