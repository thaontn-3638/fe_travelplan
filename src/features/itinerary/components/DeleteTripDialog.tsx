import { useTranslation } from 'react-i18next';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

interface DeleteTripDialogProps {
  open: boolean;
  tripName: string;
  deleting: boolean;
  // Số khoản chi (kể cả giao dịch quyết toán) của trip. > 0 thì không cho xoá.
  expenseCount: number;
  onCancel: () => void;
  onConfirm: () => void;
  onOpenExpenses: () => void;
}

// R13 — xoá trip là thao tác không hoàn tác được, luôn hỏi lại.
// Trip đã có khoản chi thì không xoá được: dialog chỉ giải thích lý do và đưa
// đường sang sổ chi tiêu, không có nút xoá.
export function DeleteTripDialog({
  open,
  tripName,
  deleting,
  expenseCount,
  onCancel,
  onConfirm,
  onOpenExpenses,
}: DeleteTripDialogProps) {
  const { t } = useTranslation();
  const blocked = expenseCount > 0;

  if (blocked) {
    return (
      <Dialog open={open} onClose={onCancel}>
        <DialogTitle>{t('itinerary.detail.deleteBlockedTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('itinerary.detail.deleteBlockedBody', { name: tripName, count: expenseCount })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel}>{t('itinerary.detail.close')}</Button>
          <Button onClick={onOpenExpenses} variant="contained" disableElevation>
            {t('itinerary.detail.openExpenses')}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{t('itinerary.detail.deleteTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t('itinerary.detail.deleteBody', { name: tripName })}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={deleting}>
          {t('itinerary.detail.cancel')}
        </Button>
        <Button onClick={onConfirm} color="error" disabled={deleting}>
          {deleting ? t('itinerary.detail.deleting') : t('itinerary.detail.deleteConfirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
