import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import '../../../i18n';
import { PlacePickerPanel } from '../components/PlacePickerPanel';
import type { Place } from '../../../types';

// Form tạo place có ô chọn vùng gọi API — ở đây chỉ kiểm tra lối vào và giá trị điền sẵn.
vi.mock('../../places/api/regionApi', () => ({ searchRegions: vi.fn(async () => []) }));

const kyotoTemple: Place = {
  id: 'p1',
  title: 'Kinkaku-ji',
  coverUrl: 'x.jpg',
  address: 'Kyoto',
  region: 'Kyoto',
  category: 'attraction',
  source: 'catalog',
  savedCount: 3,
};

function renderPanel() {
  return render(
    <DndContext>
      <PlacePickerPanel
        savedPlaces={[]}
        placesById={new Map([[kyotoTemple.id, kyotoTemple]])}
        regions={[{ id: 'r1', name: 'Kyoto', source: 'catalog' }]}
        tripRegions={[{ id: 'r1', name: 'Kyoto' }]}
        days={[]}
        usageByPlaceId={new Map()}
        category={null}
        currentUserId="u1"
        onAddPlace={vi.fn()}
        onPlaceCreated={vi.fn()}
      />
    </DndContext>,
  );
}

describe('Bước 2 — tạo place ngay trong panel chọn địa điểm', () => {
  it('có kết quả vẫn luôn có lối "Thêm địa điểm" ở cuối danh sách', () => {
    renderPanel();
    fireEvent.click(screen.getByText('All places'));
    expect(screen.getByText('Kinkaku-ji')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a place' })).toBeTruthy();
  });

  it('tìm không ra thì mở form với tên đã gõ và vùng của chuyến đi điền sẵn', () => {
    renderPanel();
    fireEvent.click(screen.getByText('All places'));
    fireEvent.change(screen.getByPlaceholderText('Search places…'), { target: { value: 'Quán ramen nhà Kenji' } });

    expect(screen.getByText('No places match "Quán ramen nhà Kenji".')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));

    expect((screen.getByLabelText(/Name/i) as HTMLInputElement).value).toBe('Quán ramen nhà Kenji');
    expect(screen.getByDisplayValue('Kyoto')).toBeTruthy();
  });
});
