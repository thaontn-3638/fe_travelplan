import { useTranslation } from 'react-i18next';

export function EmptyTripsState() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-white px-6 py-16 text-center">
      <h3 className="m-0 font-display text-lg font-bold text-ink">{t('dashboard.noTrips')}</h3>
      <p className="m-0 max-w-sm text-sm text-ink-soft">{t('dashboard.noTripsDescription')}</p>
    </div>
  );
}
