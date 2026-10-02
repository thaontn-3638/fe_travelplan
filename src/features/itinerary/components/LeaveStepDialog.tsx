import { useTranslation } from 'react-i18next';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

interface LeaveStepDialogProps {
  open: boolean;
  saving: boolean;
  canSave: boolean;
  onStay: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

// Rời bước khi còn thay đổi chưa lưu (Huỷ / reload / bấm icon bước khác):
// hỏi một lần với ba lựa chọn rõ ràng thay vì chỉ "rời / ở lại" (R10).
export function LeaveStepDialog({
  open,
  saving,
  canSave,
  onStay,
  onDiscard,
  onSave,
}: LeaveStepDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onStay}>
      <DialogTitle>{t('itinerary.wizard.leaveTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {canSave ? t('itinerary.wizard.leaveBody') : t('itinerary.wizard.leaveBodyInvalid')}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onStay} disabled={saving}>
          {t('itinerary.wizard.leaveStay')}
        </Button>
        <Button onClick={onDiscard} color="error" disabled={saving}>
          {t('itinerary.wizard.leaveDiscard')}
        </Button>
        <Button onClick={onSave} variant="contained" disabled={saving || !canSave}>
          {saving ? t('itinerary.detail.saving') : t('itinerary.wizard.leaveSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
