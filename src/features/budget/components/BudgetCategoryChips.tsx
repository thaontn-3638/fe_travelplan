import { useTranslation } from 'react-i18next';
import type { CostCategory, Currency } from '../../../types';
import { COST_CATEGORIES } from '../../../types';
import { COST_CATEGORY_CLASSES } from '../utils/budgetCategories';
import { formatMoney } from '../utils/money';

interface BudgetCategoryChipsProps {
  value: CostCategory | null;
  totals: Record<CostCategory, number>;
  grandTotal: number;
  currency: Currency;
  onChange: (category: CostCategory | null) => void;
}

// Chip vừa là bộ lọc vừa là bảng tổng của nhóm — một hàng, hai việc.
export function BudgetCategoryChips({
  value,
  totals,
  grandTotal,
  currency,
  onChange,
}: BudgetCategoryChipsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
          value === null ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-soft'
        }`}
      >
        {t('itinerary.step4.categoryAll')}
        <span className="ml-1.5 font-mono text-[11.5px] opacity-80">{formatMoney(grandTotal, currency)}</span>
      </button>

      {COST_CATEGORIES.map((category) => {
        const active = value === category;
        const colors = COST_CATEGORY_CLASSES[category];

        return (
          <button
            key={category}
            type="button"
            onClick={() => onChange(active ? null : category)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
              active ? `${colors.border} ${colors.tint} ${colors.text}` : 'border-line bg-white text-ink-soft'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
            {t(`itinerary.step4.category.${category}`)}
            <span className="font-mono text-[11.5px] opacity-80">{formatMoney(totals[category], currency)}</span>
          </button>
        );
      })}
    </div>
  );
}
