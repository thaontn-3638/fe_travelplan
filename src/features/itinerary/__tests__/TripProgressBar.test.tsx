import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../i18n';
import { TripProgressBar } from '../components/TripProgressBar';

describe('TripProgressBar', () => {
  it('hiển thị tiến độ trên tổng 4 bước', () => {
    render(<TripProgressBar progress={2} />);
    expect(screen.getByText('2/4')).toBeTruthy();
  });

  it('trip mới tạo là 1/4', () => {
    render(<TripProgressBar progress={1} />);
    expect(screen.getByText('1/4')).toBeTruthy();
  });
});
