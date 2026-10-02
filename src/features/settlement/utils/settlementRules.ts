import type {
  CostCategory,
  Currency,
  Expense,
  ExpenseShare,
  PartySize,
  Traveler,
  BudgetNode,
} from '../../../types';
import { COST_CATEGORIES } from '../../../types';
import { nodeTotal, rootAncestorOf, rootsOf, totalsByCategory } from '../../budget/utils/budgetRules';
import { formatPrecise, fromPreciseUnits, toPreciseUnits } from '../../budget/utils/money';

// Quy tắc chia tiền & quyết toán — docs/features/trip-budget.md S2–S7.
// Mọi hàm THUẦN: không API, không đồng hồ, không sinh id.

// ---------------------------------------------------------------------------
// S3 — chia đều và quy tắc phần dư
// ---------------------------------------------------------------------------

// Hàm quan trọng nhất của cả file. Quy tắc phần dư phải nằm ở ĐÚNG MỘT chỗ:
// nó được dùng lại ở chia đều (giai đoạn 1) và ở chia lại suất trẻ em (giai
// đoạn 2). Hai chỗ mà hai cách làm tròn là hai cách để Σ ≠ tổng.
//
// Làm việc trên SỐ NGUYÊN (đơn vị bất kỳ — ở đây là "đơn vị chính xác" 0,01).
// Chia phần nguyên trước, phần dư phát 1 đơn vị cho mỗi người theo thứ tự
// travelerId tăng dần, BẮT ĐẦU từ vị trí `offset`. Trước đây phần dư luôn rơi
// vào người có id nhỏ nhất, nên qua vài chục khoản người đó bị lệch cộng dồn;
// xoay vòng theo từng khoản (xem `remainderOffset`) thì lệch không tích luỹ.
export function spreadEvenly(total: number, travelerIds: string[], offset = 0): Record<string, number> {
  const ids = [...travelerIds].sort();
  if (ids.length === 0) {
    return {};
  }

  const base = Math.trunc(total / ids.length);
  const remainder = total - base * ids.length;
  const start = ((offset % ids.length) + ids.length) % ids.length;

  return Object.fromEntries(
    ids.map((id, index) => {
      const position = (index - start + ids.length) % ids.length;
      return [id, base + (position < remainder ? 1 : 0)];
    }),
  );
}

// Điểm bắt đầu phát phần dư — băm từ id của khoản chi nên ổn định (tính lại
// bao nhiêu lần cũng ra cùng kết quả) nhưng khác nhau giữa các khoản.
export function remainderOffset(seed: string): number {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

export function validateExactShares(expense: Expense): { ok: true } | { ok: false; diff: number } {
  const sum = expense.shares.reduce((total, share) => total + (share.amount ?? 0), 0);
  return sum === expense.amount ? { ok: true } : { ok: false, diff: expense.amount - sum };
}

// ---------------------------------------------------------------------------
// Đơn vị tính toán. Số tiền NHẬP là số nguyên đơn vị nhỏ nhất; mọi phép CHIA
// chạy trên số nguyên "đơn vị chính xác" (0,01 yên, 0,01 đô) rồi mới đổi về.
// Nhờ vậy kết quả cuối chính xác tới 2 chữ số thập phân mà các bất biến về
// tổng vẫn đúng tuyệt đối (cộng số nguyên, không cộng số thực).
// ---------------------------------------------------------------------------

type Units = Record<string, number>;

function unitsToMinor(units: Units, currency: Currency): Record<string, number> {
  return Object.fromEntries(
    Object.entries(units).map(([id, value]) => [id, fromPreciseUnits(value, currency)]),
  );
}

function allocateUnits(expense: Expense, currency: Currency): Units {
  if (expense.splitMode === 'equal') {
    return spreadEvenly(
      toPreciseUnits(expense.amount, currency),
      expense.shares.map((share) => share.travelerId),
      remainderOffset(expense.id),
    );
  }

  return Object.fromEntries(
    expense.shares.map((share) => [share.travelerId, toPreciseUnits(share.amount ?? 0, currency)]),
  );
}

function payableUnits(alloc: Units, expense: Expense, travelers: Traveler[]): Units {
  const byId = new Map(travelers.map((traveler) => [traveler.id, traveler]));
  const isChild = (id: string): boolean => Boolean(byId.get(id)?.isChild);
  const allAdults = travelers.filter((traveler) => !traveler.isChild).map((traveler) => traveler.id);

  const out: Units = {};
  for (const [id, amount] of Object.entries(alloc)) {
    if (!isChild(id)) {
      out[id] = (out[id] ?? 0) + amount;
    }
  }

  for (const [childId, amount] of Object.entries(alloc)) {
    if (!isChild(childId) || amount === 0) {
      continue;
    }

    const guardianId = byId.get(childId)?.guardianId;
    // Người phụ trách phải còn tồn tại và phải là người lớn — nếu không thì
    // coi như chưa gán, chứ không đánh rơi tiền.
    const guardian = guardianId ? byId.get(guardianId) : undefined;
    if (guardian && !guardian.isChild) {
      out[guardian.id] = (out[guardian.id] ?? 0) + amount;
      continue;
    }

    const adultsHere = expense.shares
      .map((share) => share.travelerId)
      .filter((id) => !isChild(id) && byId.has(id));
    const targets = adultsHere.length > 0 ? adultsHere : allAdults;

    if (targets.length === 0) {
      // Không có người lớn nào để gánh: giữ nguyên ở trẻ để tổng không hụt.
      out[childId] = (out[childId] ?? 0) + amount;
      continue;
    }

    for (const [id, part] of Object.entries(
      spreadEvenly(amount, targets, remainderOffset(`${expense.id}:${childId}`)),
    )) {
      out[id] = (out[id] ?? 0) + part;
    }
  }

  for (const traveler of travelers) {
    if (traveler.isChild && out[traveler.id] === undefined) {
      out[traveler.id] = 0;
    }
  }

  return out;
}

// Giai đoạn 1 — khoản này chi cho ai, mỗi người bao nhiêu. KỂ CẢ TRẺ EM: đây
// chính là con số trả lời "bé nào hết bao nhiêu tiền" (S2.2).
// Kết quả theo đơn vị nhỏ nhất, chính xác tới 0,01 (¥1,000 / 3 = 333.34 +
// 333.33 + 333.33). Bất biến: Σ === expense.amount.
export function allocateExpense(expense: Expense, currency: Currency = 'JPY'): Record<string, number> {
  return unitsToMinor(allocateUnits(expense, currency), currency);
}

// Giai đoạn 2 — ai THẬT SỰ phải trả tiền. Suất của trẻ em chuyển sang người
// lớn: theo `guardianId` nếu hợp lệ, không thì chia đều cho các người lớn có
// mặt trong chính khoản đó, và nếu khoản đó không có người lớn nào (vé vào cửa
// trẻ em) thì chia đều cho tất cả người lớn của chuyến (S2.3).
// Bất biến: Σ === expense.amount, và mọi trẻ em === 0.
export function toPayableShares(
  alloc: Record<string, number>,
  expense: Expense,
  travelers: Traveler[],
  currency: Currency = 'JPY',
): Record<string, number> {
  const units = Object.fromEntries(
    Object.entries(alloc).map(([id, value]) => [id, toPreciseUnits(value, currency)]),
  );
  return unitsToMinor(payableUnits(units, expense, travelers), currency);
}

// ---------------------------------------------------------------------------
// Báo cáo theo người (bảng 1 của tab Quyết toán)
// ---------------------------------------------------------------------------

export interface PersonCost {
  travelerId: string;
  ownShare: number; // suất của chính mình — TRẺ EM CÓ SỐ NÀY
  childBurden: number; // gánh thêm cho trẻ em
  payable: number; // ownShare + childBurden; trẻ em = 0
  paid: number; // đã ứng ra (chỉ kind='expense')
  settled: number; // đã trả bù − đã nhận bù (kind='settlement')
  balance: number; // paid − payable + settled
}

// Mọi cột đều tính theo đơn vị nhỏ nhất, chính xác tới 0,01 (có thể lẻ với
// JPY/VND). Cộng dồn bằng số nguyên đơn vị chính xác rồi mới đổi về một lần,
// để Σ balance === 0 đúng tuyệt đối.
export function personCosts(
  expenses: Expense[],
  travelers: Traveler[],
  currency: Currency = 'JPY',
): PersonCost[] {
  const rows = new Map<string, PersonCost>(
    travelers.map((traveler) => [
      traveler.id,
      {
        travelerId: traveler.id,
        ownShare: 0,
        childBurden: 0,
        payable: 0,
        paid: 0,
        settled: 0,
        balance: 0,
      },
    ]),
  );
  const touch = (id: string): PersonCost | undefined => rows.get(id);

  for (const expense of expenses) {
    const amount = toPreciseUnits(expense.amount, currency);

    if (expense.kind === 'settlement') {
      // Chuyển tiền nội bộ: không phải chi tiêu mới, không vào cột "gánh".
      const sender = touch(expense.payerId);
      if (sender) sender.settled += amount;
      for (const share of expense.shares) {
        const receiver = touch(share.travelerId);
        if (receiver) receiver.settled -= amount;
      }
      continue;
    }

    const alloc = allocateUnits(expense, currency);
    const payable = payableUnits(alloc, expense, travelers);
    for (const [id, value] of Object.entries(alloc)) {
      const row = touch(id);
      if (row) row.ownShare += value;
    }
    for (const [id, value] of Object.entries(payable)) {
      const row = touch(id);
      if (row) row.payable += value;
    }
    const payer = touch(expense.payerId);
    if (payer) payer.paid += amount;
  }

  return [...rows.values()].map((row) => {
    const childBurden = row.payable - row.ownShare;
    const balance = row.paid - row.payable + row.settled;
    return {
      travelerId: row.travelerId,
      ownShare: fromPreciseUnits(row.ownShare, currency),
      childBurden: fromPreciseUnits(childBurden, currency),
      payable: fromPreciseUnits(row.payable, currency),
      paid: fromPreciseUnits(row.paid, currency),
      settled: fromPreciseUnits(row.settled, currency),
      balance: fromPreciseUnits(balance, currency),
    };
  });
}

// S4 — Bất biến: Σ balance === 0, và balance của trẻ em === 0.
export function balances(
  expenses: Expense[],
  travelers: Traveler[],
  currency: Currency = 'JPY',
): Record<string, number> {
  return Object.fromEntries(
    personCosts(expenses, travelers, currency).map((row) => [row.travelerId, row.balance]),
  );
}

// ---------------------------------------------------------------------------
// S5 — quyết toán qua thủ quỹ
// ---------------------------------------------------------------------------

export interface Transfer {
  fromId: string;
  toId: string;
  amount: number;
}

// Thủ quỹ mặc định = người ứng ra nhiều nhất so với phần mình gánh. Hoà thì
// lấy id nhỏ nhất để kết quả tái lập được.
export function pickTreasurer(input: Record<string, number>): string | null {
  const entries = Object.entries(input).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    return null;
  }
  return entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
}

export function settleViaTreasurer(
  input: Record<string, number>,
  treasurerId: string,
): Transfer[] {
  const entries = Object.entries(input)
    .filter(([id, amount]) => id !== treasurerId && amount !== 0)
    .sort(([a], [b]) => a.localeCompare(b));

  return [
    // Người còn nợ chuyển cho thủ quỹ...
    ...entries
      .filter(([, amount]) => amount < 0)
      .map(([id, amount]) => ({ fromId: id, toId: treasurerId, amount: -amount })),
    // ...rồi thủ quỹ trả lại cho người đã ứng ra.
    ...entries
      .filter(([, amount]) => amount > 0)
      .map(([id, amount]) => ({ fromId: treasurerId, toId: id, amount })),
  ];
}

// S6 — "Đã trả" ghi thành một bản ghi, không phải cờ trạng thái.
export function buildSettlementExpense(
  transfer: Transfer,
  tripId: string,
  date: string,
  createdBy: string,
): Omit<Expense, 'id' | 'createdAt'> {
  return {
    tripId,
    kind: 'settlement',
    date,
    category: 'other',
    title: 'settlement',
    amount: transfer.amount,
    payerId: transfer.fromId,
    splitMode: 'exact',
    shares: [{ travelerId: transfer.toId, amount: transfer.amount }],
    createdBy,
  };
}

// `heading` do UI truyền vào (đã dịch) — file quy tắc không biết ngôn ngữ.
export function settlementText(
  transfers: Transfer[],
  travelers: Traveler[],
  currency: Currency,
  heading: string,
): string {
  const nameOf = (id: string): string => {
    const traveler = travelers.find((candidate) => candidate.id === id);
    return traveler?.fullName ?? traveler?.initials ?? id;
  };

  const lines = transfers.map(
    (transfer) => `- ${nameOf(transfer.fromId)} → ${nameOf(transfer.toId)}: ${formatPrecise(transfer.amount, currency)}`,
  );

  return [heading, ...lines].join('\n');
}

// ---------------------------------------------------------------------------
// S7 — đối chiếu dự trù vs thực tế
// ---------------------------------------------------------------------------

export interface VarianceRow {
  category: CostCategory;
  planned: number;
  actual: number;
  diff: number;
  diffRatio: number | null; // null khi planned = 0 — không chia cho 0
}

export function actualByCategory(expenses: Expense[]): Record<CostCategory, number> {
  const totals = Object.fromEntries(COST_CATEGORIES.map((category) => [category, 0])) as Record<
    CostCategory,
    number
  >;

  for (const expense of expenses) {
    // Chuyển tiền nội bộ không phải chi tiêu mới.
    if (expense.kind === 'settlement') continue;
    totals[expense.category] += expense.amount;
  }

  return totals;
}

export function varianceByCategory(
  plan: BudgetNode[],
  expenses: Expense[],
  party: PartySize,
): VarianceRow[] {
  const planned = totalsByCategory(plan, party);
  const actual = actualByCategory(expenses);

  return COST_CATEGORIES.map((category) => ({
    category,
    planned: planned[category],
    actual: actual[category],
    diff: actual[category] - planned[category],
    diffRatio: planned[category] === 0 ? null : (actual[category] - planned[category]) / planned[category],
  }));
}

export function totalSpent(expenses: Expense[]): number {
  return expenses
    .filter((expense) => expense.kind === 'expense')
    .reduce((total, expense) => total + expense.amount, 0);
}

// Gợi ý phần chia khi mở form: chia đều cho mọi thành viên đang có.
export function defaultShares(travelers: Traveler[]): ExpenseShare[] {
  return travelers.map((traveler) => ({ travelerId: traveler.id }));
}

// S7 mức 2 — mở rộng một loại chi phí xuống từng khoản dự trù.
export interface NodeVarianceRow {
  nodeId: string | null; // null = "Khác trong nhóm này"
  title: string;
  planned: number;
  actual: number;
  diff: number;
}

export function varianceByNode(
  plan: BudgetNode[],
  expenses: Expense[],
  party: PartySize,
  category: CostCategory,
): NodeVarianceRow[] {
  const roots = rootsOf(plan).filter((node) => node.category === category);

  const actualByRoot = new Map<string, number>();
  let unlinked = 0;

  for (const expense of expenses) {
    if (expense.kind === 'settlement' || expense.category !== category) {
      continue;
    }

    // Gom về node GỐC của nhánh: chi tiêu có thể gắn vào một mục con, cộng ở
    // mọi mức là đếm trùng.
    const root = expense.budgetNodeId ? rootAncestorOf(plan, expense.budgetNodeId) : undefined;
    if (root && root.category === category) {
      actualByRoot.set(root.id, (actualByRoot.get(root.id) ?? 0) + expense.amount);
    } else {
      unlinked += expense.amount;
    }
  }

  const rows: NodeVarianceRow[] = roots.map((node) => {
    const planned = nodeTotal(node, plan, party);
    const actual = actualByRoot.get(node.id) ?? 0;
    return { nodeId: node.id, title: node.title, planned, actual, diff: actual - planned };
  });

  // Luôn hiện dòng "Khác" khi có chi tiêu chưa gắn khoản nào — im lặng bỏ qua
  // thì tổng của bảng mức 2 sẽ không khớp bảng mức 1.
  if (unlinked > 0 || rows.length === 0) {
    rows.push({ nodeId: null, title: '', planned: 0, actual: unlinked, diff: unlinked });
  }

  return rows;
}
