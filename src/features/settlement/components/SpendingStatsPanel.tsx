import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '@mui/material';
import type { Currency } from '../../../types';
import { COST_CATEGORIES } from '../../../types';
import { COST_CATEGORY_HEX } from '../../budget/utils/budgetCategories';
import { formatPrecise } from '../../budget/utils/money';
import { formatTripDateRange } from '../../../utils/formatters';
import { palette } from '../../../theme/palette';
import type { SpendingStats } from '../utils/spendingStats';

// Thứ tự tab: hai loại hay dùng trước, VND sau.
const STATS_CURRENCIES: Currency[] = ['JPY', 'USD', 'VND'];

interface SpendingStatsPanelProps {
  stats: SpendingStats;
  years: string[];
  year: string;
  onYearChange: (year: string) => void;
  // Tab tiền tệ cũng là bộ lọc của danh sách trip bên dưới (giống ô năm).
  // null = chưa lọc: thống kê hiện loại tiền đầu tiên có dữ liệu.
  currency: Currency | null;
  onCurrencyChange: (currency: Currency) => void;
}

// Thay cho "あなたの合計" (cộng dồn số dư nợ/được nợ — gần như luôn ¥0 vì đa
// số trip cũ không gắn tài khoản cho thành viên, và một con số nợ ròng qua
// nhiều trip cũng không trả lời câu hỏi người dùng thật sự có).
//
// Câu hỏi ở đây: "tôi đã tiêu bao nhiêu, cho trip nào, vào việc gì?" — chỉ
// tính phần của chính người đang đăng nhập.
export function SpendingStatsPanel({
  stats,
  years,
  year,
  onYearChange,
  currency: currencyPick,
  onCurrencyChange,
}: SpendingStatsPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Luôn hiện đủ 3 tab tiền tệ (app hỗ trợ JPY / USD / VND) để người dùng biết
  // chỗ xem chi tiêu theo từng loại tiền, kể cả khi loại đó chưa có số liệu.
  // Mặc định chọn tab đầu tiên có dữ liệu.
  const activeCurrency: Currency =
    currencyPick ?? stats.byCurrency[0]?.currency ?? STATS_CURRENCIES[0]!;
  const current = stats.byCurrency.find((entry) => entry.currency === activeCurrency) ?? null;

  return (
    <section className="mb-5 rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 font-display text-[15px] font-bold text-ink">{t('settlement.stats.title')}</h2>
          <p className="m-0 text-[12px] text-ink-soft">{t('settlement.stats.subtitle')}</p>
        </div>

        {stats.linkedTripCount > 0 && (
          <div className="inline-flex rounded-lg border border-line p-0.5" role="tablist" aria-label={t('settlement.stats.currency')}>
            {STATS_CURRENCIES.map((currency) => {
              const hasData = stats.byCurrency.some((entry) => entry.currency === currency);
              const selected = currency === activeCurrency;
              return (
                <button
                  key={currency}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onCurrencyChange(currency)}
                  className={`rounded-md px-2.5 py-1 text-[12px] font-semibold ${
                    selected ? 'bg-ocean-tint text-ocean-dark' : hasData ? 'text-ink-soft' : 'text-ink-soft/50'
                  }`}
                >
                  {currency}
                </button>
              );
            })}
          </div>
        )}

        {/* Ô chọn năm dùng chung cho cả thống kê lẫn danh sách bên dưới. */}
        <select
          value={year}
          aria-label={t('settlement.hub.year')}
          onChange={(event) => onYearChange(event.target.value)}
          className="rounded-lg border border-line bg-white px-2 py-1.5 text-[12.5px] text-ink-soft outline-none focus:border-ocean"
        >
          <option value="">{t('settlement.hub.allYears')}</option>
          {years.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      {current === null ? (
        <div className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-6 text-center">
          <p className="m-0 text-[13px] font-semibold text-ink">
            {stats.linkedTripCount === 0
              ? t('settlement.stats.emptyNotLinked')
              : stats.byCurrency.length > 0
                ? t('settlement.stats.emptyCurrency', { currency: activeCurrency })
                : t('settlement.stats.emptyNoExpenses')}
          </p>
          <p className="m-0 mt-1 text-[12px] text-ink-soft">
            {stats.linkedTripCount === 0
              ? t('settlement.stats.emptyNotLinkedHint')
              : stats.byCurrency.length > 0
                ? t('settlement.stats.emptyCurrencyHint', { currency: activeCurrency })
                : t('settlement.stats.emptyNoExpensesHint')}
          </p>
        </div>
      ) : (
        <>
          {/* Hàng số liệu */}
          <dl className="m-0 mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={t('settlement.stats.total')} value={formatPrecise(current.total, current.currency)} strong />
            <Kpi label={t('settlement.stats.trips')} value={String(current.tripCount)} />
            <Kpi label={t('settlement.stats.perTrip')} value={formatPrecise(current.perTrip, current.currency)} />
            <Kpi
              label={t('settlement.stats.perDay')}
              value={formatPrecise(current.perDay, current.currency)}
              hint={t('settlement.stats.perDayHint', { days: current.dayCount })}
            />
          </dl>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <TripBars entry={current} onOpen={(tripId) => navigate(`/settlement/${tripId}`)} />
            <CategoryShare entry={current} />
          </div>
        </>
      )}
    </section>
  );
}

function Kpi({ label, value, hint, strong = false }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-surface/60 px-3 py-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className={`m-0 font-display font-bold text-ink ${strong ? 'text-[20px]' : 'text-[17px]'}`}>{value}</dd>
      {hint && <dd className="m-0 text-[11px] text-ink-soft">{hint}</dd>}
    </div>
  );
}

// Một thanh ngang cho mỗi trip: thanh màu = phần của bạn, vạch đậm = dự trù cho
// 1 người lớn. Một thang chung cho mọi thanh để so được giữa các trip.
function TripBars({
  entry,
  onOpen,
}: {
  entry: SpendingStats['byCurrency'][number];
  onOpen: (tripId: string) => void;
}) {
  const { t } = useTranslation();
  const scale = Math.max(1, ...entry.trips.flatMap((row) => [row.myCost, row.plannedPerAdult]));
  const hasPlan = entry.trips.some((row) => row.plannedPerAdult > 0);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-soft">
        <span className="font-semibold text-ink">{t('settlement.stats.byTrip')}</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: palette.ocean }} />
          {t('settlement.stats.legendMine')}
        </span>
        {hasPlan && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 rounded-full bg-ink" />
            {t('settlement.stats.legendPlanned')}
          </span>
        )}
      </div>

      <ul className="m-0 list-none space-y-1 p-0">
        {entry.trips.map((row) => {
          const over = row.plannedPerAdult > 0 && row.myCost > row.plannedPerAdult;
          return (
            <li key={row.trip.id}>
              <Tooltip
                placement="top-start"
                title={
                  <span>
                    {row.trip.name}
                    <br />
                    {t('settlement.stats.legendMine')}: {formatPrecise(row.myCost, entry.currency)}
                    {row.plannedPerAdult > 0 && (
                      <>
                        <br />
                        {t('settlement.stats.legendPlanned')}: {formatPrecise(row.plannedPerAdult, entry.currency)}
                      </>
                    )}
                  </span>
                }
              >
                <button
                  type="button"
                  onClick={() => onOpen(row.trip.id)}
                  className="block w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-surface"
                >
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[12.5px] font-semibold text-ink">
                      {row.trip.name}
                      <span className="ml-2 font-mono text-[11px] font-normal text-ink-soft">
                        {formatTripDateRange(row.trip.startDate, row.trip.endDate)}
                      </span>
                    </span>
                    <span className="flex-shrink-0 font-mono text-[12.5px] font-semibold text-ink">
                      {formatPrecise(row.myCost, entry.currency)}
                      {over && (
                        <span className="ml-1.5 text-[11px] font-semibold text-coral-dark">
                          {t('settlement.stats.over', {
                            amount: formatPrecise(row.myCost - row.plannedPerAdult, entry.currency),
                          })}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-surface">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(row.myCost / scale) * 100}%`, backgroundColor: palette.ocean }}
                    />
                    {row.plannedPerAdult > 0 && (
                      <span
                        className="absolute -top-0.5 h-3.5 w-0.5 rounded-full bg-ink"
                        style={{ left: `calc(${(row.plannedPerAdult / scale) * 100}% - 1px)` }}
                      />
                    )}
                  </div>
                </button>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Tỉ trọng 5 loại chi phí của bạn: một thanh xếp chồng 100% + nhãn trực tiếp.
function CategoryShare({ entry }: { entry: SpendingStats['byCurrency'][number] }) {
  const { t } = useTranslation();
  const slices = COST_CATEGORIES.map((category) => ({ category, amount: entry.byCategory[category] }))
    .filter((slice) => slice.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return (
    <div>
      <p className="m-0 mb-2 text-[11.5px] font-semibold text-ink">{t('settlement.stats.byCategory')}</p>
      <div className="mb-3 flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-surface">
        {slices.map((slice) => (
          <Tooltip
            key={slice.category}
            title={`${t(`itinerary.step4.category.${slice.category}`)} · ${formatPrecise(slice.amount, entry.currency)}`}
          >
            <span
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(slice.amount / entry.total) * 100}%`, backgroundColor: COST_CATEGORY_HEX[slice.category] }}
            />
          </Tooltip>
        ))}
      </div>
      <ul className="m-0 list-none space-y-1.5 p-0">
        {slices.map((slice) => (
          <li key={slice.category} className="flex items-center gap-2 text-[12px]">
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: COST_CATEGORY_HEX[slice.category] }} />
            <span className="min-w-0 flex-1 truncate text-ink">{t(`itinerary.step4.category.${slice.category}`)}</span>
            <span className="font-mono text-ink-soft">{Math.round((slice.amount / entry.total) * 100)}%</span>
            <span className="w-[92px] text-right font-mono text-ink">{formatPrecise(slice.amount, entry.currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
