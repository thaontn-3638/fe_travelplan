import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestList } from '../api/httpClient';

function isRow(value: unknown): value is { id: string } {
  return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string';
}

afterEach(() => vi.restoreAllMocks());

describe('requestList', () => {
  it('bỏ qua bản ghi hỏng thay vì làm sập cả danh sách', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ id: 'a' }, { id: 42 }, { id: 'b' }]), { status: 200 }),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(requestList('/x', isRow)).resolves.toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('response không phải mảng vẫn là lỗi', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'a' }), { status: 200 }));
    await expect(requestList('/x', isRow)).rejects.toThrow();
  });
});
