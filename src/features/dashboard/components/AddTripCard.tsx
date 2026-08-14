import { useTranslation } from 'react-i18next';

export function AddTripCard() {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      disabled
      title={t('nav.comingSoon')}
      className="flex min-h-[212px] flex-col items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-line text-ink-soft transition disabled:cursor-not-allowed disabled:opacity-70 hover:border-ocean hover:text-ocean-dark disabled:hover:border-line disabled:hover:text-ink-soft"
    >
      <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full border-[1.5px] border-current text-lg">
        +
      </span>
      <span className="text-[13.5px] font-semibold">{t('dashboard.trip.addNew')}</span>
    </button>
  );
}
