import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Tooltip } from '@mui/material';
import type { Currency, Trip } from '../../../types';
import { CURRENCIES, formatMoney, formatPerHead, losesPrecision, rescaleAmount } from '../utils/money';
import { MoneyInput } from './MoneyInput';
import {
  budgetBasisOf,
  budgetTotal,
  countRoundedByRescale,
  headcount,
  planPerHead,
  planTotal,
  rescalePlan,
  switchBudgetBasis,
  type BudgetBasis,
} from '../utils/budgetRules';

interface BudgetTotalsBarProps {
  trip: Trip;
  // Đã có chi tiêu thực tế thì khoá đổi đơn vị tiền: lịch sử đã ghi theo đơn vị
  // cũ, đổi là làm sai dữ liệu quá khứ (B5). Đợt 8 nối vào sổ chi tiêu thật.
  hasExpenses?: boolean;
  onChange: (patch: Partial<Trip>) => void;
}

export function BudgetTotalsBar({ trip, hasExpenses = false, onChange }: BudgetTotalsBarProps) {
  const { t } = useTranslation();
  const [pendingCurrency, setPendingCurrency] = useState<Currency | null>(null);

  const total = planTotal(trip.budgetPlan, trip.party);
  const perHead = planPerHead(trip.budgetPlan, trip.party);
  const showChildren = trip.party.children > 0;

  // Hai cách đặt hạn mức: cho cả chuyến (đi gia đình, gộp một túi tiền) hoặc
  // mỗi người (đi bạn bè, ai lo phần nấy). Lưu đúng con số user gõ, con số còn
  // lại là dẫn xuất — chia rồi nhân lại sẽ sinh sai số.
  const basis = budgetBasisOf(trip);
  const people = headcount(trip.party);
  const cap = budgetTotal(trip);
  const capSet = cap !== null;

  const ratio = cap && cap > 0 ? total / cap : null;
  // `cap === 0` là trạng thái vừa bấm "Đặt hạn mức", chưa gõ số. Coi đó là vượt
  // hạn mức thì user bị chữ đỏ dí ngay trước khi kịp nhập gì.
  const over = cap !== null && cap > 0 && total > cap;
  const barColor = ratio === null ? 'bg-line' : ratio > 1 ? 'bg-coral' : ratio > 0.8 ? 'bg-amber' : 'bg-mint';

  // B7 — `party` khớp `travelers` đã được chặn ngay ở Bước 1 (validateBasics),
  // nên bước này không còn cảnh báo lệch số nữa.

  return (
    <div className="sticky top-0 z-10 mb-5 rounded-2xl border border-line bg-white/95 p-4 backdrop-blur">
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-soft">
          {t('itinerary.step4.currencyLabel')}
          <Tooltip title={hasExpenses ? t('itinerary.step4.currencyLocked') : ''}>
            <span>
              <select
                value={trip.currency}
                disabled={hasExpenses}
                onChange={(event) => setPendingCurrency(event.target.value as Currency)}
                className="rounded-lg border border-line bg-white px-2 py-1.5 text-[12.5px] font-semibold text-ink outline-none focus:border-ocean disabled:text-ink-soft"
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {t(`itinerary.step4.currency.${currency}`)}
                  </option>
                ))}
              </select>
            </span>
          </Tooltip>
        </label>

        {capSet && (
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-ink-soft">
            {t('itinerary.step4.budgetLabel')}

            <span className="inline-flex rounded-lg border border-line bg-white p-0.5">
              {(['total', 'perPerson'] as BudgetBasis[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange(switchBudgetBasis(trip, key))}
                  className={`rounded-md px-2 py-1 text-[12px] font-semibold transition ${
                    basis === key ? 'bg-ocean-tint text-ocean-dark' : 'text-ink-soft'
                  }`}
                >
                  {t(`itinerary.step4.basis.${key}`)}
                </button>
              ))}
            </span>

            <span className="w-32">
              <MoneyInput
                value={(basis === 'perPerson' ? trip.budgetPerPerson : trip.budget) ?? undefined}
                currency={trip.currency}
                ariaLabel={t('itinerary.step4.budgetLabel')}
                onChange={(value) =>
                  onChange(
                    basis === 'perPerson'
                      ? { budgetPerPerson: value ?? 0, budget: null }
                      : { budget: value ?? 0, budgetPerPerson: null },
                  )
                }
              />
            </span>

            {/* Nhân ra tổng ngay tại chỗ: đặt ¥50.000/người cho 5 người thì con
                số phải so sánh là ¥250.000, đừng bắt user tự nhẩm. */}
            {basis === 'perPerson' && (
              <span className="font-normal text-ink-soft">
                {t('itinerary.step4.basisMath', {
                  people,
                  total: formatMoney(cap ?? 0, trip.currency),
                })}
              </span>
            )}

            <button
              type="button"
              onClick={() => onChange({ budget: null, budgetPerPerson: null })}
              className="text-[12px] font-semibold text-ink-soft underline-offset-2 hover:underline"
            >
              {t('itinerary.step4.clearBudget')}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
        <Figure label={t('itinerary.step4.totalEstimated')} value={formatMoney(total, trip.currency)} strong />
        <Figure label={t('itinerary.step4.perAdult')} value={formatPerHead(perHead.adult, trip.currency)} />
        {showChildren && (
          <Figure label={t('itinerary.step4.perChild')} value={formatPerHead(perHead.child, trip.currency)} />
        )}
      </div>

      {!capSet ? (
        <button
          type="button"
          onClick={() => onChange({ budget: 0, budgetPerPerson: null })}
          className="mt-3 text-[12.5px] font-semibold text-ocean-dark underline-offset-2 hover:underline"
        >
          ＋ {t('itinerary.step4.setBudget')}
        </button>
      ) : (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(100, Math.round((ratio ?? 0) * 100))}%` }}
            />
          </div>
          <p className={`m-0 mt-1.5 text-[12px] ${over ? 'font-semibold text-coral-dark' : 'text-ink-soft'}`}>
            {cap === 0
              ? t('itinerary.step4.budgetZero')
              : over
                ? t('itinerary.step4.overBudget', { amount: formatMoney(total - cap!, trip.currency) })
                : t('itinerary.step4.underBudget', {
                    percent: Math.round((ratio ?? 0) * 100),
                    amount: formatMoney(cap! - total, trip.currency),
                  })}
          </p>
        </div>
      )}


      <Dialog open={pendingCurrency !== null} onClose={() => setPendingCurrency(null)}>
        <DialogTitle>{t('itinerary.step4.currencyChangeTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingCurrency &&
              (losesPrecision(trip.currency, pendingCurrency)
                ? t('itinerary.step4.currencyChangeBodyRounding', {
                    count: countRoundedByRescale(trip.budgetPlan, trip.currency, pendingCurrency),
                    before: formatMoney(total, trip.currency),
                    after: formatMoney(rescaleAmount(total, trip.currency, pendingCurrency), pendingCurrency),
                  })
                : t('itinerary.step4.currencyChangeBody', {
                    before: formatMoney(total, trip.currency),
                    after: formatMoney(rescaleAmount(total, trip.currency, pendingCurrency), pendingCurrency),
                  }))}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingCurrency(null)}>{t('itinerary.detail.cancel')}</Button>
          <Button
            onClick={() => {
              if (pendingCurrency) {
                onChange({
                  currency: pendingCurrency,
                  budget:
                    trip.budget === null ? null : rescaleAmount(trip.budget, trip.currency, pendingCurrency),
                  budgetPerPerson:
                    trip.budgetPerPerson === null
                      ? null
                      : rescaleAmount(trip.budgetPerPerson, trip.currency, pendingCurrency),
                  budgetPlan: rescalePlan(trip.budgetPlan, trip.currency, pendingCurrency),
                });
              }
              setPendingCurrency(null);
            }}
          >
            {t('itinerary.step4.currencyChangeConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

function Figure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="m-0 text-[11.5px] font-semibold uppercase tracking-wide text-ink-soft">{label}</p>
      <p
        className={`m-0 font-display font-bold text-ink ${strong ? 'text-[26px]' : 'text-[19px] text-ink-soft'}`}
      >
        {value}
      </p>
    </div>
  );
}
