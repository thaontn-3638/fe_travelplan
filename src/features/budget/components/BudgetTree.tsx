import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import type { BudgetNode, CostCategory, ItineraryItem, Place, Trip } from '../../../types';
import { COST_CATEGORIES } from '../../../types';
import { COST_CATEGORY_CLASSES } from '../utils/budgetCategories';
import { formatMoney } from '../utils/money';
import { MoneyInput } from './MoneyInput';
import { BudgetNodeRow, type BudgetNodeRowProps } from './BudgetNodeRow';
import {
  addChildNode,
  addRootNode,
  budgetDepth,
  budgetSuggestions,
  canAddChild,
  childrenOf,
  costCategoryForItem,
  createNode,
  duplicateNode,
  nodeTotal,
  removeNode,
  rootsOf,
  setBranchCategory,
  updateNode,
} from '../utils/budgetRules';

interface BudgetTreeProps {
  trip: Trip;
  placesById: Map<string, Place>;
  filter: CostCategory | null;
  onPlanChange: (plan: BudgetNode[]) => void;
  // Bấm chip ngày mở chi tiết địa điểm ở cột phải (§5.2).
  onShowPlace?: (placeId: string) => void;
}

function itemTitle(item: ItineraryItem, placesById: Map<string, Place>): string {
  if (item.kind === 'activity') {
    return item.title ?? '';
  }
  return placesById.get(item.placeId ?? '')?.title ?? '';
}

export function BudgetTree({ trip, placesById, filter, onPlanChange, onShowPlace }: BudgetTreeProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pendingRemove, setPendingRemove] = useState<BudgetNode | null>(null);

  const plan = trip.budgetPlan;
  const showChildPrice = trip.party.children > 0;
  const makeId = (): string => crypto.randomUUID();

  // Hai bố cục lưới tĩnh (không nội suy chuỗi) để Tailwind quét được class.
  const gridClass = showChildPrice
    ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_104px_104px_104px_60px_112px_40px]'
    : 'lg:grid lg:grid-cols-[minmax(0,1fr)_104px_104px_60px_112px_40px]';

  const dayLabelOf = new Map<string, string>();
  trip.days.forEach((day, index) => {
    for (const item of day.items) {
      dayLabelOf.set(item.id, t('itinerary.day.label', { index: index + 1 }));
    }
  });
  for (const item of trip.unscheduledItems) {
    dayLabelOf.set(item.id, t('itinerary.step4.unscheduled'));
  }

  // B4 — giá tham khảo luôn được NÓI RA; chỉ khi cùng đơn vị tiền nó mới được
  // phép chạm vào ô nhập. Khác đơn vị mà đổ thẳng vào ô là mời user nhập nhầm
  // một con số sai cả chục lần; giấu đi thì mất thông tin họ đang cần.
  function referenceOf(place: Place | undefined): BudgetNodeRowProps['reference'] {
    if (!place || place.price === undefined) {
      return undefined;
    }
    const currency = place.priceCurrency ?? 'JPY';
    return {
      amount: place.price,
      currency,
      unit: place.priceUnit,
      sameCurrency: currency === trip.currency,
    };
  }

  function referenceFor(node: BudgetNode): BudgetNodeRowProps['reference'] {
    return referenceOf(node.linkedPlaceId ? placesById.get(node.linkedPlaceId) : undefined);
  }

  const suggestions = budgetSuggestions(trip)
    .map(({ item }) => ({
      item,
      title: itemTitle(item, placesById),
      category: costCategoryForItem(item, placesById),
      place: item.placeId ? placesById.get(item.placeId) : undefined,
    }))
    .filter((entry) => filter === null || entry.category === filter);

  function addFromItem(entry: (typeof suggestions)[number], lumpSum?: number): void {
    onPlanChange(
      addRootNode(
        plan,
        {
          category: entry.category,
          title: entry.title || t('itinerary.step4.untitled'),
          linkedItemId: entry.item.id,
          linkedItemTitle: entry.title || t('itinerary.step4.untitled'),
          ...(entry.item.placeId ? { linkedPlaceId: entry.item.placeId } : {}),
          pricingMode: 'lumpSum',
          ...(lumpSum === undefined ? {} : { lumpSum }),
        },
        makeId(),
      ),
    );
  }

  function addAllSuggestions(): void {
    let next = plan;
    for (const entry of suggestions) {
      next = [
        ...next,
        createNode(
          next,
          {
            category: entry.category,
            title: entry.title || t('itinerary.step4.untitled'),
            linkedItemId: entry.item.id,
            linkedItemTitle: entry.title || t('itinerary.step4.untitled'),
            ...(entry.item.placeId ? { linkedPlaceId: entry.item.placeId } : {}),
            pricingMode: 'lumpSum',
            parentId: null,
          },
          makeId(),
        ),
      ];
    }
    onPlanChange(next);
  }

  function renderNode(node: BudgetNode, depth: number): React.ReactNode {
    const kids = childrenOf(plan, node.id);
    const isCollapsed = collapsed.has(node.id);

    return (
      <div key={node.id}>
        <BudgetNodeRow
          node={node}
          plan={plan}
          party={trip.party}
          currency={trip.currency}
          depth={depth}
          hasChildren={kids.length > 0}
          childCount={kids.length}
          collapsed={isCollapsed}
          canAddChild={canAddChild(plan, node.id)}
          dayLabel={node.linkedItemId ? (dayLabelOf.get(node.linkedItemId) ?? null) : null}
          onDayClick={
            node.linkedPlaceId && onShowPlace ? () => onShowPlace(node.linkedPlaceId!) : undefined
          }
          reference={referenceFor(node)}
          orphaned={!node.linkedItemId && Boolean(node.linkedPlaceId ?? node.linkedItemTitle)}
          showChildPrice={showChildPrice}
          gridClass={gridClass}
          onToggle={() =>
            setCollapsed((current) => {
              const next = new Set(current);
              if (next.has(node.id)) next.delete(node.id);
              else next.add(node.id);
              return next;
            })
          }
          onPatch={(patch) => onPlanChange(updateNode(plan, node.id, patch))}
          onAddChild={() => onPlanChange(addChildNode(plan, node.id, makeId))}
          onDuplicate={() =>
            onPlanChange(duplicateNode(plan, node.id, makeId, t('itinerary.step4.copySuffix')))
          }
          onChangeCategory={(category) => onPlanChange(setBranchCategory(plan, node.id, category))}
          onRemove={() => setPendingRemove(node)}
        />
        {!isCollapsed && kids.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  const visibleCategories = filter === null ? COST_CATEGORIES : [filter];

  return (
    <div className="space-y-4">
      {visibleCategories.map((category) => {
        const groupRoots = rootsOf(plan).filter((node) => node.category === category);
        const groupSuggestions = suggestions.filter((entry) => entry.category === category);
        const colors = COST_CATEGORY_CLASSES[category];
        const groupTotal = groupRoots.reduce((sum, node) => sum + nodeTotal(node, plan, trip.party), 0);

        if (groupRoots.length === 0 && groupSuggestions.length === 0 && filter === null) {
          return (
            <section key={category} className="rounded-2xl border border-dashed border-line bg-white">
              <GroupHeader
                category={category}
                label={t(`itinerary.step4.category.${category}`)}
                total={formatMoney(0, trip.currency)}
                dot={colors.dot}
              />
              <div className="px-3 pb-3">
                <AddButton
                  label={t('itinerary.step4.addNode')}
                  onClick={() =>
                    onPlanChange(
                      addRootNode(
                        plan,
                        { category, title: '', pricingMode: 'lumpSum' },
                        makeId(),
                      ),
                    )
                  }
                />
              </div>
            </section>
          );
        }

        return (
          <section key={category} className="overflow-hidden rounded-2xl border border-line bg-white">
            <GroupHeader
              category={category}
              label={t(`itinerary.step4.category.${category}`)}
              total={formatMoney(groupTotal, trip.currency)}
              dot={colors.dot}
            />

            {groupRoots.length > 0 && (
              <div className={`hidden border-b border-line bg-surface px-3 py-1.5 lg:grid ${gridClass}`}>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  {t('itinerary.step4.colName')}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  {t('itinerary.step4.colMode')}
                </span>
                <span className="text-right text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  {showChildPrice ? t('itinerary.step4.colAdult') : t('itinerary.step4.colAmount')}
                </span>
                {showChildPrice && (
                  <span className="text-right text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    {t('itinerary.step4.colChild')}
                  </span>
                )}
                <span className="text-right text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  {t('itinerary.step4.colQty')}
                </span>
                <span className="text-right text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  {t('itinerary.step4.colTotal')}
                </span>
                <span />
              </div>
            )}

            {groupRoots.map((node) => renderNode(node, budgetDepth(plan, node.id)))}

            <div className="px-3 py-2">
              <AddButton
                label={t('itinerary.step4.addNode')}
                onClick={() =>
                  onPlanChange(
                    addRootNode(plan, { category, title: '', pricingMode: 'lumpSum' }, makeId()),
                  )
                }
              />
            </div>

            {groupSuggestions.length > 0 && (
              <div className="border-t border-dashed border-line bg-surface/60 px-3 py-2">
                <p className="m-0 mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-soft">
                  {t('itinerary.step4.suggestionsTitle', { count: groupSuggestions.length })}
                </p>
                {groupSuggestions.map((entry) => {
                  const price =
                    entry.place?.price !== undefined &&
                    (entry.place.priceCurrency ?? 'JPY') === trip.currency
                      ? entry.place.price
                      : undefined;

                  return (
                    <div
                      key={entry.item.id}
                      className="flex flex-wrap items-center gap-2 border-b border-line/60 py-1.5 last:border-b-0"
                    >
                      <span className="h-1.5 w-1.5 rounded-full border border-ink-soft" />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-soft">
                        {entry.title || t('itinerary.step4.untitled')}
                      </span>
                      {dayLabelOf.get(entry.item.id) && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-ink-soft">
                          {dayLabelOf.get(entry.item.id)}
                        </span>
                      )}
                      {/* Nhập thẳng số ở đây là đường nhanh nhất: gõ xong là
                          hàng gợi ý thành khoản chi phí thật (B3.2). */}
                      {/* Trên mobile ô nhập chen mất cả tên mục — ở đó nút ＋
                          vẫn là đường chính, đúng như Bước 2 (§9). */}
                      <span className="hidden w-28 sm:block">
                        <MoneyInput
                          value={undefined}
                          currency={trip.currency}
                          reference={price}
                          ariaLabel={`${t('itinerary.step4.addOne')} — ${entry.title}`}
                          onChange={(value) => {
                            if (value !== undefined) addFromItem(entry, value);
                          }}
                        />
                      </span>
                      {price !== undefined && (
                        <button
                          type="button"
                          onClick={() => addFromItem(entry, price)}
                          className="rounded-lg border border-line bg-white px-2 py-1 text-[11.5px] font-semibold text-ocean-dark"
                        >
                          {t('itinerary.step4.useThisPrice', { amount: formatMoney(price, trip.currency) })}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => addFromItem(entry)}
                        className="rounded-lg border border-ocean bg-white px-2 py-1 text-[11.5px] font-semibold text-ocean-dark"
                      >
                        ＋ {t('itinerary.step4.addOne')}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {suggestions.length > 0 && (
        <button
          type="button"
          onClick={addAllSuggestions}
          className="w-full rounded-xl border border-dashed border-ocean bg-white px-4 py-2.5 text-[13px] font-semibold text-ocean-dark transition hover:bg-ocean-tint"
        >
          {t('itinerary.step4.addAll', { count: suggestions.length })}
        </button>
      )}

      <Dialog open={pendingRemove !== null} onClose={() => setPendingRemove(null)}>
        <DialogTitle>{t('itinerary.step4.deleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingRemove &&
              t('itinerary.step4.deleteBody', {
                title: pendingRemove.title || t('itinerary.step4.untitled'),
                count: childrenOf(plan, pendingRemove.id).length,
                amount: formatMoney(nodeTotal(pendingRemove, plan, trip.party), trip.currency),
              })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRemove(null)}>{t('itinerary.detail.cancel')}</Button>
          <Button
            color="error"
            onClick={() => {
              if (pendingRemove) onPlanChange(removeNode(plan, pendingRemove.id));
              setPendingRemove(null);
            }}
          >
            {t('itinerary.step4.deleteConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

function GroupHeader({
  label,
  total,
  dot,
}: {
  category: CostCategory;
  label: string;
  total: string;
  dot: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
      <span className="flex items-center gap-2 font-display text-[14px] font-bold text-ink">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="font-mono text-[13px] font-semibold text-ink">{total}</span>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-ocean-dark transition hover:bg-ocean-tint"
    >
      ＋ {label}
    </button>
  );
}
