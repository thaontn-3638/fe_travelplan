import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Button, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/hooks/useAuth';
import { getErrorMessage } from '../utils/typeGuards';
import { AuthLayout } from '../features/auth/components/AuthLayout';
import { AuthHeader } from '../features/auth/components/AuthHeader';
import { EMAIL_MAX_LENGTH, FULL_NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH } from '../features/auth/constants';

const PHONE_PATTERN = /^\+?[0-9\s-]{9,15}$/;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerAccount } = useAuth();
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const registerSchema = useMemo(
    () =>
      z
        .object({
          fullName: z
            .string()
            .min(2, t('auth.fullNameRequired'))
            .max(FULL_NAME_MAX_LENGTH, t('auth.fullNameMaxLength', { max: FULL_NAME_MAX_LENGTH })),
          email: z
            .string()
            .min(1, t('auth.emailRequired'))
            .max(EMAIL_MAX_LENGTH, t('auth.emailMaxLength', { max: EMAIL_MAX_LENGTH }))
            .pipe(z.email(t('auth.emailInvalid'))),
          phoneNumber: z
            .string()
            .min(1, t('auth.phoneRequired'))
            .regex(PHONE_PATTERN, t('auth.phoneInvalid')),
          password: z
            .string()
            .min(6, t('auth.passwordMinLength'))
            .max(PASSWORD_MAX_LENGTH, t('auth.passwordMaxLength', { max: PASSWORD_MAX_LENGTH })),
          confirmPassword: z
            .string()
            .min(1, t('auth.confirmPasswordRequired'))
            .max(PASSWORD_MAX_LENGTH, t('auth.passwordMaxLength', { max: PASSWORD_MAX_LENGTH })),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t('auth.passwordMismatch'),
          path: ['confirmPassword'],
        }),
    [t],
  );

  type RegisterFormValues = z.infer<typeof registerSchema>;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: {
      fullName: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: RegisterFormValues): Promise<void> => {
    setSubmitError(null);
    try {
      await registerAccount({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        phoneNumber: values.phoneNumber,
      });
      navigate('/dashboard', { replace: true });
    } catch (error: unknown) {
      setSubmitError(getErrorMessage(error));
    }
  };

  return (
    <AuthLayout maxWidthClassName="max-w-2xl">
      <AuthHeader title={t('auth.createAccount')} subtitle={t('auth.registerSubtitle')} />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            name="fullName"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                required
                label={t('auth.fullName')}
                autoComplete="name"
                error={!!errors.fullName}
                helperText={errors.fullName?.message}
                fullWidth
              />
            )}
          />

          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                required
                type="email"
                label={t('auth.email')}
                autoComplete="email"
                error={!!errors.email}
                helperText={errors.email?.message}
                fullWidth
              />
            )}
          />

          <Controller
            name="phoneNumber"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                required
                type="tel"
                label={t('auth.phoneNumber')}
                autoComplete="tel"
                error={!!errors.phoneNumber}
                helperText={errors.phoneNumber?.message}
                fullWidth
              />
            )}
          />

          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                required
                type="password"
                label={t('auth.password')}
                autoComplete="new-password"
                error={!!errors.password}
                helperText={errors.password?.message}
                fullWidth
              />
            )}
          />

          <Controller
            name="confirmPassword"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                required
                type="password"
                label={t('auth.confirmPassword')}
                autoComplete="new-password"
                error={!!errors.confirmPassword}
                helperText={errors.confirmPassword?.message}
                className="sm:col-span-2"
                fullWidth
              />
            )}
          />
        </div>

        {submitError && <Alert severity="error">{submitError}</Alert>}

        <Button type="submit" variant="contained" size="large" disabled={isSubmitting} fullWidth>
          {isSubmitting ? t('auth.creatingAccount') : t('auth.createAccountAction')}
        </Button>

        <Button component={RouterLink} to="/login" variant="text" disabled={isSubmitting}>
          {t('auth.toggleToLogin')}
        </Button>
      </form>
    </AuthLayout>
  );
}
