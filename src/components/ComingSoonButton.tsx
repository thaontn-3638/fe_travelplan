import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ComingSoonButtonProps {
  children: ReactNode;
  className?: string;
}

/** A text/icon trigger for a not-yet-built feature — disabled, with a tooltip explaining why. */
export function ComingSoonButton({ children, className = '' }: ComingSoonButtonProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      disabled
      title={t('nav.comingSoon') as string}
      className={`cursor-not-allowed opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}
