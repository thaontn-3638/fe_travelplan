import { describe, expect, it } from 'vitest';
import type { BudgetNode, Expense, Traveler } from '../../../types';
import {
  allocateExpense,
  balances,
  buildSettlementExpense,
  personCosts,
  pickTreasurer,
  settleViaTreasurer,
  settlementText,
  spreadEvenly,
  toPayableShares,
  totalSpent,
  validateExactShares,
  varianceByCategory,
  varianceByNode,
} from '../utils/settlementRules';

// 4 người lớn + 1 trẻ. Bi do Lan phụ trách.
const MINH: Traveler = { id: 'minh', fullName: 'Minh', initials: 'M', colorClass: 'bg-ocean' };
const LAN: Traveler = { id: 'lan', fullName: 'Lan', initials: 'L', colorClass: 'bg-coral' };
const HUNG: Traveler = { id: 'hung', fullName: 'Hùng', initials: 'H', colorClass: 'bg-mint' };
const BAN: Traveler = { id: 'ban', fullName: 'Bạn', initials: 'B', colorClass: 'bg-violet' };
const BI: Traveler = { id: 'bi', fullName: 'Bi', initials: 'Bi', colorClass: 'bg-amber', isChild: true, guardianId: 'lan' };
const TEAM = [MINH, LAN, HUNG, BAN, BI];
const ALL_IDS = TEAM.map((t) => t.id);

function expense(o: Partial<Expense> & Pick<Expense, 'id' | 'amount' | 'payerId'>): Expense {
  return {
    tripId: 't1',
    kind: 'expense',
    date: '2026-09-20',
    category: 'food',
    title: o.id,
    splitMode: 'equal',
    shares: ALL_IDS.map((id) => ({ travelerId: id })),
    createdAt: '2026-09-20T00:00:00.000Z',
    createdBy: 'u1',
    ...o,
  };
}

describe('S3 — chia đều và phần dư', () => {
  it('¥1.000 chia 3 người ra 334 + 333 + 333', () => {
    const result = spreadEvenly(1000, ['a', 'b', 'c']);
    expect(Object.values(result).sort((x, y) => y - x)).toEqual([334, 333, 333]);
  });

  it('Σ luôn bằng tổng, với mọi số tiền 1..2000 và 1..6 người', () => {
    for (let total = 1; total <= 2000; total += 1) {
      for (let people = 1; people <= 6; people += 1) {
        const ids = Array.from({ length: people }, (_, index) => `p${index}`);
        const sum = Object.values(spreadEvenly(total, ids)).reduce((a, b) => a + b, 0);
        expect(sum).toBe(total);
      }
    }
  });

  it('phần dư xoay vòng theo offset thay vì luôn rơi vào cùng một người', () => {
    expect(spreadEvenly(1000, ['a', 'b', 'c'], 0)).toEqual({ a: 334, b: 333, c: 333 });
    expect(spreadEvenly(1000, ['a', 'b', 'c'], 1)).toEqual({ a: 333, b: 334, c: 333 });
    expect(spreadEvenly(1001, ['a', 'b', 'c'], 2)).toEqual({ a: 334, b: 333, c: 334 });
  });

  it('chia đều chính xác tới 0,01 yên: ¥1.000 / 3 = 333.34 + 333.33 + 333.33', () => {
    const e = expense({ id: 'e1', amount: 1000, payerId: 'minh', shares: ['minh', 'lan', 'hung'].map((id) => ({ travelerId: id })) });
    const alloc = allocateExpense(e, 'JPY');
    expect(Object.values(alloc).sort((x, y) => y - x)).toEqual([333.34, 333.33, 333.33]);
  });

  it('50 khoản ¥1.000 chia 3 người: không ai bị lệch quá 0,5 yên (trước đây lệch ~17 yên)', () => {
    const three = [MINH, LAN, HUNG];
    const list = Array.from({ length: 50 }, (_, index) =>
      expense({
        id: `meal-${index}`,
        amount: 1000,
        payerId: 'minh',
        shares: three.map((traveler) => ({ travelerId: traveler.id })),
      }),
    );
    const rows = personCosts(list, three, 'JPY');
    const fair = 50000 / 3;
    for (const row of rows) {
      expect(Math.abs(row.ownShare - fair)).toBeLessThan(0.5);
    }
    expect(rows.reduce((sum, row) => sum + row.balance, 0)).toBeCloseTo(0, 6);
  });

  it('USD đã lưu theo cent nên vẫn chia tới cent', () => {
    const e = expense({ id: 'e1', amount: 1000, payerId: 'minh', shares: ['minh', 'lan', 'hung'].map((id) => ({ travelerId: id })) });
    expect(Object.values(allocateExpense(e, 'USD')).sort((x, y) => y - x)).toEqual([334, 333, 333]);
  });

  it('ghi "Đã trả" một số lẻ 2 chữ số thì số dư về đúng 0', () => {
    const three = [MINH, LAN, HUNG];
    const list = [expense({ id: 'e1', amount: 1000, payerId: 'minh', shares: three.map((t) => ({ travelerId: t.id })) })];
    const transfers = settleViaTreasurer(balances(list, three), 'minh');
    const settlements = transfers.map((transfer, index) => ({
      ...buildSettlementExpense(transfer, 't1', '2026-09-25', 'u1'),
      id: `s${index}`,
      createdAt: '2026-09-25T00:00:00.000Z',
    }));
    expect(transfers.every((transfer) => Number.isInteger(Math.round(transfer.amount * 100)))).toBe(true);
    expect(Object.values(balances([...list, ...settlements], three)).every((value) => value === 0)).toBe(true);
  });

  it('không có ai thì không chia, không ném lỗi', () => {
    expect(spreadEvenly(1000, [])).toEqual({});
  });

  it('chế độ nhập riêng: lệch tổng thì báo đúng phần chênh', () => {
    const e = expense({
      id: 'e1',
      amount: 12000,
      payerId: 'ban',
      splitMode: 'exact',
      shares: [
        { travelerId: 'minh', amount: 3500 },
        { travelerId: 'lan', amount: 2500 },
      ],
    });
    expect(validateExactShares(e)).toEqual({ ok: false, diff: 6000 });

    const fixed = { ...e, shares: [...e.shares, { travelerId: 'hung', amount: 6000 }] };
    expect(validateExactShares(fixed)).toEqual({ ok: true });
  });
});

describe('S2 — trẻ em có suất riêng nhưng không tự trả', () => {
  it('trẻ có người phụ trách: TOÀN BỘ suất về đúng người đó', () => {
    const e = expense({ id: 'e1', amount: 5000, payerId: 'minh' });
    const alloc = allocateExpense(e);
    const payable = toPayableShares(alloc, e, TEAM);

    expect(alloc.bi).toBe(1000); // bé vẫn có suất — đây là con số cần báo cáo
    expect(payable.bi).toBe(0); // nhưng không có nghĩa vụ trả
    expect(payable.lan).toBe(1000 + 1000); // suất của Lan + suất của Bi
    expect(Object.values(payable).reduce((a, b) => a + b, 0)).toBe(5000);
  });

  it('trẻ chưa gán người phụ trách: chia đều cho người lớn CÓ TRONG khoản đó', () => {
    const orphan = [...TEAM.slice(0, 4), { ...BI, guardianId: undefined }];
    const e = expense({
      id: 'e1',
      amount: 900,
      payerId: 'minh',
      shares: [{ travelerId: 'minh' }, { travelerId: 'lan' }, { travelerId: 'bi' }],
    });
    const payable = toPayableShares(allocateExpense(e), e, orphan);

    expect(payable.bi).toBe(0);
    expect(payable.minh).toBe(450); // 300 của mình + 150 gánh hộ
    expect(payable.lan).toBe(450);
    expect(payable.hung).toBeUndefined(); // không tham gia khoản này thì không gánh
  });

  it('khoản chỉ chi cho trẻ, không có người lớn nào: chia đều cho MỌI người lớn', () => {
    const orphan = [...TEAM.slice(0, 4), { ...BI, guardianId: undefined }];
    const e = expense({ id: 'e1', amount: 2000, payerId: 'lan', shares: [{ travelerId: 'bi' }] });
    const payable = toPayableShares(allocateExpense(e), e, orphan);

    expect(payable.bi).toBe(0);
    expect(Object.values(payable).reduce((a, b) => a + b, 0)).toBe(2000);
    expect([payable.minh, payable.lan, payable.hung, payable.ban]).toEqual([500, 500, 500, 500]);
  });

  it('người phụ trách đã rời nhóm hoặc trỏ nhầm sang một trẻ khác: coi như chưa gán', () => {
    const broken = [...TEAM.slice(0, 4), { ...BI, guardianId: 'không-tồn-tại' }];
    const e = expense({ id: 'e1', amount: 1000, payerId: 'minh', shares: [{ travelerId: 'bi' }] });
    const payable = toPayableShares(allocateExpense(e), e, broken);

    expect(payable.bi).toBe(0);
    expect(Object.values(payable).reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('Σ payable === amount và mọi trẻ em = 0, với mọi số tiền', () => {
    for (let amount = 1; amount <= 500; amount += 1) {
      const e = expense({ id: 'e', amount, payerId: 'minh' });
      const payable = toPayableShares(allocateExpense(e), e, TEAM);
      expect(Object.values(payable).reduce((a, b) => a + b, 0)).toBeCloseTo(amount, 6);
      expect(payable.bi).toBe(0);
    }
  });
});

// Bộ số chốt của spec §9.3 — đã kiểm bằng script trước khi viết code.
const FIXTURE: Expense[] = [
  expense({ id: 'x1', title: 'Khách sạn 3 đêm', category: 'lodging', payerId: 'minh', amount: 97200 }),
  expense({
    id: 'x2',
    title: 'Ăn tối izakaya',
    payerId: 'ban',
    amount: 12000,
    splitMode: 'exact',
    shares: [
      { travelerId: 'minh', amount: 3500 },
      { travelerId: 'lan', amount: 2500 },
      { travelerId: 'hung', amount: 3000 },
      { travelerId: 'ban', amount: 2000 },
      { travelerId: 'bi', amount: 1000 },
    ],
  }),
  expense({ id: 'x3', title: 'Vé tàu', category: 'transport', payerId: 'hung', amount: 46500 }),
  expense({
    id: 'x4',
    title: 'Vé vào cửa trẻ em',
    category: 'sightseeing',
    payerId: 'lan',
    amount: 2000,
    shares: [{ travelerId: 'bi' }],
  }),
  expense({ id: 'x5', title: 'Ăn trưa', payerId: 'lan', amount: 24700 }),
];

describe('S4 / S5 — số dư và quyết toán qua thủ quỹ', () => {
  it('bộ số chốt của spec cho đúng bảng chi phí từng người', () => {
    const rows = Object.fromEntries(personCosts(FIXTURE, TEAM).map((row) => [row.travelerId, row]));

    expect(totalSpent(FIXTURE)).toBe(182400);
    expect(rows.bi!.ownShare).toBe(36680); // bé hết bao nhiêu — con số PO cần
    expect(rows.bi!.payable).toBe(0); // nhưng không nợ ai
    expect(rows.lan!.childBurden).toBe(36680); // Lan gánh trọn suất của Bi
    expect(rows.minh!.balance).toBe(60020);
    expect(rows.hung!.balance).toBe(9820);
    expect(rows.ban!.balance).toBe(-23680);
    expect(rows.lan!.balance).toBe(-46160);
  });

  it('Σ số dư === 0 với mọi tập chi tiêu ngẫu nhiên', () => {
    let seed = 7;
    const rand = (max: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % max;
    };

    for (let run = 0; run < 200; run += 1) {
      const list = Array.from({ length: 1 + rand(6) }, (_, index) =>
        expense({
          id: `r${index}`,
          amount: 1 + rand(99999),
          payerId: ALL_IDS[rand(4)]!,
          shares: ALL_IDS.filter(() => rand(2) === 0).map((id) => ({ travelerId: id })),
        }),
      ).filter((item) => item.shares.length > 0);

      if (list.length === 0) continue;
      const result = balances(list, TEAM);
      expect(Object.values(result).reduce((a, b) => a + b, 0)).toBeCloseTo(0, 6);
      expect(result.bi).toBe(0);
    }
  });

  it('thủ quỹ là người ứng ra nhiều nhất, và mọi số dư về 0 sau khi chuyển', () => {
    const result = balances(FIXTURE, TEAM);
    const treasurer = pickTreasurer(result)!;
    expect(treasurer).toBe('minh');

    const transfers = settleViaTreasurer(result, treasurer);
    expect(transfers).toHaveLength(3);

    const after = { ...result };
    for (const transfer of transfers) {
      after[transfer.fromId] = (after[transfer.fromId] ?? 0) + transfer.amount;
      after[transfer.toId] = (after[transfer.toId] ?? 0) - transfer.amount;
    }
    expect(Object.values(after).every((value) => value === 0)).toBe(true);
  });

  it('mọi số dư đã bằng 0 thì không sinh giao dịch ¥0 nào', () => {
    expect(settleViaTreasurer({ a: 0, b: 0 }, 'a')).toEqual([]);
  });

  it('một người trả hết cho cả nhóm thì đúng n−1 giao dịch', () => {
    const solo = [expense({ id: 'e1', amount: 40000, payerId: 'minh' })];
    const transfers = settleViaTreasurer(balances(solo, TEAM), 'minh');
    // 4 người lớn + 1 trẻ, trẻ có số dư 0 nên không xuất hiện => 3 giao dịch
    expect(transfers).toHaveLength(3);
    expect(transfers.every((transfer) => transfer.toId === 'minh')).toBe(true);
  });

  it('tóm tắt sao chép được ra text thuần', () => {
    const transfers = settleViaTreasurer(balances(FIXTURE, TEAM), 'minh');
    const text = settlementText(transfers, TEAM, 'JPY', 'Kyoto — quyết toán');
    expect(text.split('\n')[0]).toBe('Kyoto — quyết toán');
    expect(text).toContain('Bạn → Minh: ¥23,680');
    expect(text).toContain('Minh → Hùng: ¥9,820');
  });
});

describe('S6 — "Đã trả" ghi thành giao dịch, số dư tự về 0', () => {
  it('ghi đủ các lần trả thì mọi số dư = 0 và "đã chi" không đổi', () => {
    const transfers = settleViaTreasurer(balances(FIXTURE, TEAM), 'minh');
    const settlements = transfers.map((transfer, index) => ({
      ...buildSettlementExpense(transfer, 't1', '2026-09-25', 'u1'),
      id: `s${index}`,
      createdAt: '2026-09-25T00:00:00.000Z',
    }));

    const after = balances([...FIXTURE, ...settlements], TEAM);
    expect(Object.values(after).every((value) => value === 0)).toBe(true);
    // Chuyển tiền nội bộ không phải chi tiêu mới.
    expect(totalSpent([...FIXTURE, ...settlements])).toBe(182400);
  });

  it('giao dịch quyết toán không vào cột "gánh" của bảng chi phí từng người', () => {
    // Hùng đang được nhận ¥9.820 — thủ quỹ Minh trả cho Hùng.
    const settlement = {
      ...buildSettlementExpense({ fromId: 'minh', toId: 'hung', amount: 9820 }, 't1', '2026-09-25', 'u1'),
      id: 's1',
      createdAt: '2026-09-25T00:00:00.000Z',
    };
    const rows = Object.fromEntries(
      personCosts([...FIXTURE, settlement], TEAM).map((row) => [row.travelerId, row]),
    );

    expect(rows.minh!.ownShare).toBe(37180); // y như khi chưa có giao dịch quyết toán
    expect(rows.hung!.ownShare).toBe(36680);
    expect(rows.minh!.settled).toBe(9820);
    expect(rows.hung!.settled).toBe(-9820);
    expect(rows.hung!.balance).toBe(0); // đã nhận đủ phần mình ứng ra
  });
});

describe('S7 — đối chiếu dự trù vs thực tế', () => {
  it('so theo từng loại, không chia cho 0 khi chưa dự trù', () => {
    const plan = [
      {
        id: 'n1',
        parentId: null,
        category: 'transport' as const,
        title: 'Vé tàu',
        pricingMode: 'lumpSum' as const,
        lumpSum: 40000,
        quantity: 1,
        order: 0,
      },
    ];
    const rows = Object.fromEntries(
      varianceByCategory(plan, FIXTURE, { adults: 4, children: 1 }).map((row) => [row.category, row]),
    );

    expect(rows.transport).toMatchObject({ planned: 40000, actual: 46500, diff: 6500 });
    expect(rows.transport!.diffRatio).toBeCloseTo(0.1625, 4);
    // Chưa dự trù đồng nào cho ăn uống mà đã tiêu — tỉ lệ không xác định.
    expect(rows.food!.planned).toBe(0);
    expect(rows.food!.diffRatio).toBeNull();
  });
});

describe('S7 mức 2 — đối chiếu tới từng khoản dự trù', () => {
  const plan: BudgetNode[] = [
    { id: 'hotel', parentId: null, category: 'lodging', title: 'Khách sạn Kyoto', pricingMode: 'lumpSum', lumpSum: 90000, quantity: 1, order: 0 },
    { id: 'room', parentId: 'hotel', category: 'lodging', title: 'Phòng', pricingMode: 'lumpSum', lumpSum: 90000, quantity: 1, order: 0 },
    { id: 'osaka', parentId: null, category: 'lodging', title: 'Khách sạn Osaka', pricingMode: 'lumpSum', lumpSum: 20000, quantity: 1, order: 1 },
  ];
  const party = { adults: 4, children: 1 };

  it('gom chi tiêu về node GỐC — gắn vào mục con không làm đếm trùng', () => {
    const list = [
      expense({ id: 'a', category: 'lodging', payerId: 'minh', amount: 97200, budgetNodeId: 'room' }),
    ];
    const rows = varianceByNode(plan, list, party, 'lodging');

    expect(rows.find((row) => row.nodeId === 'hotel')).toMatchObject({
      planned: 90000,
      actual: 97200,
      diff: 7200,
    });
    expect(rows.find((row) => row.nodeId === 'osaka')).toMatchObject({ planned: 20000, actual: 0 });
    expect(rows.every((row) => row.nodeId !== null)).toBe(true); // không có khoản lạc
  });

  it('chi tiêu chưa gắn khoản nào gom vào dòng "Khác trong nhóm này"', () => {
    const list = [
      expense({ id: 'a', category: 'lodging', payerId: 'minh', amount: 5000 }),
      expense({ id: 'b', category: 'lodging', payerId: 'minh', amount: 1000, budgetNodeId: 'đã-bị-xoá' }),
    ];
    const rows = varianceByNode(plan, list, party, 'lodging');

    expect(rows.find((row) => row.nodeId === null)?.actual).toBe(6000);
  });

  it('tổng của bảng mức 2 luôn khớp con số thực tế của bảng mức 1', () => {
    const list = [
      expense({ id: 'a', category: 'lodging', payerId: 'minh', amount: 97200, budgetNodeId: 'room' }),
      expense({ id: 'b', category: 'lodging', payerId: 'lan', amount: 5000 }),
      expense({ id: 'c', category: 'food', payerId: 'lan', amount: 9000 }),
    ];
    const rows = varianceByNode(plan, list, party, 'lodging');
    const level1 = varianceByCategory(plan, list, party).find((row) => row.category === 'lodging')!;

    expect(rows.reduce((sum, row) => sum + row.actual, 0)).toBe(level1.actual);
    expect(level1.actual).toBe(102200); // khoản 'food' không lọt vào nhóm này
  });

  it('giao dịch quyết toán không lọt vào đối chiếu', () => {
    const list = [
      expense({ id: 'a', category: 'lodging', payerId: 'minh', amount: 5000 }),
      { ...expense({ id: 's', category: 'lodging', payerId: 'lan', amount: 30000 }), kind: 'settlement' as const },
    ];
    expect(varianceByNode(plan, list, party, 'lodging').find((row) => row.nodeId === null)?.actual).toBe(5000);
  });
});
