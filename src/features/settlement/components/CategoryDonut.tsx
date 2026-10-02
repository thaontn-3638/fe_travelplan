import { useTranslation } from 'react-i18next';
import { Tooltip } from '@mui/material';
import type { CostCategory, Currency } from '../../../types';
import { COST_CATEGORIES } from '../../../types';
import { COST_CATEGORY_HEX } from '../../budget/utils/budgetCategories';
import { formatPrecise } from '../../budget/utils/money';
import { palette } from '../../../theme/palette';

interface CategoryDonutProps {
  totals: Record<CostCategory, number>;
  currency: Currency;
  size?: number;
  // Nội dung đặt giữa vòng (tổng tiền...). Chỉ nên dùng từ cỡ ~96px trở lên.
  center?: React.ReactNode;
  // Vòng nét đứt, nhạt — dùng khi vẽ DỰ TRÙ thay vì chi thực tế.
  muted?: boolean;
}

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Khe hở 2px giữa hai lát bằng đúng màu nền: không có nó thì hai lát cạnh nhau
// dính thành một mảng màu duy nhất ở kích thước nhỏ.
const GAP_PX = 2;

// Tỉ trọng chi phí theo 5 loại — dữ liệu phần-trên-tổng, đúng thứ biểu đồ tròn
// làm tốt. Màu lấy từ bộ đã chạy qua validator mù màu, và luôn đi kèm nhãn chữ
// bên cạnh: 5 lát ở cỡ nhỏ thì màu một mình không đủ để nhận ra loại nào.
export function CategoryDonut({ totals, currency, size = 72, center, muted = false }: CategoryDonutProps) {
  const { t } = useTranslation();

  const slices = COST_CATEGORIES.map((category) => ({ category, amount: totals[category] })).filter(
    (slice) => slice.amount > 0,
  );
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0);

  if (total === 0) {
    return null;
  }

  let offset = 0;

  const svg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={slices
        .map(
          (slice) =>
            `${t(`itinerary.step4.category.${slice.category}`)} ${Math.round((slice.amount / total) * 100)}%`,
        )
        .join(', ')}
      className="flex-shrink-0"
    >
      <circle cx="32" cy="32" r={RADIUS} fill="none" stroke={palette.surface} strokeWidth="10" />

      {slices.map((slice) => {
        const length = (slice.amount / total) * CIRCUMFERENCE;
        // Chỉ một loại chi phí thì vẽ vòng liền — khe hở lúc đó không ngăn cách
        // gì cả, chỉ trông như một vết nứt.
        // Lát quá nhỏ thì trừ khe hở sẽ ra âm: giữ tối thiểu 1px để nó vẫn nhìn
        // thấy được thay vì biến mất hẳn.
        const drawn = slices.length === 1 ? CIRCUMFERENCE : Math.max(1, length - GAP_PX);
        const dash = `${drawn} ${CIRCUMFERENCE - drawn}`;
        const rotation = (offset / CIRCUMFERENCE) * 360 - 90;
        offset += length;

        return (
          <Tooltip
            key={slice.category}
            title={`${t(`itinerary.step4.category.${slice.category}`)} · ${formatPrecise(
              slice.amount,
              currency,
            )} · ${Math.round((slice.amount / total) * 100)}%`}
          >
            <circle
              cx="32"
              cy="32"
              r={RADIUS}
              fill="none"
              stroke={COST_CATEGORY_HEX[slice.category]}
              strokeWidth="10"
              strokeDasharray={dash}
              transform={`rotate(${rotation} 32 32)`}
              opacity={muted ? 0.45 : 1}
            />
          </Tooltip>
        );
      })}
    </svg>
  );

  if (!center) {
    return svg;
  }

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {svg}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {center}
      </div>
    </div>
  );
}

// Chú thích gán nhãn trực tiếp cho biểu đồ tròn: màu một mình không đủ để nhận
// ra loại nào ở 5 lát (dataviz — identity never color-alone).
export function CategoryLegend({
  totals,
  currency,
  limit,
}: {
  totals: Record<CostCategory, number>;
  currency: Currency;
  limit?: number;
}) {
  const { t } = useTranslation();
  const entries = COST_CATEGORIES.map((category) => ({ category, amount: totals[category] }))
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const shown = limit ? entries.slice(0, limit) : entries;
  const rest = entries.slice(shown.length).reduce((sum, entry) => sum + entry.amount, 0);

  if (total === 0) {
    return null;
  }

  return (
    // Lưới 4 cột tự co theo nội dung: tên loại không bị cắt thành "観..." chỉ
    // vì cột số tiền giữ cứng một bề rộng.
    <ul className="m-0 grid min-w-0 list-none grid-cols-[8px_minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1 p-0 text-[12px]">
      {shown.map(({ category, amount }) => (
        <li key={category} className="contents">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COST_CATEGORY_HEX[category] }} />
          <span className="truncate whitespace-nowrap text-ink">{t(`itinerary.step4.category.${category}`)}</span>
          <span className="text-right font-mono text-ink-soft">{Math.round((amount / total) * 100)}%</span>
          <span className="whitespace-nowrap text-right font-mono text-ink">{formatPrecise(amount, currency)}</span>
        </li>
      ))}
      {rest > 0 && (
        <li className="contents text-ink-soft">
          <span className="h-2 w-2 rounded-full bg-line" />
          <span className="truncate whitespace-nowrap">{t('settlement.hub.otherCategories')}</span>
          <span className="text-right font-mono">{Math.round((rest / total) * 100)}%</span>
          <span className="whitespace-nowrap text-right font-mono">{formatPrecise(rest, currency)}</span>
        </li>
      )}
    </ul>
  );
}
