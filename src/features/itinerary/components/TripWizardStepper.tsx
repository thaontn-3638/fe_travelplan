import { useTranslation } from 'react-i18next';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { LOCKED_STEPS, WIZARD_STEPS, type WizardStep } from '../utils/wizardSteps';


interface TripWizardStepperProps {
  current: WizardStep;
  // Bước cao nhất được phép bấm vào. Chế độ tạo mới: chỉ Step 1.
  maxReachable: WizardStep;
  completed?: WizardStep[];
  onStepClick?: (step: WizardStep) => void;
}

export function TripWizardStepper({
  current,
  maxReachable,
  completed = [],
  onStepClick,
}: TripWizardStepperProps) {
  const { t } = useTranslation();

  return (
    <ol className="mx-auto mb-7 flex max-w-[760px] list-none flex-wrap items-center gap-1 p-0 sm:gap-2">
      {WIZARD_STEPS.map((step, index) => {
        const locked = LOCKED_STEPS.includes(step) || step > maxReachable;
        const active = step === current;
        const done = completed.includes(step) && !active;

        return (
          <li key={step} className="flex flex-1 items-center gap-1 sm:gap-2">
            <button
              type="button"
              disabled={locked || !onStepClick}
              onClick={() => onStepClick?.(step)}
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition sm:px-3 ${
                active
                  ? 'border-ocean bg-ocean-tint'
                  : done
                    ? 'border-mint bg-mint-tint'
                    : locked
                      ? 'cursor-not-allowed border-line bg-surface opacity-60'
                      : 'border-line bg-white hover:border-ocean-light'
              }`}
            >
              <span
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-display text-[12px] font-bold ${
                  active ? 'bg-ocean text-white' : done ? 'bg-mint text-white' : 'bg-line text-ink-soft'
                }`}
              >
                {done ? <CheckRoundedIcon sx={{ fontSize: 14 }} /> : step}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[12.5px] font-semibold ${
                    active ? 'text-ocean-dark' : done ? 'text-mint-dark' : 'text-ink'
                  }`}
                >
                  {t(`itinerary.wizard.step${step}`)}
                </span>
                {LOCKED_STEPS.includes(step) && (
                  <span className="block text-[10.5px] text-ink-soft">{t('itinerary.wizard.comingSoon')}</span>
                )}
              </span>
            </button>
            {index < WIZARD_STEPS.length - 1 && <span className="hidden h-px w-3 bg-line sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}
