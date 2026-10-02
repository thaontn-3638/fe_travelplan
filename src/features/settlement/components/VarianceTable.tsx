import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import type { CostCategory, Expense, Trip } from '../../../types';
import { COST_CATEGORY_CLASSES } from '../../budget/utils/budgetCategories';
import { formatMoney, formatPerHead } from '../../budget/utils/money';
import { budgetTotal, planTotal } from '../../budget/utils/budgetRules';
import { totalSpent, varianceByCategory, varianceByNode } from '../utils/settlementRules';

interface VarianceTableProps {
  trip: Trip;
  expenses: Expense[];
}

const OVER_THRESHOLD = 0.2;

export function VarianceTable({ trip, expenses }: VarianceTableProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<CostCategory | null>(null);

  const rows = varianceByCategory(trip.budgetPlan, expenses, trip.party);
  const planned = planTotal(trip.budgetPlan, trip.party);
  const actual = totalSpent(expenses);
  const people = trip.party.adults + trip.party.children;
  const cap = budgetTotal(trip);

  // Thang chung cho mọi thanh, nếu không thì hai hàng cùng dài mà số tiền khác
  // nhau gấp mười lần.
  const scale = Math.max(...rows.flatMap((row) => [row.planned, row.actual]), 1);

  return (
    <div className="space-y-4">
      {/* Dưới lg cột Chênh lệch bị cắt mất — đổi sang thẻ xếp dọc. */}
      <ul className="m-0 list-none space-y-2 p-0 lg:hidden">
        {rows.map((row) => {
          const colors = COST_CATEGORY_CLASSES[row.category];
          const over = row.diffRatio !== null && row.diffRatio > OVER_THRESHOLD;

          return (
            <li key={row.category} className="rounded-2xl border border-line bg-white p-3">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                  {t(`itinerary.step4.category.${row.category}`)}
                </span>
                <span
                  className={`font-mono text-[13px] ${
                    row.diff === 0 ? 'text-ink-soft' : over ? 'font-bold text-coral-dark' : 'text-ink'
                  }`}
                >
                  {row.diff === 0
                    ? '±0'
                    : `${row.diff > 0 ? '+' : '−'}${formatMoney(Math.abs(row.diff), trip.currency)}`}
                  {row.diffRatio !== null && row.diff !== 0 && (
                    <span className="ml-1 text-[11.5px]">
                      ({row.diffRatio > 0 ? '+' : '−'}
                      {Math.round(Math.abs(row.diffRatio) * 100)}%)
                    </span>
                  )}
                </span>
              </div>
              <p className="m-0 text-[11.5px] text-ink-soft">
                {t('settlement.variance.planned')}{' '}
                <span className="font-mono">{formatMoney(row.planned, trip.currency)}</span>
                {' → '}
                {t('settlement.variance.actual')}{' '}
                <span className="font-mono font-semibold text-ink">{formatMoney(row.actual, trip.currency)}</span>
                {row.diffRatio === null && row.actual > 0 && ` · ${t('settlement.variance.noPlan')}`}
              </p>
            </li>
          );
        })}
        <li className="flex items-baseline justify-between rounded-2xl border border-line bg-white p-3 text-[13px] font-semibold">
          <span className="text-ink">{t('settlement.variance.total')}</span>
          <span className="font-mono text-ink">
            {formatMoney(actual, trip.currency)}
            <span className="text-ink-soft"> / {formatMoney(planned, trip.currency)}</span>
          </span>
        </li>
      </ul>

      <div className="hidden rounded-2xl border border-line bg-white lg:block">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line bg-surface text-left">
              <th className="px-4 py-2 font-semibold text-ink-soft">{t('settlement.variance.category')}</th>
              <th className="px-4 py-2 text-right font-semibold text-ink-soft">{t('settlement.variance.planned')}</th>
              <th className="px-4 py-2 text-right font-semibold text-ink-soft">{t('settlement.variance.actual')}</th>
              <th className="px-4 py-2 text-right font-semibold text-ink-soft">{t('settlement.variance.diff')}</th>
              <th className="w-28 px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const colors = COST_CATEGORY_CLASSES[row.category];
              const over = row.diffRatio !== null && row.diffRatio > OVER_THRESHOLD;

              const open = expanded === row.category;
              const detail = open ? varianceByNode(trip.budgetPlan, expenses, trip.party, row.category) : [];

              return (
                <Fragment key={row.category}>
                <tr className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : row.category)}
                      aria-expanded={open}
                      className="flex items-center gap-1.5 text-left text-ink"
                    >
                      {open ? (
                        <ExpandMoreRoundedIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <ChevronRightRoundedIcon sx={{ fontSize: 16 }} />
                      )}
                      <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                      {t(`itinerary.step4.category.${row.category}`)}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-ink-soft">
                    {formatMoney(row.planned, trip.currency)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-ink">
                    {formatMoney(row.actual, trip.currency)}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-mono ${
                      row.diff === 0 ? 'text-ink-soft' : over ? 'font-bold text-coral-dark' : 'text-ink'
                    }`}
                  >
                    {row.diff === 0 ? '±0' : `${row.diff > 0 ? '+' : '−'}${formatMoney(Math.abs(row.diff), trip.currency)}`}
                    {row.diffRatio !== null && row.diff !== 0 && (
                      <span className="ml-1 text-[11.5px]">
                        ({row.diffRatio > 0 ? '+' : '−'}
                        {Math.round(Math.abs(row.diffRatio) * 100)}%)
                      </span>
                    )}
                    {/* Chưa dự trù đồng nào thì tỉ lệ không xác định — không chia cho 0. */}
                    {row.diffRatio === null && row.actual > 0 && (
                      <span className="ml-1 text-[11.5px] text-ink-soft">({t('settlement.variance.noPlan')})</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex flex-col gap-1">
                      <span className="h-1.5 w-full rounded-full bg-surface">
                        <span
                          className="block h-full rounded-full bg-idea"
                          style={{ width: `${Math.round((row.planned / scale) * 100)}%` }}
                        />
                      </span>
                      <span className="h-1.5 w-full rounded-full bg-surface">
                        <span
                          className={`block h-full rounded-full ${over ? 'bg-coral' : colors.dot}`}
                          style={{ width: `${Math.round((row.actual / scale) * 100)}%` }}
                        />
                      </span>
                    </span>
                  </td>
                </tr>

                {open &&
                  detail.map((item) => (
                    <tr key={item.nodeId ?? 'unlinked'} className="border-b border-line bg-surface/50">
                      <td className="py-1.5 pl-12 pr-4 text-[12.5px] text-ink-soft">
                        {item.nodeId === null
                          ? t('settlement.variance.otherInGroup')
                          : item.title || t('itinerary.step4.untitled')}
                      </td>
                      <td className="px-4 py-1.5 text-right font-mono text-[12.5px] text-ink-soft">
                        {item.planned === 0 ? '—' : formatMoney(item.planned, trip.currency)}
                      </td>
                      <td className="px-4 py-1.5 text-right font-mono text-[12.5px] text-ink">
                        {item.actual === 0 ? '—' : formatMoney(item.actual, trip.currency)}
                      </td>
                      <td className="px-4 py-1.5 text-right font-mono text-[12.5px] text-ink-soft">
                        {item.diff === 0
                          ? '±0'
                          : `${item.diff > 0 ? '+' : '−'}${formatMoney(Math.abs(item.diff), trip.currency)}`}
                      </td>
                      <td />
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-line bg-surface font-semibold">
              <td className="px-4 py-2 text-ink">{t('settlement.variance.total')}</td>
              <td className="px-4 py-2 text-right font-mono text-ink-soft">{formatMoney(planned, trip.currency)}</td>
              <td className="px-4 py-2 text-right font-mono text-ink">{formatMoney(actual, trip.currency)}</td>
              <td className="px-4 py-2 text-right font-mono text-ink">
                {actual === planned
                  ? '±0'
                  : `${actual > planned ? '+' : '−'}${formatMoney(Math.abs(actual - planned), trip.currency)}`}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-2xl border border-line bg-white px-4 py-3 text-[12.5px]">
        <span className="text-ink-soft">
          {t('settlement.variance.perPersonActual')}:{' '}
          <strong className="font-mono text-ink">
            {people > 0 ? formatPerHead(actual / people, trip.currency) : '—'}
          </strong>
        </span>
        {cap !== null && cap > 0 && (
          <span className="text-ink-soft">
            {t('itinerary.step4.budgetLabel')}{' '}
            <strong className={`font-mono ${actual > cap ? 'text-coral-dark' : 'text-ink'}`}>
              {formatMoney(actual, trip.currency)} / {formatMoney(cap, trip.currency)}
            </strong>
          </span>
        )}
      </div>

      {rows.some((row) => row.diffRatio !== null && row.diffRatio > OVER_THRESHOLD) && (
        <p className="m-0 rounded-xl bg-coral-tint p-3 text-[12.5px] text-coral-dark">
          {t('settlement.variance.overWarning', {
            list: rows
              .filter((row) => row.diffRatio !== null && row.diffRatio > OVER_THRESHOLD)
              .map((row) => t(`itinerary.step4.category.${row.category}`))
              .join(', '),
          })}
        </p>
      )}
    </div>
  );
}
