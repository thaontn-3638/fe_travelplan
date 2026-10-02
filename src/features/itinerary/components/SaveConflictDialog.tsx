import { useTranslation } from 'react-i18next';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import type { TripSection } from '../utils/tripMerge';

interface SaveConflictDialogProps {
  open: boolean;
  sections: TripSection[];
  saving: boolean;
  onKeepMine: () => void;
  onTakeLatest: () => void;
  onCancel: () => void;
}

// R13 — chỉ hiện khi người khác đã sửa CÙNG phần với mình. Sửa phần khác
// nhau thì đã được gộp tự động, không hỏi gì.
export function SaveConflictDialog({ open, sections, saving, onKeepMine, onTakeLatest, onCancel }: SaveConflictDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={saving ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{t('itinerary.conflict.title')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 1.5 }}>{t('itinerary.conflict.body')}</DialogContentText>
        <ul className="m-0 mb-3 list-disc pl-5 text-[13.5px] font-semibold text-ink">
          {sections.map((section) => (
            <li key={section}>{t(`itinerary.conflict.section.${section}`)}</li>
          ))}
        </ul>
        <p className="m-0 text-[12.5px] text-ink-soft">{t('itinerary.conflict.hint')}</p>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={saving}>
          {t('itinerary.detail.cancel')}
        </Button>
        <Button variant="outlined" onClick={onTakeLatest} disabled={saving}>
          {t('itinerary.conflict.takeLatest')}
        </Button>
        <Button variant="contained" color="warning" onClick={onKeepMine} disabled={saving}>
          {t('itinerary.conflict.keepMine')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
