import { useTranslation } from 'react-i18next';
import { CATEGORY_KEYS, type CategoryKey } from '../../places/utils';
import { CATEGORY_COLOR_CLASSES } from '../utils/categoryColors';

interface CategoryFilterChipsProps {
  value: CategoryKey | null;
  onChange: (category: CategoryKey | null) => void;
}

export function CategoryFilterChips({ value, onChange }: CategoryFilterChipsProps) {
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
        {t('discover.categoryAll')}
      </button>
      {CATEGORY_KEYS.map((category) => {
        const active = value === category;
        const colors = CATEGORY_COLOR_CLASSES[category];

        return (
          <button
            key={category}
            type="button"
            onClick={() => onChange(category)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
              active ? `${colors.border} ${colors.tint} ${colors.text}` : 'border-line bg-white text-ink-soft'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
            {t(`discover.category.${category}`)}
          </button>
        );
      })}
    </div>
  );
}
