import type {
  BudgetNode,
  CostCategory,
  Currency,
  ItineraryItem,
  PartySize,
  Place,
  Trip,
} from '../../../types';
import { COST_CATEGORIES } from '../../../types';
import { losesPrecision, minorUnits, rescaleAmount } from './money';
import type { CategoryKey } from '../../places/utils';
import { itemCategory } from '../../itinerary/utils/categoryColors';

// Quy tắc chi phí dự trù — docs/features/trip-budget.md §3, B1–B3.
// Mọi hàm ở đây đều THUẦN: không gọi API, không đọc đồng hồ, không tự sinh id
// (hàm nào cần id thì nhận `makeId` qua tham số) — để test trực tiếp được.

export const MAX_BUDGET_DEPTH = 3;
export const MAX_BUDGET_TITLE_LENGTH = 80;
export const MAX_BUDGET_NOTE_LENGTH = 100;

export interface PerHead {
  adult: number;
  child: number;
}

const ZERO_PER_HEAD: PerHead = { adult: 0, child: 0 };

function omit<T extends object, K extends keyof T>(source: T, keys: K[]): Omit<T, K> {
  const next = { ...source };
  for (const key of keys) {
    delete next[key];
  }
  return next;
}

// §1 — loại chi phí mặc định suy từ category của mục lịch trình. Chỉ là giá trị
// khởi tạo, user đổi được ở Bước 4. Không có luật nào suy ra 'transport': di
// chuyển hiếm khi là một Place nên gần như luôn là khoản user tự tạo.
const CATEGORY_TO_COST: Record<CategoryKey, CostCategory> = {
  hotel: 'lodging',
  restaurant: 'food',
  attraction: 'sightseeing',
  shopping: 'other',
  other: 'other',
};

export function costCategoryForItem(item: ItineraryItem, placesById: Map<string, Place>): CostCategory {
  return CATEGORY_TO_COST[itemCategory(item, placesById)];
}

// ---------------------------------------------------------------------------
// Cấu trúc cây
// ---------------------------------------------------------------------------

// Node "gốc" = parentId null, HOẶC parentId trỏ tới một node không còn tồn tại.
// Coi node mồ côi là gốc để `planTotal` (cộng gốc) và `planPerHead` (cộng lá)
// không bao giờ nói hai chuyện khác nhau về cùng một cây.
export function rootsOf(plan: BudgetNode[]): BudgetNode[] {
  const ids = new Set(plan.map((node) => node.id));
  return plan
    .filter((node) => node.parentId === null || !ids.has(node.parentId))
    .sort((a, b) => a.order - b.order);
}

export function childrenOf(plan: BudgetNode[], nodeId: string | null): BudgetNode[] {
  if (nodeId === null) {
    return rootsOf(plan);
  }
  return plan.filter((node) => node.parentId === nodeId).sort((a, b) => a.order - b.order);
}

export function isLeaf(plan: BudgetNode[], nodeId: string): boolean {
  return !plan.some((node) => node.parentId === nodeId);
}

// Đi ngược lên gốc. `seen` chặn vòng lặp vô hạn nếu dữ liệu từ server bị hỏng —
// thà trả về độ sâu tối đa (khoá nút "Thêm mục con") còn hơn treo cả trang.
export function budgetDepth(plan: BudgetNode[], nodeId: string): number {
  const byId = new Map(plan.map((node) => [node.id, node]));
  const seen = new Set<string>();

  let depth = 1;
  let current = byId.get(nodeId)?.parentId ?? null;

  while (current !== null && byId.has(current) && depth < MAX_BUDGET_DEPTH) {
    if (seen.has(current)) {
      return MAX_BUDGET_DEPTH;
    }
    seen.add(current);
    depth += 1;
    current = byId.get(current)?.parentId ?? null;
  }

  return depth;
}

export function canAddChild(plan: BudgetNode[], nodeId: string): boolean {
  return budgetDepth(plan, nodeId) < MAX_BUDGET_DEPTH;
}

// Cả nhánh dưới `nodeId`, kể cả chính nó.
export function branchOf(plan: BudgetNode[], nodeId: string): BudgetNode[] {
  const out: BudgetNode[] = [];
  const queue = [nodeId];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);

    const node = plan.find((candidate) => candidate.id === id);
    if (node) {
      out.push(node);
    }
    for (const child of plan.filter((candidate) => candidate.parentId === id)) {
      queue.push(child.id);
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// §3.1 — tính tiền của một node lá
// ---------------------------------------------------------------------------

function quantityOf(node: BudgetNode): number {
  return Math.max(1, Math.floor(node.quantity || 1));
}

function leafTotal(node: BudgetNode, party: PartySize): number {
  const qty = quantityOf(node);

  if (node.pricingMode === 'perPerson') {
    return qty * ((node.unitAdult ?? 0) * party.adults + (node.unitChild ?? 0) * party.children);
  }

  return qty * (node.lumpSum ?? 0);
}

// Suất đầu người của một node lá.
//
// CHÚ Ý — đây là số DẪN XUẤT, có thể là phân số: một khoản trọn gói ¥1,000 chia
// cho 3 người là 333,33 mỗi người. Hàm này KHÔNG làm tròn, nhờ vậy bất biến
// `adult × A + child × C === total` đúng tuyệt đối ở mọi chế độ giá. Việc làm
// tròn để hiển thị là của tầng UI, và chỉ làm một lần ở con số cuối cùng.
function leafPerHead(node: BudgetNode, party: PartySize): PerHead {
  const people = party.adults + party.children;
  const total = leafTotal(node, party);

  if (node.pricingMode === 'perPerson') {
    const qty = quantityOf(node);
    return { adult: qty * (node.unitAdult ?? 0), child: qty * (node.unitChild ?? 0) };
  }

  if ((node.lumpSumSplit ?? 'perHead') === 'adultsOnly') {
    return party.adults > 0 ? { adult: total / party.adults, child: 0 } : ZERO_PER_HEAD;
  }

  return people > 0 ? { adult: total / people, child: total / people } : ZERO_PER_HEAD;
}

// ---------------------------------------------------------------------------
// §3.2 / §3.3 — tổng
// ---------------------------------------------------------------------------

// Node có con thì tiền của nó LÀ tổng của các con, không cộng thêm gì của
// chính nó — nếu không, tổng của cha không còn là một sự thật duy nhất.
export function nodeTotal(node: BudgetNode, plan: BudgetNode[], party: PartySize): number {
  const kids = childrenOf(plan, node.id);
  if (kids.length === 0) {
    return leafTotal(node, party);
  }
  return kids.reduce((sum, child) => sum + nodeTotal(child, plan, party), 0);
}

export function nodePerHead(node: BudgetNode, plan: BudgetNode[], party: PartySize): PerHead {
  const kids = childrenOf(plan, node.id);
  if (kids.length === 0) {
    return leafPerHead(node, party);
  }

  return kids.reduce<PerHead>((sum, child) => {
    const share = nodePerHead(child, plan, party);
    return { adult: sum.adult + share.adult, child: sum.child + share.child };
  }, ZERO_PER_HEAD);
}

export function planTotal(plan: BudgetNode[], party: PartySize): number {
  return rootsOf(plan).reduce((sum, node) => sum + nodeTotal(node, plan, party), 0);
}

// Chỉ cộng node LÁ. Cộng cả cha lẫn con là đếm trùng gấp đôi.
export function planPerHead(plan: BudgetNode[], party: PartySize): PerHead {
  return plan
    .filter((node) => isLeaf(plan, node.id))
    .reduce<PerHead>((sum, node) => {
      const share = leafPerHead(node, party);
      return { adult: sum.adult + share.adult, child: sum.child + share.child };
    }, ZERO_PER_HEAD);
}

export function totalsByCategory(plan: BudgetNode[], party: PartySize): Record<CostCategory, number> {
  const totals = Object.fromEntries(
    COST_CATEGORIES.map((category) => [category, 0]),
  ) as Record<CostCategory, number>;

  for (const node of rootsOf(plan)) {
    totals[node.category] += nodeTotal(node, plan, party);
  }

  return totals;
}

// ---------------------------------------------------------------------------
// B3 — liên kết với lịch trình
// ---------------------------------------------------------------------------

export function tripItems(trip: Trip): { item: ItineraryItem; dayId: string | null }[] {
  return [
    ...trip.days.flatMap((day) => day.items.map((item) => ({ item, dayId: day.id }))),
    ...trip.unscheduledItems.map((item) => ({ item, dayId: null as string | null })),
  ];
}

export function nodeForItem(plan: BudgetNode[], itemId: string): BudgetNode | undefined {
  return plan.find((node) => node.linkedItemId === itemId);
}

export interface BudgetSuggestion {
  item: ItineraryItem;
  dayId: string | null;
}

// Mục lịch trình chưa có khoản dự trù nào trỏ tới. Idempotent: mục đã có node
// thì không bao giờ hiện lại (B3.7).
export function budgetSuggestions(trip: Trip): BudgetSuggestion[] {
  const linked = new Set(
    trip.budgetPlan.map((node) => node.linkedItemId).filter((id): id is string => Boolean(id)),
  );
  return tripItems(trip).filter(({ item }) => !linked.has(item.id));
}

// B3.6 — item bị xoá khỏi lịch trình thì KHÔNG xoá tiền của user: chỉ gỡ liên
// kết, giữ nguyên khoản chi phí (và `linkedPlaceId` để còn tra được giá gốc).
export function unlinkDeletedItems(trip: Trip): BudgetNode[] {
  const alive = new Set(tripItems(trip).map(({ item }) => item.id));

  return trip.budgetPlan.map((node) => {
    if (!node.linkedItemId || alive.has(node.linkedItemId)) {
      return node;
    }
    return omit(node, ['linkedItemId']);
  });
}

// Tổng dự trù quy về từng ngày. Chỉ tính node "được gắn cao nhất": nếu cả cha
// lẫn con cùng trỏ vào một ngày thì cộng cả hai là đếm trùng.
export function totalsByDay(trip: Trip): { byDay: Record<string, number>; unassigned: number } {
  const plan = trip.budgetPlan;
  const byId = new Map(plan.map((node) => [node.id, node]));
  const dayOfItem = new Map<string, string>();
  for (const day of trip.days) {
    for (const item of day.items) {
      dayOfItem.set(item.id, day.id);
    }
  }

  const hasLinkedAncestor = (node: BudgetNode): boolean => {
    const seen = new Set<string>([node.id]);
    let current = node.parentId ? byId.get(node.parentId) : undefined;
    while (current && !seen.has(current.id)) {
      if (current.linkedItemId) {
        return true;
      }
      seen.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return false;
  };

  const byDay: Record<string, number> = Object.fromEntries(trip.days.map((day) => [day.id, 0]));
  let assigned = 0;

  for (const node of plan) {
    if (!node.linkedItemId || hasLinkedAncestor(node)) {
      continue;
    }
    const dayId = dayOfItem.get(node.linkedItemId);
    if (dayId === undefined) {
      continue; // mục ở "Chưa xếp ngày" hoặc đã bị xoá
    }
    const total = nodeTotal(node, plan, trip.party);
    byDay[dayId] += total;
    assigned += total;
  }

  return { byDay, unassigned: planTotal(plan, trip.party) - assigned };
}

// ---------------------------------------------------------------------------
// B1 / B2 — thêm, xoá node
// ---------------------------------------------------------------------------

export interface NewNodeInput {
  category: CostCategory;
  title: string;
  parentId?: string | null;
  pricingMode?: BudgetPricingModeInput;
  unitAdult?: number;
  unitChild?: number;
  lumpSum?: number;
  linkedItemId?: string;
  linkedPlaceId?: string;
  linkedItemTitle?: string;
  quantity?: number;
  note?: string;
}

type BudgetPricingModeInput = BudgetNode['pricingMode'];

function nextOrder(plan: BudgetNode[], parentId: string | null): number {
  const siblings = plan.filter((node) => (node.parentId ?? null) === parentId);
  return siblings.reduce((max, node) => Math.max(max, node.order + 1), 0);
}

export function createNode(plan: BudgetNode[], input: NewNodeInput, id: string): BudgetNode {
  const parentId = input.parentId ?? null;

  return {
    id,
    parentId,
    category: input.category,
    title: input.title,
    ...(input.note ? { note: input.note } : {}),
    ...(input.linkedItemId ? { linkedItemId: input.linkedItemId } : {}),
    ...(input.linkedPlaceId ? { linkedPlaceId: input.linkedPlaceId } : {}),
    ...(input.linkedItemTitle ? { linkedItemTitle: input.linkedItemTitle } : {}),
    pricingMode: input.pricingMode ?? 'lumpSum',
    ...(input.unitAdult === undefined ? {} : { unitAdult: input.unitAdult }),
    ...(input.unitChild === undefined ? {} : { unitChild: input.unitChild }),
    ...(input.lumpSum === undefined ? {} : { lumpSum: input.lumpSum }),
    quantity: Math.max(1, Math.floor(input.quantity ?? 1)),
    order: nextOrder(plan, parentId),
  };
}

// B2 — thêm mục con vào một node.
//
// Nếu node cha đang là LÁ và đã có tiền, số tiền đó được đẩy xuống thành mục
// con đầu tiên mang tên của cha. Nhờ vậy `total(cha)` không đổi tại đúng thời
// điểm nó chuyển từ lá sang cha — user không mất số đã nhập và không phải gõ lại.
export function addChildNode(
  plan: BudgetNode[],
  parentId: string,
  makeId: () => string,
  input?: Partial<NewNodeInput>,
): BudgetNode[] {
  const parent = plan.find((node) => node.id === parentId);
  if (!parent || !canAddChild(plan, parentId)) {
    return plan;
  }

  const next = [...plan];

  if (isLeaf(plan, parentId)) {
    next.push({
      ...parent,
      id: makeId(),
      parentId,
      linkedItemId: undefined,
      linkedPlaceId: undefined,
      linkedItemTitle: undefined,
      title: parent.title,
      order: 0,
    });
  }

  next.push(
    createNode(next, {
      category: parent.category,
      title: input?.title ?? '',
      ...input,
      parentId,
    }, makeId()),
  );

  return next.map((node) =>
    // Dọn `undefined` do spread ở trên để bản ghi gửi lên server sạch.
    Object.fromEntries(Object.entries(node).filter(([, value]) => value !== undefined)) as BudgetNode,
  );
}

// B1 — xoá một khoản là xoá CẢ NHÁNH dưới nó, và xoá luôn số tiền của nhánh
// đó. Khi node cha mất đứa con cuối cùng, nó quay lại làm lá với số tiền 0 và
// một ô nhập trống.
//
// Bản spec đầu viết là cha "giữ nguyên tổng cuối cùng của các con". Cách đó
// mâu thuẫn với chính hộp thoại xác nhận ("N mục con, tổng ¥X sẽ bị xoá"):
// user bấm xoá một khoản ¥24.000 rồi thấy ¥24.000 vẫn nằm ở dòng cha là tiền
// tự mọc lại. Xoá thì mất tiền — chỉ có đúng một cách hiểu.
export function removeNode(plan: BudgetNode[], nodeId: string): BudgetNode[] {
  const target = plan.find((node) => node.id === nodeId);
  if (!target) {
    return plan;
  }

  const doomed = new Set(branchOf(plan, nodeId).map((node) => node.id));
  const next = plan.filter((node) => !doomed.has(node.id));

  const parentId = target.parentId;
  const parentLostLastChild =
    parentId !== null && next.some((node) => node.id === parentId) && isLeaf(next, parentId);

  return next.map((node) => {
    if (!parentLostLastChild || node.id !== parentId) {
      return node;
    }
    return { ...omit(node, ['unitAdult', 'unitChild']), pricingMode: 'lumpSum', lumpSum: 0, quantity: 1 };
  });
}

// ---------------------------------------------------------------------------
// Thao tác trên cây dùng cho UI Bước 4
// ---------------------------------------------------------------------------

export function updateNode(
  plan: BudgetNode[],
  nodeId: string,
  patch: Partial<BudgetNode>,
): BudgetNode[] {
  return plan.map((node) => (node.id === nodeId ? { ...node, ...patch } : node));
}

// B1 — loại chi phí chỉ đổi được ở mức 1, và đổi thì CẢ NHÁNH chuyển nhóm cùng
// lúc. Để con mang loại khác cha thì một khoản sẽ nằm ở hai nhóm tuỳ chỗ đọc.
export function setBranchCategory(
  plan: BudgetNode[],
  nodeId: string,
  category: CostCategory,
): BudgetNode[] {
  const ids = new Set(branchOf(plan, nodeId).map((node) => node.id));
  return plan.map((node) => (ids.has(node.id) ? { ...node, category } : node));
}

// Nhân bản cả nhánh. Bản sao KHÔNG mang theo liên kết lịch trình: một mục lịch
// trình chỉ được có tối đa một khoản dự trù (B3.5).
export function duplicateNode(
  plan: BudgetNode[],
  nodeId: string,
  makeId: () => string,
  titleSuffix: string,
): BudgetNode[] {
  const source = plan.find((node) => node.id === nodeId);
  if (!source) {
    return plan;
  }

  const branch = branchOf(plan, nodeId);
  const idMap = new Map(branch.map((node) => [node.id, makeId()]));

  const copies = branch.map((node) => {
    const copy = omit(node, ['linkedItemId', 'linkedPlaceId', 'linkedItemTitle']);
    return {
      ...copy,
      id: idMap.get(node.id)!,
      parentId: node.id === nodeId ? source.parentId : idMap.get(node.parentId!) ?? null,
      title: node.id === nodeId ? `${node.title}${titleSuffix}` : node.title,
      order: node.id === nodeId ? nextOrder(plan, source.parentId) : node.order,
    };
  });

  return [...plan, ...copies];
}

export function addRootNode(
  plan: BudgetNode[],
  input: NewNodeInput,
  id: string,
): BudgetNode[] {
  return [...plan, createNode(plan, { ...input, parentId: null }, id)];
}

// B5 — quy đổi cả cây sang đơn vị nhỏ nhất của tiền tệ mới.
export function rescalePlan(plan: BudgetNode[], from: Currency, to: Currency): BudgetNode[] {
  if (minorUnits(from) === minorUnits(to)) {
    return plan;
  }

  return plan.map((node) => ({
    ...node,
    ...(node.unitAdult === undefined ? {} : { unitAdult: rescaleAmount(node.unitAdult, from, to) }),
    ...(node.unitChild === undefined ? {} : { unitChild: rescaleAmount(node.unitChild, from, to) }),
    ...(node.lumpSum === undefined ? {} : { lumpSum: rescaleAmount(node.lumpSum, from, to) }),
  }));
}

// Số khoản có phần lẻ sẽ bị làm tròn khi đổi sang đơn vị ít chữ số hơn.
export function countRoundedByRescale(plan: BudgetNode[], from: Currency, to: Currency): number {
  if (!losesPrecision(from, to)) {
    return 0;
  }
  const step = 10 ** (minorUnits(from) - minorUnits(to));
  return plan.filter((node) =>
    [node.unitAdult, node.unitChild, node.lumpSum].some(
      (value) => value !== undefined && value % step !== 0,
    ),
  ).length;
}

// ---------------------------------------------------------------------------
// B6 — hạn mức: tổng hay theo đầu người
// ---------------------------------------------------------------------------

export type BudgetBasis = 'total' | 'perPerson';

export function budgetBasisOf(trip: Pick<Trip, 'budget' | 'budgetPerPerson'>): BudgetBasis {
  return trip.budgetPerPerson !== null ? 'perPerson' : 'total';
}

export function headcount(party: PartySize): number {
  return party.adults + party.children;
}

// Hạn mức quy về tổng. MỌI chỗ so sánh với tổng dự trù / đã chi đều phải đi qua
// hàm này, không đọc thẳng `trip.budget`.
export function budgetTotal(
  trip: Pick<Trip, 'budget' | 'budgetPerPerson' | 'party'>,
): number | null {
  if (trip.budgetPerPerson !== null) {
    return trip.budgetPerPerson * headcount(trip.party);
  }
  return trip.budget;
}

// Đổi cách đặt hạn mức thì giữ nguyên giá trị quy ra tổng, để thanh tiến trình
// không nhảy chỉ vì user bấm đổi cách nhập.
export function switchBudgetBasis(
  trip: Pick<Trip, 'budget' | 'budgetPerPerson' | 'party'>,
  next: BudgetBasis,
): { budget: number | null; budgetPerPerson: number | null } {
  const total = budgetTotal(trip);
  const people = headcount(trip.party);

  if (next === 'perPerson') {
    return {
      budget: null,
      budgetPerPerson: total === null ? null : people > 0 ? Math.round(total / people) : total,
    };
  }
  return { budget: total, budgetPerPerson: null };
}

// Node gốc của nhánh chứa `nodeId`. Dùng để gom chi tiêu thực tế về đúng khoản
// dự trù mức 1 — nếu cộng ở mọi mức thì cha và con sẽ đếm trùng.
export function rootAncestorOf(plan: BudgetNode[], nodeId: string): BudgetNode | undefined {
  const byId = new Map(plan.map((node) => [node.id, node]));
  const seen = new Set<string>();

  let current = byId.get(nodeId);
  while (current && current.parentId && byId.has(current.parentId) && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.parentId);
  }
  return current;
}

// Danh sách khoản dự trù của một loại, kèm độ sâu để thụt lề trong ô chọn.
export function nodesForCategory(
  plan: BudgetNode[],
  category: CostCategory,
): { node: BudgetNode; depth: number }[] {
  const walk = (parentId: string | null, depth: number): { node: BudgetNode; depth: number }[] =>
    childrenOf(plan, parentId)
      .filter((node) => node.category === category)
      .flatMap((node) => [{ node, depth }, ...walk(node.id, depth + 1)]);

  return walk(null, 1);
}
