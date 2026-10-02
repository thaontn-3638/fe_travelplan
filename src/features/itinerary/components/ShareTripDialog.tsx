import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Switch,
  TextField,
  Tooltip,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import type { ShareScope, Trip } from '../../../types';
import { shareScopeOf, type ShareAction } from '../api/tripApi';

interface ShareTripDialogProps {
  open: boolean;
  trip: Trip;
  // Chỉ chủ trip bật/tắt hay tạo lại link; thành viên khác chỉ xem/sao chép.
  canManage: boolean;
  onClose: () => void;
  onChange: (action: ShareAction) => Promise<void>;
}

export function shareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`;
}

// 共有 — link công khai, chỉ đọc, hai mức bật riêng (trip-share.md §2):
//   mức 1 `plan`   — lịch trình + dự trù, KHÔNG có tên thành viên
//   mức 2 `actual` — chi tiêu thực tế + quyết toán, CÓ tên thành viên
// Một link duy nhất; mức nào tắt thì phần đó biến mất khỏi trang.
export function ShareTripDialog({ open, trip, canManage, onClose, onChange }: ShareTripDialogProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const scope = shareScopeOf(trip);
  const enabled = scope.plan || scope.actual;
  const url = trip.shareToken && enabled ? shareUrl(trip.shareToken) : '';

  async function run(action: ShareAction): Promise<void> {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      await onChange(action);
    } catch {
      setError(t('itinerary.share.error'));
    } finally {
      setBusy(false);
    }
  }

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Trình duyệt chặn clipboard (http, iframe…): người dùng vẫn chọn tay được.
      setCopied(false);
    }
  }

  const levels: { key: keyof ShareScope; icon: React.ReactNode }[] = [
    { key: 'plan', icon: <EventNoteRoundedIcon sx={{ fontSize: 18 }} /> },
    { key: 'actual', icon: <PaidRoundedIcon sx={{ fontSize: 18 }} /> },
  ];

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('itinerary.share.title')}</DialogTitle>
      <DialogContent>
        <p className="m-0 mb-4 text-[13px] text-ink-soft">{t('itinerary.share.description')}</p>

        <div className="mb-4 flex flex-col gap-2">
          {levels.map(({ key, icon }) => {
            const on = scope[key];
            return (
              <Tooltip key={key} title={canManage ? '' : t('itinerary.share.ownerOnly')} placement="top-start">
                <label
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                    on ? 'border-ocean bg-ocean-tint/50' : 'border-line bg-white'
                  } ${canManage ? 'cursor-pointer' : ''}`}
                >
                  <span className={`mt-1 ${on ? 'text-ocean-dark' : 'text-ink-soft'}`}>{icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold text-ink">
                      {t(`itinerary.share.level.${key}.title`)}
                    </span>
                    <span className="block text-[12px] text-ink-soft">{t(`itinerary.share.level.${key}.body`)}</span>
                    {key === 'actual' && (
                      <span className="mt-0.5 block text-[11.5px] font-semibold text-amber-dark">
                        {t('itinerary.share.level.actual.warning')}
                      </span>
                    )}
                  </span>
                  <Switch
                    checked={on}
                    disabled={busy || !canManage}
                    onChange={(event) => void run({ scope: { [key]: event.target.checked } })}
                    slotProps={{ input: { 'aria-label': t(`itinerary.share.level.${key}.title`) } }}
                  />
                </label>
              </Tooltip>
            );
          })}
        </div>

        <p className="m-0 mb-2 text-[12.5px] font-semibold text-ink">
          {enabled ? t('itinerary.share.enabled') : t('itinerary.share.disabled')}
        </p>

        {enabled && (
          <div>
            <div className="flex items-center gap-2">
              <TextField
                value={url}
                size="small"
                fullWidth
                slotProps={{ htmlInput: { readOnly: true, 'aria-label': t('itinerary.share.linkLabel') } }}
                onFocus={(event) => event.target.select()}
              />
              <Tooltip title={copied ? t('itinerary.share.copied') : t('itinerary.share.copy')}>
                <IconButton aria-label={t('itinerary.share.copy')} onClick={() => void copy()}>
                  <ContentCopyRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('itinerary.share.preview')}>
                <IconButton
                  aria-label={t('itinerary.share.preview')}
                  component="a"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <OpenInNewRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </div>
            {copied && (
              <p role="status" className="m-0 mt-1 text-[12px] font-semibold text-mint-dark">
                ✓ {t('itinerary.share.copied')}
              </p>
            )}
            {canManage && (
              <Button size="small" sx={{ mt: 1.5 }} disabled={busy} onClick={() => void run('regenerate')}>
                {t('itinerary.share.regenerate')}
              </Button>
            )}
            {canManage && <p className="m-0 text-[11.5px] text-ink-soft">{t('itinerary.share.regenerateHint')}</p>}
          </div>
        )}

        {!canManage && <p className="m-0 mt-3 text-[12px] text-ink-soft">{t('itinerary.share.ownerOnly')}</p>}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
