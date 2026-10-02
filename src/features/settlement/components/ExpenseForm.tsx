import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CostCategory, Expense, SplitMode, Traveler, Trip } from '../../../types';
import { COST_CATEGORIES } from '../../../types';
import { COST_CATEGORY_CLASSES } from '../../budget/utils/budgetCategories';
import { MoneyInput } from '../../budget/components/MoneyInput';
import { formatMoney, formatPrecise, fromPreciseUnits, toPreciseUnits } from '../../budget/utils/money';
import { remainderOffset, spreadEvenly } from '../utils/settlementRules';
import { nodesForCategory } from '../../budget/utils/budgetRules';
import type { NewExpense } from '../api/expenseApi';
import { todayISO } from '../../../utils/dateFormat';

interface ExpenseFormProps {
  trip: Trip;
  currentUserId: string;
  initial?: Expense;
  onSubmit: (input: NewExpense, keepOpen: boolean) => Promise<void>;
  onCancel: () => void;
}

// Form này được dùng khi đang ĐỨNG Ở QUẦY THANH TOÁN. Mọi quyết định thiết kế
// ở đây phục vụ một mục tiêu: ghi xong một khoản dưới 10 giây (§9.2).
export function ExpenseForm({ trip, currentUserId, initial, onSubmit, onCancel }: ExpenseFormProps) {
  const { t } = useTranslation();

  // Trẻ em không ứng tiền: ô chọn chỉ liệt kê người lớn, nên giá trị mặc định
  // cũng phải là người lớn — nếu không, state giữ id của trẻ trong khi ô hiển
  // thị tên người lớn đầu tiên, và khoản chi lưu xuống với payerId là trẻ (S2).
  // Người đã rời nhóm vẫn hiện nếu khoản đang sửa có dính tới họ — kể cả khi
  // họ chỉ là người trả, không nằm trong phần chia. Nếu không, ô chọn người
  // trả hiện tên người khác còn nút Lưu bị khoá mà không rõ lý do.
  const active = trip.travelers.filter(
    (traveler) =>
      !traveler.leftGroup ||
      traveler.id === initial?.payerId ||
      initial?.shares.some((share) => share.travelerId === traveler.id),
  );
  const adults = active.filter((traveler) => !traveler.isChild);
  const me = adults.find((traveler) => traveler.userId === currentUserId);
  const [amount, setAmount] = useState<number | undefined>(initial?.amount);
  const [category, setCategory] = useState<CostCategory>(initial?.category ?? 'food');
  const [payerId, setPayerId] = useState<string>(initial?.payerId ?? me?.id ?? adults[0]?.id ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [budgetNodeId, setBudgetNodeId] = useState<string>(initial?.budgetNodeId ?? '');
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [splitMode, setSplitMode] = useState<SplitMode>(initial?.splitMode ?? 'equal');
  const [selected, setSelected] = useState<string[]>(
    initial?.shares.map((share) => share.travelerId) ?? active.map((traveler) => traveler.id),
  );
  const [exact, setExact] = useState<Record<string, number | undefined>>(
    Object.fromEntries((initial?.shares ?? []).map((share) => [share.travelerId, share.amount])),
  );
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // "Lưu và ghi tiếp" chỉ xoá trắng form — thiếu dòng này người dùng không chắc
  // khoản vừa rồi đã được ghi chưa.
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Xem trước phần chia đều — cùng độ chính xác 0,01 với lúc quyết toán. Khoản
  // đang sửa thì dùng đúng offset phần dư của nó để số xem trước khớp số thật.
  const equalSplit = useMemo(() => {
    const units = spreadEvenly(
      toPreciseUnits(amount ?? 0, trip.currency),
      selected,
      initial ? remainderOffset(initial.id) : 0,
    );
    return Object.fromEntries(
      Object.entries(units).map(([id, value]) => [id, fromPreciseUnits(value, trip.currency)]),
    );
  }, [amount, selected, trip.currency, initial]);
  // Gắn khoản chi với một khoản dự trù là TUỲ CHỌN — lúc đang trả tiền không ai
  // muốn đi tìm đúng dòng trong cây. Nó chỉ để đối chiếu chi tiết hơn (S1).
  const budgetOptions = useMemo(
    () => nodesForCategory(trip.budgetPlan, category),
    [trip.budgetPlan, category],
  );

  const exactSum = selected.reduce((total, id) => total + (exact[id] ?? 0), 0);
  const remaining = (amount ?? 0) - exactSum;
  const payerIsAdult = adults.some((traveler) => traveler.id === payerId);
  const blocked =
    !amount ||
    amount <= 0 ||
    date === '' ||
    selected.length === 0 ||
    !payerIsAdult ||
    (splitMode === 'exact' && remaining !== 0);

  function toggle(id: string): void {
    setSelected((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    );
  }

  // Chuyển sang "Nhập riêng" thì điền sẵn số của chế độ chia đều — user chỉ sửa
  // người nào khác đi, không phải gõ lại từ đầu cả 4 con số.
  function switchMode(next: SplitMode): void {
    if (next === 'exact') {
      // Ô nhập riêng nhận số nguyên đơn vị nhỏ nhất, nên điền sẵn bản chia
      // phần nguyên (tổng vẫn khớp tuyệt đối).
      setExact(spreadEvenly(amount ?? 0, selected));
    }
    setSplitMode(next);
  }

  function guardianLabel(traveler: Traveler): string | null {
    if (!traveler.isChild) {
      return null;
    }
    const guardian = trip.travelers.find((candidate) => candidate.id === traveler.guardianId);
    return guardian
      ? t('settlement.form.paidByGuardian', { name: guardian.fullName ?? guardian.initials })
      : t('settlement.form.paidByAdults');
  }

  async function submit(keepOpen: boolean): Promise<void> {
    if (blocked || saving) {
      return;
    }

    setSaving(true);
    setSubmitError(null);
    const savedTitle = title.trim() || t('itinerary.step4.category.' + category);
    try {
      await onSubmit(
        {
          tripId: trip.id,
          kind: 'expense',
          date,
          category,
          title: savedTitle,
          ...(note.trim() === '' ? {} : { note: note.trim() }),
          ...(budgetNodeId === '' ? {} : { budgetNodeId }),
          amount: amount!,
          payerId,
          splitMode,
          shares: selected.map((id) => ({
            travelerId: id,
            ...(splitMode === 'exact' ? { amount: exact[id] ?? 0 } : {}),
          })),
          createdBy: currentUserId,
        },
        keepOpen,
      );

      if (keepOpen) {
        // Chi tiêu hay đi theo chùm: giữ nguyên loại và người trả, chỉ xoá số.
        setLastSaved(t('settlement.form.savedLine', { title: savedTitle, amount: formatMoney(amount!, trip.currency) }));
        setAmount(undefined);
        setTitle('');
        setNote('');
        setExact({});
      }
    } catch {
      // Giữ nguyên dữ liệu đã nhập để bấm lại được.
      setSubmitError(t('settlement.form.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="m-0 mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-ink-soft">
          {t('settlement.form.amount')}
        </p>
        <MoneyInput
          value={amount}
          currency={trip.currency}
          ariaLabel={t('settlement.form.amount')}
          onChange={setAmount}
          className="!py-3 !text-right !text-[26px] !font-bold"
        />
      </div>

      <div>
        <p className="m-0 mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-soft">
          {t('settlement.form.category')}
        </p>
        <div className="flex flex-wrap gap-2">
          {COST_CATEGORIES.map((key) => {
            const active = key === category;
            const colors = COST_CATEGORY_CLASSES[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setCategory(key);
                  setBudgetNodeId('');
                }}
                className={`flex min-h-[40px] items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition ${
                  active ? `${colors.border} ${colors.tint} ${colors.text}` : 'border-line bg-white text-ink-soft'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                {t(`itinerary.step4.category.${key}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-soft">
          {t('settlement.form.payer')}
          <select
            value={payerId}
            onChange={(event) => setPayerId(event.target.value)}
            className="mt-1 block w-full rounded-lg border border-line bg-white px-2 py-2 text-[13px] font-normal normal-case tracking-normal text-ink outline-none focus:border-ocean"
          >
            {adults.map((traveler) => (
              <option key={traveler.id} value={traveler.id}>
                {traveler.fullName ?? traveler.initials}
              </option>
            ))}
          </select>
        </label>

        <label className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-soft">
          {t('settlement.form.date')}
          <input
            type="date"
            required
            value={date}
            aria-invalid={date === ''}
            onChange={(event) => setDate(event.target.value)}
            className={`mt-1 block w-full rounded-lg border bg-white px-2 py-2 text-[13px] font-normal normal-case tracking-normal text-ink outline-none focus:border-ocean ${
              date === '' ? 'border-coral' : 'border-line'
            }`}
          />
          {date === '' && (
            <span className="mt-1 block text-[11.5px] font-normal normal-case tracking-normal text-coral-dark">
              {t('settlement.form.dateRequired')}
            </span>
          )}
        </label>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <p className="m-0 text-[11.5px] font-semibold uppercase tracking-wide text-ink-soft">
            {t('settlement.form.splitFor')}
          </p>
          {(['equal', 'exact'] as SplitMode[]).map((mode) => (
            <label key={mode} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
              <input
                type="radio"
                name="splitMode"
                checked={splitMode === mode}
                onChange={() => switchMode(mode)}
              />
              {t(`settlement.form.split.${mode}`)}
            </label>
          ))}
        </div>

        <div className="rounded-xl border border-line bg-white">
          {active.map((traveler) => {
            const on = selected.includes(traveler.id);
            const guardian = guardianLabel(traveler);

            return (
              <div
                key={traveler.id}
                className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={on}
                  aria-label={traveler.fullName ?? traveler.initials}
                  onChange={() => toggle(traveler.id)}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                  {traveler.fullName ?? traveler.initials}
                  {guardian && (
                    // Hệ quả của luật trẻ em hiện NGAY LÚC GHI, không đợi tới
                    // lúc quyết toán mới phát hiện ai đang gánh cho bé (S2).
                    <span className="ml-1.5 rounded-full bg-amber-tint px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-dark">
                      {guardian}
                    </span>
                  )}
                </span>

                {on &&
                  (splitMode === 'exact' ? (
                    <span className="w-28">
                      <MoneyInput
                        value={exact[traveler.id]}
                        currency={trip.currency}
                        ariaLabel={`${t('settlement.form.shareOf')} ${traveler.fullName ?? traveler.initials}`}
                        onChange={(value) => setExact((current) => ({ ...current, [traveler.id]: value }))}
                      />
                    </span>
                  ) : (
                    <span className="w-28 text-right font-mono text-[12.5px] text-ink-soft">
                      {formatPrecise(equalSplit[traveler.id] ?? 0, trip.currency)}
                    </span>
                  ))}
              </div>
            );
          })}
        </div>

        {splitMode === 'exact' && (
          <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
            <span
              className={`font-mono text-[12.5px] font-semibold ${
                remaining === 0 ? 'text-mint-dark' : 'text-coral-dark'
              }`}
            >
              {remaining === 0
                ? t('settlement.form.balanced')
                : t('settlement.form.remaining', {
                    amount: formatMoney(Math.abs(remaining), trip.currency),
                    sign: remaining > 0 ? '' : '−',
                  })}
            </span>
            {remaining !== 0 && selected.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setExact((current) => ({
                    ...current,
                    [selected[0]!]: (current[selected[0]!] ?? 0) + remaining,
                  }))
                }
                className="rounded-lg border border-line bg-white px-2 py-1 text-[12px] font-semibold text-ocean-dark"
              >
                {t('settlement.form.dumpRemaining', {
                  name:
                    trip.travelers.find((traveler) => traveler.id === selected[0])?.fullName ??
                    t('settlement.form.firstPerson'),
                })}
              </button>
            )}
          </div>
        )}
      </div>

      <label className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-soft">
        {t('settlement.form.title')}
        <input
          value={title}
          maxLength={80}
          placeholder={t('settlement.form.titlePlaceholder') ?? ''}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-line bg-white px-2 py-2 text-[13px] font-normal normal-case tracking-normal text-ink outline-none focus:border-ocean"
        />
      </label>

      <label className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-soft">
        {t('settlement.form.note')}
        <input
          value={note}
          maxLength={100}
          placeholder={t('settlement.form.notePlaceholder') ?? ''}
          onChange={(event) => setNote(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-line bg-white px-2 py-2 text-[13px] font-normal normal-case tracking-normal text-ink outline-none focus:border-ocean"
        />
      </label>

      {budgetOptions.length > 0 && (
        <label className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-soft">
          {t('settlement.form.budgetNode')}
          <select
            value={budgetNodeId}
            onChange={(event) => setBudgetNodeId(event.target.value)}
            className="mt-1 block w-full rounded-lg border border-line bg-white px-2 py-2 text-[13px] font-normal normal-case tracking-normal text-ink outline-none focus:border-ocean"
          >
            <option value="">{t('settlement.form.budgetNodeNone')}</option>
            {budgetOptions.map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {'\u00A0'.repeat((depth - 1) * 3)}
                {node.title || t('itinerary.step4.untitled')}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Ghim ở chân modal: Paper của Dialog là vùng cuộn, nên sticky giữ hàng
          nút luôn thấy được khi form dài (chia riêng nhiều người). Lề âm khớp
          với p-5 của khung bọc trong Hub/Workspace. */}
      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-1 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-white px-5 py-3">
        {(submitError || lastSaved) && (
          <p
            role={submitError ? 'alert' : 'status'}
            className={`m-0 min-w-0 flex-1 basis-full text-[12px] font-semibold sm:basis-auto ${
              submitError ? 'text-coral-dark' : 'text-mint-dark'
            }`}
          >
            {submitError ?? `✓ ${lastSaved}`}
          </p>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink"
        >
          {t('itinerary.detail.cancel')}
        </button>
        {!initial && (
          <button
            type="button"
            disabled={blocked || saving}
            onClick={() => void submit(true)}
            className="rounded-xl border border-ocean bg-white px-4 py-2.5 text-sm font-semibold text-ocean-dark transition disabled:cursor-not-allowed disabled:border-line disabled:text-ink-soft"
          >
            {t('settlement.form.saveAndNext')}
          </button>
        )}
        <button
          type="button"
          disabled={blocked || saving}
          onClick={() => void submit(false)}
          className="rounded-xl bg-ocean px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ocean-dark disabled:cursor-not-allowed disabled:bg-navy-soft"
        >
          {saving ? t('itinerary.detail.saving') : t('settlement.form.save')}
        </button>
      </div>
    </div>
  );
}
