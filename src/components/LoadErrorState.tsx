import { useTranslation } from 'react-i18next';

interface LoadErrorStateProps {
  onRetry: () => void;
  title?: string;
  body?: string;
}

// Tải dữ liệu thất bại ≠ không có dữ liệu. Dùng chung cho các màn danh sách để
// người dùng không tưởng nhầm là mình "chưa có trip nào".
export function LoadErrorState({ onRetry, title, body }: LoadErrorStateProps) {
  const { t } = useTranslation();

  return (
    <div role="alert" className="mx-auto max-w-[520px] rounded-2xl border border-dashed border-coral/60 bg-white px-6 py-12 text-center">
      <h2 className="m-0 mb-2 font-display text-lg font-bold text-ink">{title ?? t('common.loadErrorTitle')}</h2>
      <p className="m-0 text-sm text-ink-soft">{body ?? t('common.loadErrorBody')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-xl bg-ocean px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ocean-dark"
      >
        {t('common.retry')}
      </button>
    </div>
  );
}
