import { useTranslation } from 'react-i18next';
import { Tooltip } from '@mui/material';
import type { Trip } from '../../../types';
import { COST_CATEGORIES } from '../../../types';
import { COST_CATEGORY_CLASSES, COST_CATEGORY_HEX } from '../utils/budgetCategories';
import { formatMoney } from '../utils/money';
import { budgetSuggestions, planTotal, totalsByCategory, totalsByDay } from '../utils/budgetRules';
import { formatDateWithWeekday } from '../../../utils/dateFormat';

interface BudgetBreakdownProps {
  trip: Trip;
  // Trang chia sẻ công khai: ẩn gợi ý "còn N mục chưa dự trù" — đó là việc của
  // người lập kế hoạch, người xem link không làm gì được với nó.
  hidePlanningHints?: boolean;
}

// Tỉ trọng 5 loại chi phí.
//
// Không dùng biểu đồ tròn dù spec ban đầu viết vậy: đây là dữ liệu phần-trên-tổng
// với tên nhóm dài tiếng Việt, nằm trong một cột hẹp. Thanh xếp chồng ngang +
// danh sách gán nhãn trực tiếp đọc nhanh hơn và không cần chú giải riêng —
// biểu đồ tròn ở bề ngang này chỉ còn là 5 lát nhỏ với một chú giải ở cạnh.
export function BudgetBreakdown({ trip, hidePlanningHints = false }: BudgetBreakdownProps) {
  const { t } = useTranslation();

  const total = planTotal(trip.budgetPlan, trip.party);
  const byCategory = totalsByCategory(trip.budgetPlan, trip.party);
  const { byDay, unassigned } = totalsByDay(trip);
  const notBudgeted = budgetSuggestions(trip).length;

  const shares = COST_CATEGORIES.map((category) => ({
    category,
    amount: byCategory[category],
    percent: total > 0 ? (byCategory[category] / total) * 100 : 0,
  }));

  return (
    <div className="space-y-5 rounded-2xl border border-line bg-white p-4">
      <section>
        <h3 className="m-0 mb-3 font-display text-[14px] font-bold text-ink">
          {t('itinerary.step4.breakdownTitle')}
        </h3>

        {total === 0 ? (
          <p className="m-0 text-[12.5px] text-ink-soft">{t('itinerary.step4.breakdownEmpty')}</p>
        ) : (
          <>
            <div className="mb-3 flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-surface">
              {shares
                .filter((share) => share.amount > 0)
                .map((share) => (
                  <Tooltip
                    key={share.category}
                    title={`${t(`itinerary.step4.category.${share.category}`)} · ${formatMoney(
                      share.amount,
                      trip.currency,
                    )} · ${Math.round(share.percent)}%`}
                  >
                    <span
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      style={{
                        width: `${share.percent}%`,
                        backgroundColor: COST_CATEGORY_HEX[share.category],
                      }}
                    />
                  </Tooltip>
                ))}
            </div>

            {/* Gán nhãn trực tiếp: 5 nhóm thì màu một mình không đủ để nhận ra. */}
            <ul className="m-0 list-none space-y-1.5 p-0">
              {shares.map((share) => (
                <li key={share.category} className="flex items-center gap-2 text-[12.5px]">
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${COST_CATEGORY_CLASSES[share.category].dot}`} />
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {t(`itinerary.step4.category.${share.category}`)}
                  </span>
                  <span className="font-mono text-ink-soft">{Math.round(share.percent)}%</span>
                  <span className="w-24 text-right font-mono font-semibold text-ink">
                    {formatMoney(share.amount, trip.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h3 className="m-0 mb-2 font-display text-[14px] font-bold text-ink">
          {t('itinerary.step4.byDayTitle')}
        </h3>
        <ul className="m-0 list-none space-y-1 p-0">
          {trip.days.map((day, index) => (
            <li key={day.id} className="flex items-center gap-2 text-[12.5px]">
              <span className="min-w-0 flex-1 truncate text-ink-soft">
                {t('itinerary.day.label', { index: index + 1 })} · {formatDateWithWeekday(day.date)}
              </span>
              <span className="font-mono text-ink">{formatMoney(byDay[day.id] ?? 0, trip.currency)}</span>
            </li>
          ))}
          <li className="flex items-center gap-2 border-t border-line pt-1 text-[12.5px]">
            <span className="min-w-0 flex-1 truncate text-ink-soft">{t('itinerary.step4.noDay')}</span>
            <span className="font-mono text-ink">{formatMoney(unassigned, trip.currency)}</span>
          </li>
        </ul>
      </section>

      {notBudgeted > 0 && !hidePlanningHints && (
        <p className="m-0 rounded-xl bg-amber-tint p-3 text-[12px] text-amber-dark">
          {t('itinerary.step4.notBudgeted', { count: notBudgeted })}
        </p>
      )}
    </div>
  );
}
