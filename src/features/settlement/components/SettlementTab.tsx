import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import type { Expense, Traveler, Trip } from '../../../types';
import { formatPrecise, formatSignedPrecise } from '../../budget/utils/money';
import {
  buildSettlementExpense,
  personCosts,
  pickTreasurer,
  settleViaTreasurer,
  settlementText,
  type Transfer,
} from '../utils/settlementRules';
import type { NewExpense } from '../api/expenseApi';
import { todayISO } from '../../../utils/dateFormat';

interface SettlementTabProps {
  trip: Trip;
  expenses: Expense[];
  currentUserId: string;
  loading?: boolean;
  // Không truyền = chỉ đọc (trang chia sẻ công khai, mức 2): không đánh dấu
  // "đã trả", không đổi thủ quỹ.
  onSettle?: (input: NewExpense) => Promise<void>;
  onTreasurerChange?: (travelerId: string) => void;
}

export function SettlementTab({
  trip,
  expenses,
  currentUserId,
  loading = false,
  onSettle,
  onTreasurerChange,
}: SettlementTabProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingPaid, setPendingPaid] = useState<Transfer | null>(null);

  const rows = personCosts(expenses, trip.travelers, trip.currency);
  const byId = new Map(rows.map((row) => [row.travelerId, row]));
  // `balances()` chạy lại đúng `personCosts()` — lấy thẳng từ `rows` thay vì
  // quét toàn bộ sổ chi tiêu lần thứ hai.
  const result = Object.fromEntries(rows.map((row) => [row.travelerId, row.balance]));

  // Thủ quỹ lưu trên trip để cả nhóm nhìn thấy cùng một người, không phải state
  // cục bộ của từng máy (S5).
  // Chỉ người lớn được làm thủ quỹ: khi mọi số dư bằng 0, `pickTreasurer` lấy
  // id nhỏ nhất và id đó có thể là một đứa trẻ — trong khi ô chọn bên dưới chỉ
  // liệt kê người lớn, nên value sẽ không khớp option nào.
  const adultBalances = Object.fromEntries(
    rows.filter((row) => !trip.travelers.find((traveler) => traveler.id === row.travelerId)?.isChild)
      .map((row) => [row.travelerId, row.balance]),
  );
  const treasurerId = trip.treasurerId ?? pickTreasurer(adultBalances) ?? '';
  const transfers = treasurerId ? settleViaTreasurer(result, treasurerId) : [];
  const settled = transfers.length === 0 && expenses.length > 0;
  const hasSettlements = rows.some((row) => row.settled !== 0);

  const adults = trip.travelers.filter((traveler) => !traveler.isChild);
  const nameOf = (id: string): string => {
    const traveler = trip.travelers.find((candidate) => candidate.id === id);
    return traveler?.fullName ?? traveler?.initials ?? '?';
  };

  const childrenOfAdult = (adultId: string): Traveler[] =>
    trip.travelers.filter((traveler) => traveler.isChild && traveler.guardianId === adultId);
  const sharedChildren = trip.travelers.filter(
    (traveler) =>
      traveler.isChild &&
      !trip.travelers.some((adult) => !adult.isChild && adult.id === traveler.guardianId),
  );

  async function markPaid(transfer: Transfer): Promise<void> {
    if (!onSettle) return;
    const key = `${transfer.fromId}-${transfer.toId}`;
    setBusy(key);
    try {
      await onSettle(
        buildSettlementExpense(transfer, trip.id, todayISO(), currentUserId),
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading || expenses.length === 0) {
    return (
      <p className="m-0 rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center text-[13px] text-ink-soft">
        {loading ? t('settlement.list.loading') : t('settlement.settle.empty')}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* Bảng 1 — trả lời "bé nào hết bao nhiêu tiền" */}
      <section className="rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-4 py-3">
          <h3 className="m-0 font-display text-[14px] font-bold text-ink">
            {t('settlement.settle.perPersonTitle')}
          </h3>
          <p className="m-0 mt-0.5 text-[11.5px] text-ink-soft">{t('settlement.settle.perPersonHint')}</p>
        </div>

        {/* Dưới lg bảng 7 cột bị cắt mất đúng cột Số dư — con số quan trọng
            nhất của cả màn. Đổi sang thẻ, số dư đưa lên đầu. */}
        <ul className="m-0 list-none space-y-3 p-3 lg:hidden">
          {adults.map((adult) => {
            const row = byId.get(adult.id)!;
            return (
              <li key={adult.id} className="rounded-xl border border-line p-3">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="font-display text-[14px] font-bold text-ink">{nameOf(adult.id)}</span>
                  <span
                    className={`font-mono text-[15px] font-bold ${
                      row.balance === 0 ? 'text-ink-soft' : row.balance > 0 ? 'text-mint-dark' : 'text-coral-dark'
                    }`}
                  >
                    {formatSignedPrecise(row.balance, trip.currency)}
                  </span>
                </div>
                <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12px]">
                  <Cell label={t('settlement.settle.ownShare')} value={formatPrecise(row.ownShare, trip.currency)} />
                  {row.childBurden !== 0 && (
                    <Cell label={t('settlement.settle.childBurden')} value={formatPrecise(row.childBurden, trip.currency)} />
                  )}
                  <Cell label={t('settlement.settle.payable')} value={formatPrecise(row.payable, trip.currency)} />
                  <Cell label={t('settlement.settle.paid')} value={formatPrecise(row.paid, trip.currency)} />
                  {row.settled !== 0 && (
                    <Cell
                      label={t('settlement.settle.settled')}
                      value={formatSignedPrecise(row.settled, trip.currency)}
                    />
                  )}
                </dl>
                {childrenOfAdult(adult.id).map((child) => (
                  <p key={child.id} className="m-0 mt-1.5 border-t border-line pt-1.5 text-[11.5px] text-ink-soft">
                    └ {nameOf(child.id)} <span aria-hidden>👶</span>{' '}
                    <span className="font-mono">{formatPrecise(byId.get(child.id)?.ownShare ?? 0, trip.currency)}</span>{' '}
                    · {t('settlement.settle.paidByGuardian', { name: nameOf(adult.id) })}
                  </p>
                ))}
              </li>
            );
          })}
          {sharedChildren.map((child) => (
            <li key={child.id} className="rounded-xl border border-dashed border-line p-3 text-[12px] text-ink-soft">
              {nameOf(child.id)} <span aria-hidden>👶</span>{' '}
              <span className="font-mono">{formatPrecise(byId.get(child.id)?.ownShare ?? 0, trip.currency)}</span> ·{' '}
              {t('settlement.settle.paidByAdults')}
            </li>
          ))}
        </ul>

        <table className="hidden w-full border-collapse text-[13px] lg:table">
          <thead>
            <tr className="border-b border-line bg-surface text-left">
              <th className="px-4 py-2 font-semibold text-ink-soft">{t('settlement.settle.person')}</th>
              <th className="px-4 py-2 text-right font-semibold text-ink-soft">{t('settlement.settle.ownShare')}</th>
              <th className="px-4 py-2 text-right font-semibold text-ink-soft">{t('settlement.settle.childBurden')}</th>
              <th className="px-4 py-2 text-right font-semibold text-ink-soft">{t('settlement.settle.payable')}</th>
              <th className="px-4 py-2 text-right font-semibold text-ink-soft">{t('settlement.settle.paid')}</th>
              {hasSettlements && (
                <th className="px-4 py-2 text-right font-semibold text-ink-soft">{t('settlement.settle.settled')}</th>
              )}
              <th className="px-4 py-2 text-right font-semibold text-ink-soft">{t('settlement.settle.balance')}</th>
            </tr>
          </thead>
          <tbody>
            {adults.map((adult) => {
              const row = byId.get(adult.id)!;
              return (
                <Fragment key={adult.id}>
                  <tr className="border-b border-line">
                    <td className="px-4 py-2 font-semibold text-ink">{nameOf(adult.id)}</td>
                    <td className="px-4 py-2 text-right font-mono text-ink-soft">
                      {formatPrecise(row.ownShare, trip.currency)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-ink-soft">
                      {row.childBurden === 0 ? '—' : formatPrecise(row.childBurden, trip.currency)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-ink">{formatPrecise(row.payable, trip.currency)}</td>
                    <td className="px-4 py-2 text-right font-mono text-ink">{formatPrecise(row.paid, trip.currency)}</td>
                    {hasSettlements && (
                      <td className="px-4 py-2 text-right font-mono text-ink-soft">
                        {row.settled === 0
                          ? '—'
                          : formatSignedPrecise(row.settled, trip.currency)}
                      </td>
                    )}
                    <td
                      className={`px-4 py-2 text-right font-mono font-bold ${
                        row.balance === 0 ? 'text-ink-soft' : row.balance > 0 ? 'text-mint-dark' : 'text-coral-dark'
                      }`}
                    >
                      {formatSignedPrecise(row.balance, trip.currency)}
                    </td>
                  </tr>

                  {/* Trẻ em thụt vào dưới người lớn phụ trách: có chi phí, không
                      có nghĩa vụ trả — ba cột cuối bỏ trống (S2). */}
                  {childrenOfAdult(adult.id).map((child) => (
                    <tr key={child.id} className="border-b border-line bg-surface/40">
                      <td className="px-4 py-1.5 pl-8 text-ink-soft">
                        └ {nameOf(child.id)} <span aria-hidden>👶</span>
                      </td>
                      <td className="px-4 py-1.5 text-right font-mono text-ink-soft">
                        {formatPrecise(byId.get(child.id)?.ownShare ?? 0, trip.currency)}
                      </td>
                      <td className="px-4 py-1.5 text-[11.5px] text-ink-soft" colSpan={hasSettlements ? 5 : 4}>
                        {t('settlement.settle.paidByGuardian', { name: nameOf(adult.id) })}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}

            {sharedChildren.length > 0 && (
              <Fragment>
                <tr className="border-b border-line bg-surface/40">
                  <td colSpan={hasSettlements ? 7 : 6} className="px-4 py-1.5 text-[11.5px] font-semibold text-ink-soft">
                    {t('settlement.settle.sharedChildren')}
                  </td>
                </tr>
                {sharedChildren.map((child) => (
                  <tr key={child.id} className="border-b border-line bg-surface/40">
                    <td className="px-4 py-1.5 pl-8 text-ink-soft">
                      {nameOf(child.id)} <span aria-hidden>👶</span>
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono text-ink-soft">
                      {formatPrecise(byId.get(child.id)?.ownShare ?? 0, trip.currency)}
                    </td>
                    <td className="px-4 py-1.5 text-[11.5px] text-ink-soft" colSpan={hasSettlements ? 5 : 4}>
                      {t('settlement.settle.paidByAdults')}
                    </td>
                  </tr>
                ))}
              </Fragment>
            )}
          </tbody>
        </table>
      </section>

      {/* Bảng 2 — ai chuyển cho thủ quỹ bao nhiêu */}
      <section className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="m-0 font-display text-[14px] font-bold text-ink">{t('settlement.settle.transfersTitle')}</h3>
          <label className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-soft">
            {t('settlement.settle.treasurer')}
            {onTreasurerChange ? (
              <select
                value={treasurerId}
                onChange={(event) => onTreasurerChange(event.target.value)}
                className="rounded-lg border border-line bg-white px-2 py-1.5 text-[12.5px] font-semibold text-ink outline-none focus:border-ocean"
              >
                {adults.map((adult) => (
                  <option key={adult.id} value={adult.id}>
                    {nameOf(adult.id)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-ink">{treasurerId ? nameOf(treasurerId) : '—'}</span>
            )}
          </label>
          {onTreasurerChange && <span className="text-[11.5px] text-ink-soft">{t('settlement.settle.treasurerHint')}</span>}
        </div>

        {settled ? (
          <div className="rounded-xl bg-mint-tint p-4">
            <p className="m-0 text-[13px] font-semibold text-mint-dark">{t('settlement.settle.doneTitle')}</p>
            {trip.status !== 'done' && (
              <p className="m-0 mt-1 text-[12.5px] text-mint-dark">{t('settlement.settle.doneHint')}</p>
            )}
          </div>
        ) : (
          <>
            <ul className="m-0 list-none space-y-2 p-0">
              {transfers.map((transfer) => {
                const key = `${transfer.fromId}-${transfer.toId}`;
                return (
                  <li key={key} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2">
                    <span className="min-w-0 flex-1 text-[13px] text-ink">
                      <strong>{nameOf(transfer.fromId)}</strong> → <strong>{nameOf(transfer.toId)}</strong>
                    </span>
                    <span className="font-mono text-[14px] font-bold text-ink">
                      {formatPrecise(transfer.amount, trip.currency)}
                    </span>
                    {onSettle && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => setPendingPaid(transfer)}
                      className="rounded-lg border border-ocean bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ocean-dark transition disabled:cursor-not-allowed disabled:border-line disabled:text-ink-soft"
                    >
                      {busy === key ? t('itinerary.detail.saving') : t('settlement.settle.markPaid')}
                    </button>
                    )}
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(settlementText(
                    transfers,
                    trip.travelers,
                    trip.currency,
                    t('settlement.settle.copyHeading', { name: trip.name }),
                  ))
                  .then(() => setCopied(true));
              }}
              className="mt-3 flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] font-semibold text-ink"
            >
              <ContentCopyRoundedIcon sx={{ fontSize: 15 }} />
              {copied ? t('settlement.settle.copied') : t('settlement.settle.copy')}
            </button>
          </>
        )}
      </section>

      <Dialog open={pendingPaid !== null} onClose={() => setPendingPaid(null)}>
        <DialogTitle>{t('settlement.settle.markPaidTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingPaid &&
              t('settlement.settle.markPaidBody', {
                from: nameOf(pendingPaid.fromId),
                to: nameOf(pendingPaid.toId),
                amount: formatPrecise(pendingPaid.amount, trip.currency),
              })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingPaid(null)}>{t('itinerary.detail.cancel')}</Button>
          <Button
            onClick={() => {
              const transfer = pendingPaid;
              setPendingPaid(null);
              if (transfer) void markPaid(transfer);
            }}
          >
            {t('settlement.settle.markPaidConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="m-0 text-right font-mono text-ink">{value}</dd>
    </>
  );
}
