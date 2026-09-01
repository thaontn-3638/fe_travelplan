import { Button } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useTranslation } from 'react-i18next';

interface SearchEmptyStateProps {
  query: string;
  onAddPlace: () => void;
}

export function SearchEmptyState({ query, onAddPlace }: SearchEmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-white px-6 py-16 text-center">
      <h3 className="m-0 font-display text-lg font-bold text-ink">{t('discover.noResultsTitle')}</h3>
      <p className="m-0 max-w-sm text-sm text-ink-soft">{t('discover.noResultsSubtitle', { query })}</p>
      <Button variant="contained" color="secondary" startIcon={<AddRoundedIcon />} onClick={onAddPlace}>
        {t('discover.addPlaceButton')}
      </Button>
    </div>
  );
}
