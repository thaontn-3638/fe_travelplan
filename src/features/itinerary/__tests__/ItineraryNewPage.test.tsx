import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import '../../../i18n';
import ItineraryNewPage from '../../../pages/ItineraryNewPage';

const createTrip = vi.fn();

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', fullName: 'Nguyen Thao', email: '', phoneNumber: '' } }),
}));

vi.mock('../hooks/useTrips', () => ({
  useTrips: () => ({ trips: [], loading: false, create: createTrip, refresh: vi.fn() }),
}));

vi.mock('../../places/api/regionApi', () => ({
  searchRegions: vi.fn(async () => [{ id: 'r1', name: 'Kyoto', country: 'Japan', source: 'catalog' }]),
}));

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/itinerary/new', element: <ItineraryNewPage /> },
      { path: '/itinerary/:tripId/edit/:step', element: <div>edit step</div> },
    ],
    { initialEntries: ['/itinerary/new'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('Bước 1 — tạo lịch trình', () => {
  beforeEach(() => {
    createTrip.mockReset();
    createTrip.mockResolvedValue({ id: 't99' });
  });

  it('chưa chọn gì thì không lưu được', () => {
    renderPage();
    const submit = screen.getByRole('button', { name: /Save & continue/i });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it('chọn điểm đến xong thì tên chuyến đi được điền sẵn', async () => {
    renderPage();

    const cityInput = screen.getByRole('combobox');
    fireEvent.change(cityInput, { target: { value: 'Kyo' } });

    const option = await screen.findByText('Kyoto', {}, { timeout: 2000 });
    fireEvent.click(option);

    const nameInput = screen.getByPlaceholderText('e.g. Kyoto - Osaka') as HTMLInputElement;
    expect(nameInput.value).toBe('Kyoto');
  });
});
