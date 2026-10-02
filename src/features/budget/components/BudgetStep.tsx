import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BudgetNode, CostCategory, Place, Trip } from '../../../types';
import { MobileColumnTabs } from '../../itinerary/components/MobileColumnTabs';
import { BudgetCategoryChips } from './BudgetCategoryChips';
import { BudgetTotalsBar } from './BudgetTotalsBar';
import { BudgetTree } from './BudgetTree';
import { BudgetBreakdown } from './BudgetBreakdown';
import { ItineraryPlaceDetailPane } from '../../itinerary/components/ItineraryPlaceDetailPane';
import { planTotal, totalsByCategory, unlinkDeletedItems } from '../utils/budgetRules';

interface BudgetStepProps {
  trip: Trip;
  placesById: Map<string, Place>;
  // Đã có chi tiêu thực tế ghi theo đơn vị tiền hiện tại (B5).
  hasExpenses?: boolean;
  onChange: (trip: Trip) => void;
}

// Bước 4 — Dự trù chi phí. Bố cục 2 cột giống Bước 2 để không bắt user học lại
// một ngôn ngữ giao diện khác ở bước cuối.
export function BudgetStep({ trip, placesById, hasExpenses = false, onChange }: BudgetStepProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<CostCategory | null>(null);
  const [mobileTab, setMobileTab] = useState<'left' | 'right'>('left');
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const activePlace = activePlaceId ? placesById.get(activePlaceId) : undefined;

  // B3.6 — mục lịch trình bị xoá ở Bước 2 thì khoản chi phí VẪN Ở LẠI, chỉ mất
  // liên kết. Dọn ngay lúc mở bước để hàng đó hiện đúng badge cảnh báo.
  const cleaned = unlinkDeletedItems(trip);
  const current =
    JSON.stringify(cleaned) === JSON.stringify(trip.budgetPlan) ? trip : { ...trip, budgetPlan: cleaned };

  function setPlan(plan: BudgetNode[]): void {
    onChange({ ...current, budgetPlan: plan });
  }

  return (
    <div>
      <BudgetTotalsBar
        trip={current}
        hasExpenses={hasExpenses}
        onChange={(patch) => onChange({ ...current, ...patch })}
      />

      <div className="mb-4">
        <BudgetCategoryChips
          value={filter}
          totals={totalsByCategory(current.budgetPlan, current.party)}
          grandTotal={planTotal(current.budgetPlan, current.party)}
          currency={current.currency}
          onChange={setFilter}
        />
      </div>

      <MobileColumnTabs
        activeTab={mobileTab}
        onChange={setMobileTab}
        leftLabel={t('itinerary.step4.tabLeft')}
        rightLabel={t('itinerary.step4.tabRight')}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className={mobileTab === 'left' ? '' : 'hidden lg:block'}>
          <BudgetTree
            trip={current}
            placesById={placesById}
            filter={filter}
            onPlanChange={setPlan}
            onShowPlace={(placeId) => {
              setActivePlaceId(placeId);
              setMobileTab('right');
            }}
          />
        </div>
        <div className={mobileTab === 'right' ? '' : 'hidden lg:block'}>
          {activePlace ? (
            <ItineraryPlaceDetailPane place={activePlace} onBack={() => setActivePlaceId(null)} />
          ) : (
            <BudgetBreakdown trip={current} />
          )}
        </div>
      </div>
    </div>
  );
}
