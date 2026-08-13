import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Button, Checkbox, FormControlLabel, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/hooks/useAuth';
import { getErrorMessage } from '../utils/typeGuards';
import { AuthLayout } from '../features/auth/components/AuthLayout';
import { AuthHeader } from '../features/auth/components/AuthHeader';
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH } from '../features/auth/constants';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, sessionExpired, dismissSessionExpired } = useAuth();
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t('auth.emailRequired'))
          .max(EMAIL_MAX_LENGTH, t('auth.emailMaxLength', { max: EMAIL_MAX_LENGTH }))
          .pipe(z.email(t('auth.emailInvalid'))),
        password: z
          .string()
          .min(6, t('auth.passwordMinLength'))
          .max(PASSWORD_MAX_LENGTH, t('auth.passwordMaxLength', { max: PASSWORD_MAX_LENGTH })),
        rememberMe: z.boolean(),
      }),
    [t],
  );

  type LoginFormValues = z.infer<typeof loginSchema>;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  const onSubmit = async (values: LoginFormValues): Promise<void> => {
    setSubmitError(null);
    try {
      await login({ email: values.email, password: values.password }, values.rememberMe);
      navigate('/dashboard', { replace: true });
    } catch (error: unknown) {
      setSubmitError(getErrorMessage(error));
    }
  };

  return (
    <AuthLayout>
      <AuthHeader title={t('auth.welcomeBack')} subtitle={t('auth.loginSubtitle')} />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {sessionExpired && (
          <Alert severity="warning" onClose={dismissSessionExpired}>
            {t('auth.sessionExpired')}
          </Alert>
        )}

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
          name="password"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              required
              type="password"
              label={t('auth.password')}
              autoComplete="current-password"
              error={!!errors.password}
              helperText={errors.password?.message}
              fullWidth
            />
          )}
        />

        <Controller
          name="rememberMe"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={<Checkbox checked={field.value} onChange={field.onChange} />}
              label={t('auth.rememberMe')}
            />
          )}
        />

        {submitError && <Alert severity="error">{submitError}</Alert>}

        <Button type="submit" variant="contained" size="large" disabled={isSubmitting} fullWidth>
          {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
        </Button>

        <Button component={RouterLink} to="/register" variant="text" disabled={isSubmitting}>
          {t('auth.toggleToRegister')}
        </Button>
      </form>

      <Typography variant="caption" color="text.secondary" className="mt-6 block text-center">
        {t('auth.demoCredentials')}
      </Typography>
    </AuthLayout>
  );
}
