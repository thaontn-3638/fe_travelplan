import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSharedTrip, shareScopeOf, SharedTripNotFoundError } from '../api/tripApi';
import db from '../../../../db.json';

afterEach(() => vi.restoreAllMocks());

const TOKEN = '0123456789abcdef0123456789abcdef';

describe('Trang chia sẻ — tìm trip theo token', () => {
  it('json-server bỏ qua bộ lọc lạ và trả về mọi trip: vẫn chỉ lấy đúng trip có token', async () => {
    const trips = (db.trips as { id: string }[]).slice(0, 3).map((trip, index) => ({
      ...trip,
      shareToken: index === 1 ? TOKEN : null,
    }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(trips), { status: 200 }));

    const found = await getSharedTrip(TOKEN);
    expect(found.id).toBe(trips[1]!.id);
  });

  it('không có trip nào khớp → link không dùng được', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    await expect(getSharedTrip(TOKEN)).rejects.toBeInstanceOf(SharedTripNotFoundError);
  });

  it('token sai định dạng thì không gọi server', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(getSharedTrip('../../etc')).rejects.toBeInstanceOf(SharedTripNotFoundError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Mức chia sẻ', () => {
  it('dữ liệu cũ (có token, chưa có shareScope) = chỉ mức 1', () => {
    expect(shareScopeOf({ shareToken: TOKEN })).toEqual({ plan: true, actual: false });
  });

  it('không có token thì không chia sẻ gì, bất kể shareScope', () => {
    expect(shareScopeOf({ shareToken: null, shareScope: { plan: true, actual: true } })).toEqual({
      plan: false,
      actual: false,
    });
  });

  it('token còn nhưng tắt cả hai mức → link không dùng được', async () => {
    const trips = [{ ...(db.trips as { id: string }[])[0], shareToken: TOKEN, shareScope: { plan: false, actual: false } }];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(trips), { status: 200 }));
    await expect(getSharedTrip(TOKEN)).rejects.toBeInstanceOf(SharedTripNotFoundError);
  });
});
