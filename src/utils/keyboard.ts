import type { KeyboardEvent } from 'react';

// Enter để "xác nhận" ô nhập — NHƯNG bỏ qua Enter dùng để chốt chữ khi gõ tiếng
// Nhật/Việt bằng IME (chọn kanji, dấu). Thiếu kiểm tra này, trên Chrome/Safari
// của macOS, bấm Enter để chốt "京都" sẽ lưu luôn chữ đang gõ dở.
export function isSubmitEnter(event: KeyboardEvent): boolean {
  return event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229;
}
