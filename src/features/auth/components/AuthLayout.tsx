import type { ReactNode } from 'react';
import { Paper } from '@mui/material';
import { LanguageSwitcher } from '../../../components/LanguageSwitcher';

interface AuthLayoutProps {
  children: ReactNode;
  maxWidthClassName?: string;
}

export function AuthLayout({ children, maxWidthClassName = 'max-w-sm' }: AuthLayoutProps) {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F8FAFC 45%, #E0F2FE 100%)' }}
    >
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>

      <Paper elevation={0} className={`w-full border border-slate-200 p-8 sm:p-10 ${maxWidthClassName}`}>
        {children}
      </Paper>
    </div>
  );
}
