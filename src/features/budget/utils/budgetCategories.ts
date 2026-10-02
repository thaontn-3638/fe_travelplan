import type { CostCategory } from '../../../types';
import { palette } from '../../../theme/palette';

// Màu của 5 loại chi phí.
//
// KHÔNG dùng thẳng bộ màu category của Discover: bộ đó trượt kiểm tra tương
// phản mù màu (ocean ↔ mint chỉ cách nhau ΔE 13,3 — dưới ngưỡng 15 nên cả
// người nhìn màu bình thường cũng khó phân biệt, và `idea` gần như không có
// sắc độ). Bộ dưới đây đã chạy qua validator của skill dataviz:
// CVD ΔE 9,2 (đạt), normal-vision ΔE 17,0 (đạt), tương phản nền ≥ 3:1 (đạt).
//
// Riêng `other` cố ý là màu xám: "Khác" là nhóm hứng phần đuôi, xám hoá nó là
// cách nói "nhóm này không mang thông tin riêng" chứ không phải lỗi màu.
export const COST_CATEGORY_HEX: Record<CostCategory, string> = {
  transport: palette.violetDark,
  lodging: palette.mintDark,
  food: palette.coralDark,
  sightseeing: palette.ocean,
  other: palette.ideaDark,
};

export const COST_CATEGORY_CLASSES: Record<
  CostCategory,
  { dot: string; text: string; tint: string; border: string }
> = {
  transport: { dot: 'bg-violet-dark', text: 'text-violet-dark', tint: 'bg-violet-tint', border: 'border-violet-dark' },
  lodging: { dot: 'bg-mint-dark', text: 'text-mint-dark', tint: 'bg-mint-tint', border: 'border-mint-dark' },
  food: { dot: 'bg-coral-dark', text: 'text-coral-dark', tint: 'bg-coral-tint', border: 'border-coral-dark' },
  sightseeing: { dot: 'bg-ocean', text: 'text-ocean-dark', tint: 'bg-ocean-tint', border: 'border-ocean' },
  other: { dot: 'bg-idea-dark', text: 'text-idea-dark', tint: 'bg-idea-tint', border: 'border-idea-dark' },
};
