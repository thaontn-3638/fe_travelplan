import { useId, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  MenuItem,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useTranslation } from 'react-i18next';
import type { Place } from '../../../types';
import type { PlaceInput } from '../api/placeApi';
import { CATEGORY_KEYS, resolvePlaceImages } from '../utils';
import { RegionPicker } from './RegionPicker';
import { MultiImageUpload } from './MultiImageUpload';

interface PlaceFormValues {
  title: string;
  address: string;
  region: string;
  images: string[];
  category: string;
  price: string;
  description: string;
  isPublic: boolean;
}

// Giá trị điền sẵn khi TẠO MỚI — ví dụ từ khoá vừa tìm không ra, vùng của
// chuyến đi đang lên lịch, loại đang lọc. Người dùng không phải gõ lại.
export interface PlaceFormPrefill {
  title?: string;
  region?: string;
  category?: string;
}

interface PlaceFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialPlace?: Place;
  prefill?: PlaceFormPrefill;
  currentUserId: string;
  submitError: string | null;
  onClose: () => void;
  onSubmit: (input: PlaceInput) => Promise<void>;
}

function toDefaultValues(place?: Place, prefill?: PlaceFormPrefill): PlaceFormValues {
  return {
    title: place?.title ?? prefill?.title ?? '',
    address: place?.address ?? '',
    region: place?.region ?? prefill?.region ?? '',
    images: place?.source === 'custom' ? resolvePlaceImages(place) : [],
    category: place?.category ?? prefill?.category ?? '',
    // typeof, not truthiness — price 0 is a real value, not blank.
    price: typeof place?.price === 'number' ? String(place.price) : '',
    description: place?.description ?? '',
    isPublic: place?.isPublic ?? false,
  };
}

export function PlaceFormModal({
  open,
  mode,
  initialPlace,
  prefill,
  currentUserId,
  submitError,
  onClose,
  onSubmit,
}: PlaceFormModalProps) {
  const { t } = useTranslation();
  const formId = useId();

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().trim().min(1, t('discover.form.titleRequired')),
        address: z.string().trim().min(1, t('discover.form.addressRequired')),
        region: z.string().trim().min(1, t('discover.form.regionRequired')),
        images: z.array(z.string()).min(1, t('discover.form.imagesRequired')),
        category: z.string().min(1, t('discover.form.categoryRequired')),
        price: z
          .string()
          .trim()
          .refine((value) => value === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0), {
            message: t('discover.form.priceInvalid'),
          }),
        description: z.string().trim(),
        isPublic: z.boolean(),
      }),
    [t],
  );

  // `values`, not `defaultValues` — keeps the form in sync if a different
  // place is opened for editing without unmounting the dialog.
  const formValues = useMemo(
    () => toDefaultValues(initialPlace, mode === 'create' ? prefill : undefined),
    [initialPlace, mode, prefill],
  );

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PlaceFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    values: formValues,
  });

  const submit = async (values: PlaceFormValues): Promise<void> => {
    const input: PlaceInput = {
      title: values.title.trim(),
      address: values.address.trim(),
      region: values.region.trim(),
      coverUrl: values.images[0],
      images: values.images,
      category: values.category,
      price: values.price?.trim() ? Number(values.price) : undefined,
      description: values.description?.trim() || undefined,
      isPublic: values.isPublic,
    };

    await onSubmit(input);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <div className="flex items-center justify-between p-4 pb-0">
        <h3 className="m-0 font-display text-lg font-bold text-ink">
          {mode === 'create' ? t('discover.form.createTitle') : t('discover.form.editTitle')}
        </h3>
        <IconButton onClick={onClose} size="small" aria-label={t('common.close') as string}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </div>

      <DialogContent>
        <form id={formId} onSubmit={handleSubmit(submit)} className="flex flex-col gap-4 pt-1" noValidate>
          <Controller
            name="title"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                required
                label={t('discover.form.titleLabel')}
                error={!!errors.title}
                helperText={errors.title?.message}
                fullWidth
              />
            )}
          />

          <Controller
            name="address"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                required
                label={t('discover.form.addressLabel')}
                error={!!errors.address}
                helperText={errors.address?.message}
                fullWidth
              />
            )}
          />

          <Controller
            name="region"
            control={control}
            render={({ field }) => (
              <RegionPicker
                value={field.value}
                onChange={field.onChange}
                currentUserId={currentUserId}
                error={!!errors.region}
                helperText={errors.region?.message}
              />
            )}
          />

          <Controller
            name="images"
            control={control}
            render={({ field }) => (
              <MultiImageUpload
                value={field.value}
                onChange={field.onChange}
                error={!!errors.images}
                helperText={errors.images?.message}
              />
            )}
          />

          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('discover.form.descriptionLabel')}
                placeholder={t('discover.form.descriptionPlaceholder') ?? ''}
                multiline
                minRows={3}
                fullWidth
              />
            )}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  required
                  label={t('discover.form.categoryLabel')}
                  error={!!errors.category}
                  helperText={errors.category?.message}
                  fullWidth
                >
                  {CATEGORY_KEYS.map((key) => (
                    <MenuItem key={key} value={key}>
                      {t(`discover.category.${key}`)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="price"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  label={t('discover.form.priceLabel')}
                  error={!!errors.price}
                  helperText={errors.price?.message}
                  fullWidth
                />
              )}
            />
          </div>

          <Controller
            name="isPublic"
            control={control}
            render={({ field }) => (
              <div>
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label={t('discover.form.publicLabel')}
                />
                <p className="m-0 mt-0.5 text-xs text-ink-soft">{t('discover.form.publicHelper')}</p>
              </div>
            )}
          />

          {submitError && <Alert severity="error">{submitError}</Alert>}
        </form>
      </DialogContent>

      {/* Nút nằm ngoài DialogContent nên luôn ghim ở chân modal; form dài
          thì chỉ phần thân cuộn. Nút submit gắn với form qua thuộc tính form. */}
      <DialogActions className="border-t border-line px-4 py-3">
        <Button variant="text" onClick={onClose} disabled={isSubmitting}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" form={formId} variant="contained" disabled={isSubmitting}>
          {mode === 'create' ? t('discover.form.submitCreate') : t('discover.form.submitEdit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
