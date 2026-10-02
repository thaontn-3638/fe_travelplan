import { describe, expect, it } from 'vitest';
import type { BudgetNode, ItineraryItem, PartySize, Place, Trip } from '../../../types';
import {
  MAX_BUDGET_DEPTH,
  addChildNode,
  budgetDepth,
  budgetSuggestions,
  budgetTotal,
  canAddChild,
  costCategoryForItem,
  isLeaf,
  nodeForItem,
  nodePerHead,
  nodeTotal,
  planPerHead,
  planTotal,
  countRoundedByRescale,
  removeNode,
  rescalePlan,
  switchBudgetBasis,
  totalsByCategory,
  totalsByDay,
  unlinkDeletedItems,
} from '../utils/budgetRules';

const PARTY: PartySize = { adults: 2, children: 2 };

function node(overrides: Partial<BudgetNode> & Pick<BudgetNode, 'id'>): BudgetNode {
  return {
    parentId: null,
    category: 'other',
    title: overrides.id,
    pricingMode: 'lumpSum',
    lumpSum: 0,
    quantity: 1,
    order: 0,
    ...overrides,
  };
}

function idFactory(prefix = 'gen'): () => string {
  let n = 0;
  return () => `${prefix}${(n += 1)}`;
}

// Bất biến §3.1 — suất đầu người nhân lại phải ra đúng tổng, ở MỌI chế độ giá.
function expectPerHeadMatchesTotal(target: BudgetNode, plan: BudgetNode[], party: PartySize): void {
  const perHead = nodePerHead(target, plan, party);
  const total = nodeTotal(target, plan, party);
  expect(perHead.adult * party.adults + perHead.child * party.children).toBeCloseTo(total, 6);
}

describe('§3.1 — tiền của một khoản lá', () => {
  it('perPerson: nhân số lượng với đơn giá từng loại người', () => {
    const n = node({ id: 'n1', pricingMode: 'perPerson', unitAdult: 200, unitChild: 0, quantity: 3 });
    // 3 đêm × (200 × 2 người lớn + 0 × 2 trẻ em)
    expect(nodeTotal(n, [n], PARTY)).toBe(1200);
    expectPerHeadMatchesTotal(n, [n], PARTY);
  });

  it('lumpSum + perHead: trọn gói, chia đều cho mọi người', () => {
    const n = node({ id: 'n1', lumpSum: 24000, quantity: 3 });
    expect(nodeTotal(n, [n], PARTY)).toBe(72000);
    expect(nodePerHead(n, [n], PARTY)).toEqual({ adult: 18000, child: 18000 });
    expectPerHeadMatchesTotal(n, [n], PARTY);
  });

  it('lumpSum + adultsOnly: trẻ em không gánh', () => {
    const n = node({ id: 'n1', lumpSum: 9000, lumpSumSplit: 'adultsOnly' });
    expect(nodePerHead(n, [n], PARTY)).toEqual({ adult: 4500, child: 0 });
    expectPerHeadMatchesTotal(n, [n], PARTY);
  });

  it('suất đầu người KHÔNG làm tròn, nên bất biến vẫn đúng khi chia không hết', () => {
    // ¥1.000 chia 3 người = 333,33 — làm tròn ở đây là tổng sẽ lệch mất ¥1.
    const party: PartySize = { adults: 2, children: 1 };
    const n = node({ id: 'n1', lumpSum: 1000 });
    expectPerHeadMatchesTotal(n, [n], party);
  });

  it('quantity không hợp lệ được coi là 1, không làm tổng về 0', () => {
    const n = node({ id: 'n1', lumpSum: 5000, quantity: 0 });
    expect(nodeTotal(n, [n], PARTY)).toBe(5000);
  });

  it('không có ai thì không chia cho 0', () => {
    const n = node({ id: 'n1', lumpSum: 5000 });
    expect(nodePerHead(n, [n], { adults: 0, children: 0 })).toEqual({ adult: 0, child: 0 });
  });
});

describe('§3.2 / §3.3 — cha = tổng con', () => {
  // Cây ví dụ của spec §5.2: Khách sạn > Hotel Granvia > {Phòng twin, Thuế lưu trú}
  const plan: BudgetNode[] = [
    node({ id: 'lodging', category: 'lodging', title: 'Khách sạn', lumpSum: 999999 }),
    node({ id: 'granvia', parentId: 'lodging', category: 'lodging', lumpSum: 888888 }),
    node({ id: 'room', parentId: 'granvia', category: 'lodging', lumpSum: 24000, quantity: 3 }),
    node({
      id: 'tax',
      parentId: 'granvia',
      category: 'lodging',
      pricingMode: 'perPerson',
      unitAdult: 200,
      unitChild: 0,
      quantity: 3,
      order: 1,
    }),
    node({
      id: 'osaka',
      parentId: 'lodging',
      category: 'lodging',
      pricingMode: 'perPerson',
      unitAdult: 8000,
      unitChild: 4000,
      order: 1,
    }),
  ];

  it('node có con thì bỏ qua số tiền của chính nó', () => {
    expect(nodeTotal(plan[2]!, plan, PARTY)).toBe(72000);
    expect(nodeTotal(plan[3]!, plan, PARTY)).toBe(1200);
    expect(nodeTotal(plan[1]!, plan, PARTY)).toBe(73200); // không phải 888.888
    expect(nodeTotal(plan[4]!, plan, PARTY)).toBe(24000);
    expect(nodeTotal(plan[0]!, plan, PARTY)).toBe(97200); // không phải 999.999
  });

  it('tổng chuyến chỉ cộng node gốc', () => {
    expect(planTotal(plan, PARTY)).toBe(97200);
  });

  it('suất đầu người chỉ cộng node LÁ — cây 3 mức không bị đếm gấp đôi', () => {
    const perHead = planPerHead(plan, PARTY);
    expect(perHead.adult * PARTY.adults + perHead.child * PARTY.children).toBeCloseTo(97200, 6);
  });

  it('gom theo loại chi phí', () => {
    expect(totalsByCategory(plan, PARTY).lodging).toBe(97200);
    expect(totalsByCategory(plan, PARTY).food).toBe(0);
  });

  it('node mồ côi (parentId trỏ vào chỗ không còn) vẫn được tính như node gốc', () => {
    const orphaned = [...plan, node({ id: 'ghost', parentId: 'đã-bị-xoá', lumpSum: 5000, order: 9 })];
    expect(planTotal(orphaned, PARTY)).toBe(102200);
    const perHead = planPerHead(orphaned, PARTY);
    expect(perHead.adult * PARTY.adults + perHead.child * PARTY.children).toBeCloseTo(102200, 6);
  });
});

describe('B1 — độ sâu tối đa 3 mức', () => {
  const plan: BudgetNode[] = [
    node({ id: 'a' }),
    node({ id: 'b', parentId: 'a' }),
    node({ id: 'c', parentId: 'b' }),
  ];

  it('đếm đúng mức', () => {
    expect(budgetDepth(plan, 'a')).toBe(1);
    expect(budgetDepth(plan, 'b')).toBe(2);
    expect(budgetDepth(plan, 'c')).toBe(3);
  });

  it('không cho thêm con ở mức cuối', () => {
    expect(canAddChild(plan, 'b')).toBe(true);
    expect(canAddChild(plan, 'c')).toBe(false);
    expect(addChildNode(plan, 'c', idFactory())).toEqual(plan);
  });

  it('dữ liệu vòng lặp không làm treo trang', () => {
    const cyclic = [node({ id: 'x', parentId: 'y' }), node({ id: 'y', parentId: 'x' })];
    expect(budgetDepth(cyclic, 'x')).toBe(MAX_BUDGET_DEPTH);
  });

  it('xoá node là xoá cả nhánh', () => {
    expect(removeNode(plan, 'b').map((n) => n.id)).toEqual(['a']);
  });
});

describe('B2 — chuyển lá ↔ cha', () => {
  const leaf = node({ id: 'hotel', category: 'lodging', title: 'Hotel Granvia', lumpSum: 24000, quantity: 3 });

  it('lá đang có tiền, thêm mục con thì TỔNG KHÔNG ĐỔI', () => {
    const before = nodeTotal(leaf, [leaf], PARTY);
    const next = addChildNode([leaf], 'hotel', idFactory());

    expect(before).toBe(72000);
    expect(nodeTotal(next.find((n) => n.id === 'hotel')!, next, PARTY)).toBe(72000);
    expect(isLeaf(next, 'hotel')).toBe(false);
  });

  it('số tiền cũ được đẩy xuống mục con đầu tiên, giữ nguyên tên cha', () => {
    const next = addChildNode([leaf], 'hotel', idFactory());
    const kids = next.filter((n) => n.parentId === 'hotel');

    expect(kids).toHaveLength(2);
    expect(kids[0]!.title).toBe('Hotel Granvia');
    expect(nodeTotal(kids[0]!, next, PARTY)).toBe(72000);
    expect(nodeTotal(kids[1]!, next, PARTY)).toBe(0); // mục con mới, chờ nhập
  });

  it('mục con mới không thừa hưởng liên kết lịch trình của cha', () => {
    const linked = { ...leaf, linkedItemId: 'item-1', linkedPlaceId: 'place-1' };
    const next = addChildNode([linked], 'hotel', idFactory());

    expect(next.filter((n) => n.parentId === 'hotel').every((n) => !n.linkedItemId)).toBe(true);
    expect(nodeForItem(next, 'item-1')!.id).toBe('hotel');
  });

  it('xoá mục con thì mất đúng số tiền của mục đó, không hơn không kém', () => {
    const next = addChildNode([leaf], 'hotel', idFactory());
    const [first, second] = next.filter((n) => n.parentId === 'hotel');

    // bỏ mục con rỗng vừa tạo -> cha vẫn 72.000
    const afterEmpty = removeNode(next, second!.id);
    expect(nodeTotal(afterEmpty.find((n) => n.id === 'hotel')!, afterEmpty, PARTY)).toBe(72000);

    // bỏ nốt mục con mang tiền -> cha thành lá, về 0
    const afterAll = removeNode(afterEmpty, first!.id);
    const parent = afterAll.find((n) => n.id === 'hotel')!;
    expect(isLeaf(afterAll, 'hotel')).toBe(true);
    expect(parent.pricingMode).toBe('lumpSum');
    expect(nodeTotal(parent, afterAll, PARTY)).toBe(0);
  });
});

describe('B3 — liên kết với lịch trình', () => {
  function item(id: string): ItineraryItem {
    return { id, kind: 'place', placeId: `p-${id}`, startTime: null, endTime: null, order: 0 };
  }

  function trip(plan: BudgetNode[]): Trip {
    return {
      id: 't1',
      name: 'Kyoto',
      regions: [{ id: 'r1', name: 'Kyoto' }],
      startDate: '2026-09-20',
      endDate: '2026-09-21',
      status: 'planning',
      travelers: [],
      party: PARTY,
      currency: 'JPY',
      budget: null,
      budgetPerPerson: null,
      spent: 0,
      budgetPlan: plan,
      days: [
        { id: 'd1', date: '2026-09-20', items: [item('a'), item('b')] },
        { id: 'd2', date: '2026-09-21', items: [item('c')] },
      ],
      unscheduledItems: [item('u')],
      updatedAt: '2026-09-15T00:00:00.000Z',
    };
  }

  it('chỉ gợi ý mục chưa có khoản dự trù, và chạy lại cho cùng kết quả', () => {
    const source = trip([node({ id: 'n1', linkedItemId: 'a', lumpSum: 1000 })]);

    expect(budgetSuggestions(source).map((s) => s.item.id)).toEqual(['b', 'c', 'u']);
    expect(budgetSuggestions(source)).toEqual(budgetSuggestions(source));
  });

  it('gợi ý gồm cả mục ở "Chưa xếp ngày", có đánh dấu dayId null', () => {
    const suggestions = budgetSuggestions(trip([]));
    expect(suggestions.find((s) => s.item.id === 'u')!.dayId).toBeNull();
    expect(suggestions.find((s) => s.item.id === 'a')!.dayId).toBe('d1');
  });

  it('xoá mục khỏi lịch trình: KHÔNG xoá tiền, chỉ gỡ liên kết', () => {
    const source = trip([
      node({ id: 'n1', linkedItemId: 'đã-xoá', linkedPlaceId: 'p-x', lumpSum: 4000 }),
    ]);
    const [kept] = unlinkDeletedItems(source);

    expect(kept!.linkedItemId).toBeUndefined();
    expect(kept!.linkedPlaceId).toBe('p-x'); // còn tra được giá gốc
    expect(kept!.lumpSum).toBe(4000);
  });

  it('quy chi phí về từng ngày, không đếm trùng khi cả cha lẫn con cùng gắn mục', () => {
    const source = trip([
      node({ id: 'parent', linkedItemId: 'a', lumpSum: 999 }),
      node({ id: 'child', parentId: 'parent', linkedItemId: 'b', lumpSum: 1500 }),
      node({ id: 'flight', title: 'Vé máy bay', lumpSum: 60000, order: 1 }),
    ]);
    const { byDay, unassigned } = totalsByDay(source);

    expect(byDay.d1).toBe(1500); // cha = tổng con, chỉ tính một lần
    expect(byDay.d2).toBe(0);
    expect(unassigned).toBe(60000);
    expect(planTotal(source.budgetPlan, PARTY)).toBe(61500);
  });
});

describe('§1 — loại chi phí mặc định suy từ mục lịch trình', () => {
  const places = new Map<string, Place>([
    ['p-hotel', { id: 'p-hotel', category: 'hotel' } as Place],
    ['p-food', { id: 'p-food', category: 'restaurant' } as Place],
    ['p-see', { id: 'p-see', category: 'attraction' } as Place],
  ]);

  function placeItem(placeId: string): ItineraryItem {
    return { id: `i-${placeId}`, kind: 'place', placeId, startTime: null, endTime: null, order: 0 };
  }

  it('map theo bảng của spec', () => {
    expect(costCategoryForItem(placeItem('p-hotel'), places)).toBe('lodging');
    expect(costCategoryForItem(placeItem('p-food'), places)).toBe('food');
    expect(costCategoryForItem(placeItem('p-see'), places)).toBe('sightseeing');
  });

  it('hoạt động tự do và địa điểm không rõ loại đều về "other"', () => {
    const activity: ItineraryItem = {
      id: 'i1',
      kind: 'activity',
      title: 'Đi dạo',
      startTime: null,
      endTime: null,
      order: 0,
    };
    expect(costCategoryForItem(activity, places)).toBe('other');
    expect(costCategoryForItem(placeItem('không-tồn-tại'), places)).toBe('other');
  });
});

describe('B5 — đổi đơn vị tiền phải quy đổi đơn vị nhỏ nhất', () => {
  const plan: BudgetNode[] = [
    node({ id: 'a', lumpSum: 123500 }), // $1.235,00 khi currency = USD
    node({ id: 'b', pricingMode: 'perPerson', unitAdult: 4250, unitChild: 2125, order: 1 }),
  ];

  it('USD -> JPY chia 100, không giữ nguyên con số', () => {
    const next = rescalePlan(plan, 'USD', 'JPY');
    expect(next[0]!.lumpSum).toBe(1235);
    expect(next[1]!.unitAdult).toBe(43); // 42,50 làm tròn
    expect(next[1]!.unitChild).toBe(21); // 21,25 làm tròn
  });

  it('JPY -> USD nhân 100', () => {
    expect(rescalePlan([node({ id: 'a', lumpSum: 1235 })], 'JPY', 'USD')[0]!.lumpSum).toBe(123500);
  });

  it('cùng số chữ số thập phân thì không đụng gì', () => {
    expect(rescalePlan(plan, 'JPY', 'VND')).toBe(plan);
  });

  it('đếm đúng số khoản bị làm tròn để cảnh báo trước', () => {
    expect(countRoundedByRescale(plan, 'USD', 'JPY')).toBe(1); // chỉ node 'b' có phần lẻ
    expect(countRoundedByRescale(plan, 'JPY', 'USD')).toBe(0); // thêm chữ số thì không mất gì
  });
});

describe('B6 — hạn mức: cả chuyến hay mỗi người', () => {
  const party: PartySize = { adults: 4, children: 1 };

  it('đặt theo đầu người thì tổng = đơn giá × số người', () => {
    expect(budgetTotal({ budget: null, budgetPerPerson: 50000, party })).toBe(250000);
  });

  it('đặt theo cả chuyến thì dùng thẳng số đã nhập', () => {
    expect(budgetTotal({ budget: 300000, budgetPerPerson: null, party })).toBe(300000);
  });

  it('chưa đặt gì thì không có hạn mức', () => {
    expect(budgetTotal({ budget: null, budgetPerPerson: null, party })).toBeNull();
  });

  it('theo đầu người thắng, để không bao giờ có hai nguồn sự thật', () => {
    expect(budgetTotal({ budget: 999999, budgetPerPerson: 1000, party })).toBe(5000);
  });

  it('số người đổi thì tổng đổi theo — đó là lý do lưu đơn giá chứ không lưu tổng', () => {
    const cap = { budget: null, budgetPerPerson: 50000 };
    expect(budgetTotal({ ...cap, party: { adults: 2, children: 0 } })).toBe(100000);
    expect(budgetTotal({ ...cap, party: { adults: 6, children: 2 } })).toBe(400000);
  });

  it('đổi cách nhập giữ nguyên giá trị quy ra tổng', () => {
    const toPerHead = switchBudgetBasis({ budget: 250000, budgetPerPerson: null, party }, 'perPerson');
    expect(toPerHead).toEqual({ budget: null, budgetPerPerson: 50000 });

    const backToTotal = switchBudgetBasis({ ...toPerHead, party }, 'total');
    expect(backToTotal).toEqual({ budget: 250000, budgetPerPerson: null });
  });

  it('chia không hết thì làm tròn một lần, không tích luỹ sai số khi đổi qua đổi lại', () => {
    const odd: PartySize = { adults: 3, children: 0 };
    const once = switchBudgetBasis({ budget: 100000, budgetPerPerson: null, party: odd }, 'perPerson');
    expect(once.budgetPerPerson).toBe(33333);

    // Đổi lại rồi đổi tiếp nữa vẫn ra đúng con số đó, không trôi thêm.
    const there = switchBudgetBasis({ ...once, party: odd }, 'total');
    const back = switchBudgetBasis({ ...there, party: odd }, 'perPerson');
    expect(back.budgetPerPerson).toBe(33333);
  });

  it('không có ai thì không chia cho 0', () => {
    const none: PartySize = { adults: 0, children: 0 };
    expect(switchBudgetBasis({ budget: 5000, budgetPerPerson: null, party: none }, 'perPerson')).toEqual({
      budget: null,
      budgetPerPerson: 5000,
    });
  });
});
