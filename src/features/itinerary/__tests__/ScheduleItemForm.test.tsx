import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '../../../i18n';
import { ScheduleItemForm } from '../components/ScheduleItemForm';
import type { ItineraryItem } from '../../../types';

const untimed: ItineraryItem = { id: 'i1', kind: 'activity', title: 'Onsen', startTime: null, endTime: null, order: 0 };

describe('Bước 3 — form giờ của một mục', () => {
  it('mục chưa có giờ mà chỉ nhập giờ bắt đầu thì tự điền giờ kết thúc (+60 phút)', () => {
    const onChange = vi.fn();
    render(<ScheduleItemForm item={untimed} place={undefined} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '22:00' } });
    expect(onChange).toHaveBeenCalledWith({ startTime: '22:00', endTime: '23:00' });
  });

  it('chỉ nhập giờ kết thúc thì lùi giờ bắt đầu 60 phút', () => {
    const onChange = vi.fn();
    render(<ScheduleItemForm item={untimed} place={undefined} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('End'), { target: { value: '09:30' } });
    expect(onChange).toHaveBeenCalledWith({ startTime: '08:30', endTime: '09:30' });
  });

  it('không bao giờ ghi một khoảng giờ ngược', () => {
    const onChange = vi.fn();
    render(
      <ScheduleItemForm item={{ ...untimed, startTime: '10:00', endTime: '11:00' }} place={undefined} onChange={onChange} />,
    );

    fireEvent.change(screen.getByLabelText('End'), { target: { value: '09:00' } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
