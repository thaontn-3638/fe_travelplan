import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import EventRepeatRoundedIcon from '@mui/icons-material/EventRepeatRounded';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import EditCalendarRoundedIcon from '@mui/icons-material/EditCalendarRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import type { TripStatus } from '../../../types';
import type { DashboardTask } from '../selectors';
import { TripStatusChip } from '../../../components/TripStatusChip';
import { formatTripDateRange } from '../../../utils/formatters';

// Mặc định chỉ hiện vài việc quan trọng nhất; còn lại sau "Xem thêm".
const COLLAPSED_LIMIT = 5;

interface DashboardTaskListProps {
  tasks: DashboardTask[];
  expanded: boolean;
  busyKey: string | null;
  onToggleExpanded: () => void;
  onChangeStatus: (task: Extract<DashboardTask, { kind: 'status' }>) => void;
  onDismiss: (task: DashboardTask) => void;
  // Số việc đang bị "後で" ẩn đi — có đường lấy lại, không mất hẳn.
  hiddenCount?: number;
  onRestoreHidden?: () => void;
}

const KIND_STYLE: Record<DashboardTask['kind'], { icon: React.ReactNode; tile: string }> = {
  status: { icon: <EventRepeatRoundedIcon sx={{ fontSize: 18 }} />, tile: 'bg-amber-tint text-amber-dark' },
  settle: { icon: <PaidRoundedIcon sx={{ fontSize: 18 }} />, tile: 'bg-violet-tint text-violet-dark' },
  plan: { icon: <EditCalendarRoundedIcon sx={{ fontSize: 18 }} />, tile: 'bg-ocean-tint text-ocean-dark' },
};

// Thay cho "Tất cả chuyến đi" (trùng với màn 旅程): những việc người dùng cần
// làm tiếp, mỗi việc đúng MỘT nút hành động chính.
export function DashboardTaskList({
  tasks: allTasks,
  expanded,
  busyKey,
  onToggleExpanded,
  onChangeStatus,
  onDismiss,
  hiddenCount = 0,
  onRestoreHidden,
}: DashboardTaskListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const totalCount = allTasks.length;
  const tasks = expanded ? allTasks : allTasks.slice(0, COLLAPSED_LIMIT);

  const statusLabel = (status: TripStatus): string => t(`dashboard.status.${status}`);

  function message(task: DashboardTask): string {
    if (task.kind === 'status') {
      if (task.reason === 'inProgress') {
        return t('dashboard.tasks.statusInProgress', { status: statusLabel(task.trip.status) });
      }
      if (task.reason === 'notStarted') {
        return t('dashboard.tasks.statusNotStarted');
      }
      return task.suggested === 'settling'
        ? t('dashboard.tasks.statusEndedSettle', { status: statusLabel(task.trip.status) })
        : t('dashboard.tasks.statusEndedDone', { status: statusLabel(task.trip.status) });
    }
    if (task.kind === 'settle') {
      return task.openBalance ? t('dashboard.tasks.settleOpen') : t('dashboard.tasks.settlePending');
    }
    return t('dashboard.tasks.planIncomplete', {
      progress: task.progress,
      step: t(`itinerary.wizard.step${task.nextStep}`),
    });
  }

  function urgency(task: DashboardTask): { label: string; hot: boolean } | null {
    if (task.kind !== 'plan') return null;
    if (task.daysUntil === 0) return { label: t('dashboard.tasks.departsToday'), hot: true };
    if (task.daysUntil <= 30) {
      return { label: t('dashboard.tasks.daysLeft', { count: task.daysUntil }), hot: task.daysUntil <= 7 };
    }
    return null;
  }

  function primary(task: DashboardTask): { label: string; onClick: () => void } {
    if (task.kind === 'status') {
      return {
        label: t('dashboard.tasks.changeTo', { status: statusLabel(task.suggested) }),
        onClick: () => onChangeStatus(task),
      };
    }
    if (task.kind === 'settle') {
      return { label: t('dashboard.tasks.openSettlement'), onClick: () => navigate(`/settlement/${task.trip.id}`) };
    }
    return {
      label: t('dashboard.tasks.continuePlan', { step: task.nextStep }),
      onClick: () => navigate(`/itinerary/${task.trip.id}/edit/${task.nextStep}`),
    };
  }

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="m-0 flex items-center gap-2.5 text-[17px] font-bold text-ink">
          {t('dashboard.tasks.title')}
          <span className="rounded-full border border-line bg-white px-2.5 py-0.5 font-mono text-[13px] text-ink-soft">
            {totalCount}
          </span>
        </h2>
        {hiddenCount > 0 && onRestoreHidden && (
          <button
            type="button"
            onClick={onRestoreHidden}
            className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-ocean-dark transition hover:bg-ocean-tint"
          >
            {t('dashboard.tasks.showHidden', { count: hiddenCount })}
          </button>
        )}
      </div>

      {totalCount === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-tint text-mint-dark">
            <TaskAltRoundedIcon sx={{ fontSize: 20 }} />
          </span>
          <div>
            <p className="m-0 text-[14px] font-semibold text-ink">{t('dashboard.tasks.emptyTitle')}</p>
            <p className="m-0 text-[12.5px] text-ink-soft">{t('dashboard.tasks.emptyBody')}</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <ul className="m-0 list-none p-0">
            {tasks.map((task) => {
              const style = KIND_STYLE[task.kind];
              const action = primary(task);
              const chip = urgency(task);
              const busy = busyKey === task.key;

              return (
                <li
                  key={task.key}
                  className="flex flex-col gap-3 border-b border-line px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${style.tile}`}>
                      {style.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/itinerary/${task.trip.id}`)}
                          className="truncate text-left font-display text-[14.5px] font-bold text-ink hover:text-ocean-dark"
                        >
                          {task.trip.name}
                        </button>
                        <TripStatusChip status={task.trip.status} />
                        {chip && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              chip.hot ? 'bg-coral-tint text-coral-dark' : 'bg-surface text-ink-soft'
                            }`}
                          >
                            {chip.label}
                          </span>
                        )}
                      </div>
                      <p className="m-0 mt-0.5 text-[12.5px] text-ink-soft">
                        <span className="font-mono">{formatTripDateRange(task.trip.startDate, task.trip.endDate)}</span>
                        {' · '}
                        {message(task)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-2 pl-12 sm:pl-0">
                    <button
                      type="button"
                      onClick={() => onDismiss(task)}
                      className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-soft transition hover:bg-surface"
                    >
                      {t('dashboard.tasks.later')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={action.onClick}
                      className="rounded-lg bg-ocean px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-ocean-dark disabled:cursor-wait disabled:opacity-60"
                    >
                      {busy ? t('itinerary.detail.saving') : action.label}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {totalCount > COLLAPSED_LIMIT ? (
            <button
              type="button"
              onClick={onToggleExpanded}
              className="block w-full border-t border-line bg-surface/50 px-4 py-2.5 text-center text-[12.5px] font-semibold text-ocean-dark transition hover:bg-ocean-tint"
            >
              {expanded
                ? t('dashboard.tasks.showLess')
                : t('dashboard.tasks.showMore', { count: totalCount - COLLAPSED_LIMIT })}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
