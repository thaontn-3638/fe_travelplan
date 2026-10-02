import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import type { BudgetNode, Trip } from '../../../types';
import { COST_CATEGORIES } from '../../../types';
import { COST_CATEGORY_CLASSES } from '../utils/budgetCategories';
import { formatMoney } from '../utils/money';
import { childrenOf, nodeTotal, rootsOf } from '../utils/budgetRules';

interface BudgetPlanViewProps {
  trip: Trip;
  onEdit?: () => void;
}

// Bản CHỈ ĐỌC của cây dự trù (Bước 4) cho tab Chi phí ở màn xem. Trước đây
// muốn biết một khoản được tính thế nào phải mở wizard sửa — mở chế độ sửa chỉ
// để đọc là sai chỗ, và dễ lỡ tay đổi số.
//
// Không tái dùng BudgetTree/BudgetNodeRow: hai component đó toàn ô nhập. Ở đây
// mỗi dòng nói đúng ba điều: khoản gì, tính ra sao, thành bao nhiêu.
export function BudgetPlanView({ trip, onEdit }: BudgetPlanViewProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const plan = trip.budgetPlan;
  const roots = rootsOf(plan);

  const dayLabelOf = new Map<string, string>();
  trip.days.forEach((day, index) => {
    for (const item of day.items) {
      dayLabelOf.set(item.id, t('itinerary.day.label', { index: index + 1 }));
    }
  });
  for (const item of trip.unscheduledItems) {
    dayLabelOf.set(item.id, t('itinerary.step4.unscheduled'));
  }

  function toggle(nodeId: string): void {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  // "¥3,000 × 大人2人 + ¥1,500 × 子ども1人 × 3" — đọc được cách ra con số mà
  // không cần nhìn lưới ô nhập của Bước 4.
  function formulaOf(node: BudgetNode, childCount: number): string {
    if (childCount > 0) {
      return t('itinerary.step4.sumOfChildren', { count: childCount });
    }

    const money = (amount: number | undefined): string => formatMoney(amount ?? 0, trip.currency);
    const quantity = Math.max(1, Math.floor(node.quantity || 1));
    const qty = quantity > 1 ? ` ${t('itinerary.detail.plan.formulaQty', { qty: quantity })}` : '';

    if (node.pricingMode === 'perPerson') {
      const parts = [t('itinerary.detail.plan.formulaAdult', { price: money(node.unitAdult), count: trip.party.adults })];
      if (trip.party.children > 0) {
        parts.push(
          t('itinerary.detail.plan.formulaChild', { price: money(node.unitChild), count: trip.party.children }),
        );
      }
      const body = parts.join(' + ');
      return parts.length > 1 && qty ? `(${body})${qty}` : `${body}${qty}`;
    }

    return `${t(
      (node.lumpSumSplit ?? 'perHead') === 'adultsOnly'
        ? 'itinerary.detail.plan.formulaLumpSumAdults'
        : 'itinerary.detail.plan.formulaLumpSum',
      { price: money(node.lumpSum) },
    )}${qty}`;
  }

  function renderNode(node: BudgetNode, depth: number): React.ReactNode {
    const kids = childrenOf(plan, node.id);
    const isCollapsed = collapsed.has(node.id);
    const dayLabel = node.linkedItemId ? dayLabelOf.get(node.linkedItemId) : undefined;
    const orphaned = !node.linkedItemId && Boolean(node.linkedPlaceId ?? node.linkedItemTitle);
    const note = node.note?.trim();

    return (
      <li key={node.id} className="list-none">
        <div
          className="flex items-start gap-2 border-b border-line py-2.5 pr-1"
          style={{ paddingLeft: `${depth * 20}px` }}
        >
          {kids.length > 0 ? (
            <button
              type="button"
              onClick={() => toggle(node.id)}
              aria-label={t('itinerary.step4.toggleChildren')}
              aria-expanded={!isCollapsed}
              className="mt-px flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-ink-soft hover:bg-surface"
            >
              <ChevronRightRoundedIcon
                sx={{ fontSize: 18 }}
                className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
              />
            </button>
          ) : (
            <span className="w-5 flex-shrink-0" />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-[13.5px] text-ink ${depth === 0 ? 'font-semibold' : ''}`}>
                {node.title || t('itinerary.step4.untitled')}
              </span>
              {dayLabel && (
                <span className="rounded-full border border-line bg-surface px-1.5 py-px text-[10.5px] font-semibold text-ink-soft">
                  {dayLabel}
                </span>
              )}
              {orphaned && (
                <span
                  title={t('itinerary.step4.orphanedHint')}
                  className="flex items-center gap-0.5 rounded-full bg-amber-tint px-1.5 py-px text-[10.5px] font-semibold text-amber-dark"
                >
                  <LinkOffRoundedIcon sx={{ fontSize: 12 }} />
                  {t('itinerary.step4.orphanedBadge')}
                </span>
              )}
            </div>
            <p className="m-0 mt-0.5 font-mono text-[11.5px] text-ink-soft">{formulaOf(node, kids.length)}</p>
            {note && (
              <p className="m-0 mt-1 flex items-start gap-1 text-[11.5px] leading-snug text-ink-soft">
                <StickyNote2OutlinedIcon sx={{ fontSize: 13 }} className="mt-px flex-shrink-0 text-amber-dark" />
                <span className="whitespace-pre-wrap">{note}</span>
              </p>
            )}
          </div>

          <span
            className={`flex-shrink-0 text-right font-mono text-[13px] ${
              depth === 0 ? 'font-bold text-ink' : 'font-semibold text-ink-soft'
            }`}
          >
            {formatMoney(nodeTotal(node, plan, trip.party), trip.currency)}
          </span>
        </div>

        {kids.length > 0 && !isCollapsed && <ul className="m-0 p-0">{kids.map((kid) => renderNode(kid, depth + 1))}</ul>}
      </li>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h3 className="m-0 font-display text-[14px] font-bold text-ink">{t('itinerary.detail.plan.title')}</h3>
          <p className="m-0 text-[11.5px] text-ink-soft">
            {t('itinerary.detail.plan.caption', { adults: trip.party.adults, children: trip.party.children })}
          </p>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:border-ocean hover:text-ocean-dark"
          >
            {t('itinerary.detail.plan.edit')}
          </button>
        )}
      </div>

      {roots.length === 0 ? (
        <p className="m-0 px-4 py-8 text-center text-[12.5px] text-ink-soft">{t('itinerary.detail.plan.empty')}</p>
      ) : (
        <div className="px-4 pb-2">
          {COST_CATEGORIES.map((category) => {
            const groupRoots = roots.filter((node) => node.category === category);
            if (groupRoots.length === 0) return null;
            const groupTotal = groupRoots.reduce((sum, node) => sum + nodeTotal(node, plan, trip.party), 0);

            return (
              <div key={category} className="pt-3">
                <div className="flex items-center gap-2 pb-1">
                  <span className={`h-2 w-2 rounded-full ${COST_CATEGORY_CLASSES[category].dot}`} />
                  <span className="flex-1 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-soft">
                    {t(`itinerary.step4.category.${category}`)}
                  </span>
                  <span className="font-mono text-[12.5px] font-semibold text-ink-soft">
                    {formatMoney(groupTotal, trip.currency)}
                  </span>
                </div>
                <ul className="m-0 p-0">{groupRoots.map((node) => renderNode(node, 0))}</ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
