import { CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';

// Thay cho `return null` khi đang tải: trang trắng trên mạng chậm trông như lỗi.
export function PageLoading() {
  const { t } = useTranslation();

  return (
    <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center">
      <CircularProgress size={28} aria-label={t('common.loading')} />
    </div>
  );
}
