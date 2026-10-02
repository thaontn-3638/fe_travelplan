import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '../../../i18n';
import type { Traveler, Trip } from '../../../types';
import { ExpenseForm } from '../components/ExpenseForm';

const MINH: Traveler = { id: 'a-minh', fullName: 'Minh', initials: 'M', colorClass: 'bg-ocean', userId: 'u1' };
const LAN: Traveler = { id: 'b-lan', fullName: 'Lan', initials: 'L', colorClass: 'bg-coral' };
const BI: Traveler = { id: 'c-bi', fullName: 'Bi', initials: 'B', colorClass: 'bg-mint', isChild: true, guardianId: 'b-lan' };

const trip: Trip = {
  id: 't1',
  name: 'Kyoto',
  regions: [{ id: 'r1', name: 'Kyoto' }],
  startDate: '2026-09-20',
  endDate: '2026-09-21',
  status: 'ongoing',
  travelers: [MINH, LAN, BI],
  party: { adults: 2, children: 1 },
  currency: 'JPY',
  budget: null,
  budgetPerPerson: null,
  spent: 0,
  budgetPlan: [],
  days: [{ id: 'd1', date: '2026-09-20', items: [] }],
  unscheduledItems: [],
  updatedAt: '2026-09-20T00:00:00.000Z',
};

function setup() {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<ExpenseForm trip={trip} currentUserId="u1" onSubmit={onSubmit} onCancel={vi.fn()} />);
  return { onSubmit };
}

function typeAmount(value: string): void {
  const input = screen.getByLabelText('Amount');
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
}

describe('Ghi chi tiêu', () => {
  it('chia đều mặc định cho mọi thành viên, chính xác tới 0,01 yên', () => {
    setup();
    typeAmount('1000');

    // 1000 / 3 => 333.34 + 333.33 + 333.33, tổng đúng 1000
    expect(screen.getByText('¥333.34')).toBeTruthy();
    expect(screen.getAllByText('¥333.33')).toHaveLength(2);
  });

  it('trẻ em hiện ngay ai đang gánh, không đợi tới lúc quyết toán', () => {
    setup();
    expect(screen.getByText('paid by Lan')).toBeTruthy();
  });

  it('bỏ chọn một người thì chia lại ngay cho những người còn lại', () => {
    setup();
    typeAmount('900');
    fireEvent.click(screen.getByLabelText('Bi'));

    expect(screen.getAllByText('¥450')).toHaveLength(2);
  });

  it('chuyển sang "Nhập riêng" thì điền sẵn số của chế độ chia đều', () => {
    setup();
    typeAmount('900');
    fireEvent.click(screen.getByLabelText('Enter per person'));

    const inputs = screen.getAllByDisplayValue('¥300');
    expect(inputs).toHaveLength(3);
    expect(screen.getByText('Fully allocated')).toBeTruthy();
  });

  it('nhập riêng mà lệch tổng thì CHẶN LƯU và nói rõ còn thiếu bao nhiêu', () => {
    const { onSubmit } = setup();
    typeAmount('900');
    fireEvent.click(screen.getByLabelText('Enter per person'));

    const share = screen.getByLabelText('Share of Minh');
    fireEvent.focus(share);
    fireEvent.change(share, { target: { value: '100' } });

    expect(screen.getByText('¥200 left to allocate')).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toHaveProperty('disabled', true);

    fireEvent.click(save);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('nút "Dồn phần còn lại" đưa tổng về khớp', () => {
    setup();
    typeAmount('900');
    fireEvent.click(screen.getByLabelText('Enter per person'));

    const share = screen.getByLabelText('Share of Minh');
    fireEvent.focus(share);
    fireEvent.change(share, { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /Put the rest on/ }));

    expect(screen.getByText('Fully allocated')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);
  });

  it('gửi lên đúng shares, và chỉ kèm số tiền khi ở chế độ nhập riêng', async () => {
    const { onSubmit } = setup();
    typeAmount('900');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [input] = onSubmit.mock.calls[0]!;
    expect(input.amount).toBe(900);
    expect(input.splitMode).toBe('equal');
    expect(input.shares).toEqual([
      { travelerId: 'a-minh' },
      { travelerId: 'b-lan' },
      { travelerId: 'c-bi' },
    ]);
    // Tên để trống thì lấy tên loại chi phí, không lưu chuỗi rỗng.
    expect(input.title).toBe('Food');
  });

  it('trẻ em đứng đầu danh sách vẫn KHÔNG rơi vào ô người ứng tiền', () => {
    // Lỗi cũ: state mặc định lấy travelers[0] không lọc trẻ em, trong khi ô
    // chọn chỉ liệt kê người lớn => ô hiện tên người lớn nhưng state giữ id của
    // bé, và khoản chi lưu xuống với payerId là trẻ => số dư của trẻ khác 0.
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const childFirst: Trip = { ...trip, travelers: [BI, MINH, LAN] };
    render(<ExpenseForm trip={childFirst} currentUserId="không-khớp-ai" onSubmit={onSubmit} onCancel={vi.fn()} />);

    const payer = screen.getByLabelText('Paid by') as HTMLSelectElement;
    expect(payer.value).toBe('a-minh');
    expect([...payer.options].map((option) => option.value)).not.toContain('c-bi');
  });

  it('trẻ em không được chọn làm người ứng tiền', () => {
    setup();
    const options = [...(screen.getByLabelText('Paid by') as HTMLSelectElement).options].map((o) => o.text);
    expect(options).toEqual(['Minh', 'Lan']);
  });

  it('xoá trắng ngày thì không lưu được — bản ghi thiếu ngày làm hỏng cả danh sách', () => {
    setup();
    typeAmount('1200');
    fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
    expect(screen.getByText('Enter a date')).toBeTruthy();
  });

  it('lưu thất bại thì báo lỗi và giữ nguyên số đã nhập', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('offline'));
    render(<ExpenseForm trip={trip} currentUserId="u1" onSubmit={onSubmit} onCancel={vi.fn()} />);
    typeAmount('1200');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);
  });
});

