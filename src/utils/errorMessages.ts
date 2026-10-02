import i18n from '../i18n';
import { HttpError, NetworkError, ResponseShapeError } from '../features/places/api/httpClient';

// Câu thông báo cho người dùng, theo ngôn ngữ đang chọn. Lỗi kỹ thuật (mạng,
// HTTP, dữ liệu lạ) không bao giờ hiện nguyên văn tiếng Anh ra UI; chi tiết
// vẫn còn trong console. Lỗi nghiệp vụ đã có câu riêng (auth, place guard…)
// thì giữ nguyên.
export function userErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) return i18n.t('common.errors.network');
  if (error instanceof HttpError) {
    if (error.status === 404) return i18n.t('common.errors.notFound');
    if (error.status >= 500) return i18n.t('common.errors.server');
    return i18n.t('common.errors.generic');
  }
  if (error instanceof ResponseShapeError) return i18n.t('common.errors.generic');
  if (error instanceof TypeError) return i18n.t('common.errors.network'); // fetch() thô bị chặn / mất mạng
  return error instanceof Error && error.message ? error.message : i18n.t('common.errors.generic');
}
