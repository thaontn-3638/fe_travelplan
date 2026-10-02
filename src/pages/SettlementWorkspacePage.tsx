import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Dialog, Snackbar } from '@mui/material';
import type { Expense } from '../types';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useTrip } from '../features/itinerary/hooks/useTrip';
import { useExpenses } from '../features/settlement/hooks/useExpenses';
import { ExpenseForm } from '../features/settlement/components/ExpenseForm';
import { ExpenseList } from '../features/settlement/components/ExpenseList';
import { VarianceTable } from '../features/settlement/components/VarianceTable';
import { SettlementTab } from '../features/settlement/components/SettlementTab';
import { ExpenseHistoryList } from '../features/settlement/components/ExpenseHistoryList';
import { TripCostSummary } from '../features/settlement/components/TripCostSummary';
import { formatTripDateRange } from '../utils/formatters';
import { planTotal, totalsByCategory } from '../features/budget/utils/budgetRules';
import { actualByCategory } from '../features/settlement/utils/settlementRules';
import { CategoryDonut, CategoryLegend } from '../features/settlement/components/CategoryDonut';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import { PageLoading } from '../components/PageLoading';

type Tab = 'log' | 'variance' | 'settle' | 'history';

export default function SettlementWorkspacePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuth();
  const { trip, loading, error, patch } = useTrip(tripId);
  const { expenses, loading: expensesLoading, add, edit, remove, error: expenseError, historyRevision } = useExpenses(tripId);

  const [tab, setTab] = useState<Tab>('log');
  const [formOpen, setFormOpen] = useState(false);
  // Gõ nhầm một con số mà phải xoá rồi nhập lại cả phần chia riêng thì không ai
  // chịu được — sửa tại chỗ.
  const [editing, setEditing] = useState<Expense | null>(null);
  // Thao tác tiền thất bại (xoá khoản chi, đánh dấu đã trả, đổi thủ quỹ) phải
  // được báo ra — trước đây lỗi bị nuốt và người dùng tưởng đã xong.
  const [actionError, setActionError] = useState<string | null>(null);

  async function guarded(action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
    } catch {
      setActionError(t('settlement.actionError'));
    }
  }

  if (loading) return <PageLoading />;

  if (error || !trip) {
    return (
      <div className="mx-auto max-w-[520px] rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
        <h2 className="m-0 mb-2 font-display text-lg font-bold text-ink">{t('itinerary.detail.loadErrorTitle')}</h2>
        <p className="m-0 text-sm text-ink-soft">{t('itinerary.detail.loadErrorBody')}</p>
        <button
          type="button"
          onClick={() => navigate('/settlement')}
          className="mt-5 rounded-xl border border-line bg-white px-4 py-2 text-[13px] font-semibold text-ink transition hover:border-ocean hover:text-ocean-dark"
        >
          ← {t('settlement.hub.title')}
        </button>
      </div>
    );
  }

  const planned = planTotal(trip.budgetPlan, trip.party);
  const actualTotals = actualByCategory(expenses);
  const plannedTotals = totalsByCategory(trip.budgetPlan, trip.party);
  const hasSpending = expenses.some((expense) => expense.kind === 'expense');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'log', label: t('settlement.tabs.log') },
    { key: 'variance', label: t('settlement.tabs.variance') },
    { key: 'settle', label: t('settlement.tabs.settle') },
    { key: 'history', label: t('settlement.tabs.history') },
  ];

  return (
    <div className="pb-24">
      <button
        type="button"
        onClick={() => navigate('/settlement')}
        className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-ink-soft"
      >
        <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
        {t('settlement.hub.title')}
      </button>

      <div className="mb-5 flex flex-col gap-5 rounded-2xl border border-line bg-white p-4 sm:p-5 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="m-0 font-display text-[21px] font-bold text-ink">{trip.name}</h1>
              <p className="m-0 font-mono text-[12.5px] text-ink-soft">
                {formatTripDateRange(trip.startDate, trip.endDate)}
              </p>
            </div>
            {/* Trước đây là một link chữ nhỏ lẫn vào dòng ngày — đổi thành nút. */}
            <button
              type="button"
              onClick={() => navigate(`/itinerary/${trip.id}`)}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-ocean bg-white px-3.5 py-2 text-[13px] font-semibold text-ocean-dark transition hover:bg-ocean-tint"
            >
              <EventNoteRoundedIcon sx={{ fontSize: 17 }} />
              {t('settlement.openTrip')}
            </button>
          </div>

          <TripCostSummary trip={trip} expenses={expenses} currentUserId={user?.id ?? ''} />

          {/* Dự trù nằm trong wizard sửa lịch trình, chi thực tế nằm ở màn này.
              Không có link thì người dùng mở màn này cho một chuyến chưa dự trù
              sẽ không biết phải đi đâu để lập. */}
          {planned === 0 && (
            <button
              type="button"
              onClick={() => navigate(`/itinerary/${trip.id}/edit/4`)}
              className="mt-4 rounded-xl border border-ocean bg-white px-4 py-2 text-[13px] font-semibold text-ocean-dark"
            >
              {t('settlement.planBudget')} →
            </button>
          )}
        </div>

        {/* Tỉ trọng theo loại: chi thực tế nếu đã có, chưa có thì vẽ bản dự trù
            (nhạt) để màn này không trống ở trip mới. */}
        {(hasSpending || planned > 0) && (
          <div className="flex items-center gap-4 border-t border-line pt-4 md:w-[340px] md:flex-shrink-0 md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <CategoryDonut
              totals={hasSpending ? actualTotals : plannedTotals}
              currency={trip.currency}
              size={120}
              muted={!hasSpending}
              center={
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                  {hasSpending ? t('settlement.workspace.actual') : t('settlement.workspace.planned')}
                </span>
              }
            />
            <div className="min-w-0 flex-1">
              <CategoryLegend totals={hasSpending ? actualTotals : plannedTotals} currency={trip.currency} />
            </div>
          </div>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`min-h-[40px] rounded-xl border px-4 text-[13px] font-semibold transition ${
              tab === item.key ? 'border-ocean bg-ocean-tint text-ocean-dark' : 'border-line bg-white text-ink-soft'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {expenseError && (
        <p className="m-0 mb-4 rounded-xl bg-coral-tint p-3 text-[12.5px] text-coral-dark">{expenseError}</p>
      )}

      {tab === 'log' && (
        <ExpenseList
          trip={trip}
          expenses={expenses}
          loading={expensesLoading}
          onEdit={setEditing}
          onRemove={(id) => guarded(() => remove(id))}
        />
      )}
      {tab === 'variance' && <VarianceTable trip={trip} expenses={expenses} />}
      {tab === 'history' && <ExpenseHistoryList trip={trip} revision={historyRevision} />}
      {tab === 'settle' && (
        <SettlementTab
          trip={trip}
          expenses={expenses}
          currentUserId={user?.id ?? ''}
          loading={expensesLoading}
          onSettle={(input) => guarded(() => add(input))}
          onTreasurerChange={(travelerId) => void guarded(() => patch({ treasurerId: travelerId }))}
        />
      )}

      {/* Ghi chi tiêu là thao tác lặp đi lặp lại, làm khi đang đứng ngoài đường
          — nút phải luôn ở trong tầm ngón cái. */}
      {tab === 'log' && (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="fixed bottom-6 right-6 z-20 rounded-full bg-ocean px-5 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-ocean-dark"
        >
          ＋ {t('settlement.addExpense')}
        </button>
      )}

      <Dialog
        open={formOpen || editing !== null}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <div className="p-5">
          <h2 className="m-0 mb-4 font-display text-[17px] font-bold text-ink">
            {editing ? t('settlement.editExpense') : t('settlement.addExpense')}
          </h2>
          <ExpenseForm
            key={editing?.id ?? 'new'}
            trip={trip}
            currentUserId={user?.id ?? ''}
            initial={editing ?? undefined}
            onCancel={() => {
              setFormOpen(false);
              setEditing(null);
            }}
            onSubmit={async (input, keepOpen) => {
              if (editing) {
                await edit(editing.id, input);
                setEditing(null);
                return;
              }
              await add(input);
              if (!keepOpen) setFormOpen(false);
            }}
          />
        </div>
      </Dialog>
      <Snackbar
        open={actionError !== null}
        autoHideDuration={6000}
        onClose={() => setActionError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {actionError ? (
          <Alert severity="error" variant="filled" onClose={() => setActionError(null)}>
            {actionError}
          </Alert>
        ) : undefined}
      </Snackbar>
    </div>
  );
}
