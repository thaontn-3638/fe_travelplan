import type { Currency } from '../../../types';

// Một chuyến đi dùng đúng một đơn vị tiền (trip-budget.md D1). Mọi phép tính
// chạy trên SỐ NGUYÊN đơn vị nhỏ nhất — yên và đồng không có phần lẻ, đô la
// lưu theo cent — nhờ vậy các bất biến về tổng không bao giờ lệch vì làm tròn.

export const CURRENCIES: Currency[] = ['JPY', 'VND', 'USD'];

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  JPY: '¥',
  VND: '₫',
  USD: '$',
};

const LOCALE: Record<Currency, string> = { JPY: 'ja-JP', VND: 'vi-VN', USD: 'en-US' };

export function minorUnits(currency: Currency): 0 | 2 {
  return currency === 'USD' ? 2 : 0;
}

// Số lưu trong DB -> số hiển thị cho người đọc.
export function fromMinor(amount: number, currency: Currency): number {
  return minorUnits(currency) === 0 ? amount : amount / 100;
}

export function toMinor(value: number, currency: Currency): number {
  return Math.round(minorUnits(currency) === 0 ? value : value * 100);
}

export function formatMoney(amount: number, currency: Currency): string {
  const digits = minorUnits(currency);
  const text = fromMinor(amount, currency).toLocaleString(LOCALE[currency], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

  return currency === 'VND' ? `${text}${CURRENCY_SYMBOL.VND}` : `${CURRENCY_SYMBOL[currency]}${text}`;
}

// ---------------------------------------------------------------------------
// Số DẪN XUẤT (chia tiền, số dư, suất đầu người...) — chính xác tới 2 chữ số
// thập phân.
//
// Số người dùng nhập (khoản chi, đơn giá dự trù) vẫn là số nguyên đơn vị nhỏ
// nhất. Nhưng chia ¥1,000 cho 3 người mà làm tròn tới 1 yên thì mỗi khoản lệch
// tới ±1 yên, và qua vài chục khoản thì lệch cộng dồn. Vì vậy mọi phép chia
// chạy ở độ phân giải 0,01 (của đơn vị hiển thị): JPY/VND tính theo 1/100 yên
// (đồng), USD vẫn theo cent.
// ---------------------------------------------------------------------------

export const PRECISE_DECIMALS = 2;

// Số "đơn vị chính xác" trong 1 đơn vị nhỏ nhất: JPY → 100, USD → 1.
export function preciseScale(currency: Currency): number {
  return 10 ** (PRECISE_DECIMALS - minorUnits(currency));
}

// Đơn vị nhỏ nhất (có thể lẻ) -> số nguyên đơn vị chính xác.
export function toPreciseUnits(amount: number, currency: Currency): number {
  return Math.round(amount * preciseScale(currency));
}

// Số nguyên đơn vị chính xác -> đơn vị nhỏ nhất (có thể lẻ, ví dụ ¥333.33).
export function fromPreciseUnits(units: number, currency: Currency): number {
  return units / preciseScale(currency);
}

// Làm tròn một số dẫn xuất tới 2 chữ số thập phân của đơn vị hiển thị.
export function roundPrecise(amount: number, currency: Currency): number {
  return fromPreciseUnits(toPreciseUnits(amount, currency), currency);
}

// Hiển thị số dẫn xuất: có phần lẻ thì luôn đủ 2 chữ số (¥12.50, ¥333.33);
// số tròn của đơn vị không có phần lẻ thì bỏ ".00" (¥1,000, không ¥1,000.00).
export function formatPrecise(amount: number, currency: Currency): string {
  const rounded = roundPrecise(amount, currency);
  const value = fromMinor(rounded, currency);
  const digits = Number.isInteger(value) ? minorUnits(currency) : PRECISE_DECIMALS;
  const text = value.toLocaleString(LOCALE[currency], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

  return currency === 'VND' ? `${text}${CURRENCY_SYMBOL.VND}` : `${CURRENCY_SYMBOL[currency]}${text}`;
}

// Có dấu +/− cho số dư, số chênh lệch.
export function formatSignedPrecise(amount: number, currency: Currency): string {
  const rounded = roundPrecise(amount, currency);
  if (rounded === 0) {
    return '±0';
  }
  return `${rounded > 0 ? '+' : '−'}${formatPrecise(Math.abs(rounded), currency)}`;
}

// Suất đầu người là số DẪN XUẤT và có thể là phân số (¥1.000 chia 3 người =
// 333,333...). Hiển thị tới 2 chữ số thập phân, và báo cho người đọc biết bằng
// dấu "≈" khi vẫn còn phần lẻ sau đó (trip-budget.md §3.1).
export function formatPerHead(amount: number, currency: Currency): string {
  const inexact = Math.abs(amount - roundPrecise(amount, currency)) > 1e-9;
  return `${inexact ? '≈' : ''}${formatPrecise(amount, currency)}`;
}

// Chuỗi người dùng gõ -> số nguyên đơn vị nhỏ nhất. Chấp nhận dấu phân cách
// nghìn và cả dấu phẩy thập phân (bàn phím tiếng Việt). Trả null khi không đọc
// được, để ô nhập giữ nguyên chữ đang gõ dở thay vì nhảy về 0.
export function parseMoney(raw: string, currency: Currency): number | null {
  // Dấu phân cách hàng nghìn: tiền không có số lẻ (JPY, VND) nhận cả "." lẫn
  // "," ("24.000" kiểu Việt Nam). Tiền có cent (USD) thì "." luôn là dấu thập
  // phân — nếu không "0.125" bị đọc thành "0125" = $125,00.
  const thousands = minorUnits(currency) === 0 ? /[\s.,](?=\d{3}\b)/g : /[\s,](?=\d{3}\b)/g;
  const cleaned = raw.replace(thousands, '').replace(',', '.').replace(/[^\d.-]/g, '');
  if (cleaned === '' || cleaned === '-') {
    return null;
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return toMinor(parsed, currency);
}

// Đổi đơn vị tiền KHÔNG quy đổi tỉ giá (D1) — nhưng vẫn phải quy đổi ĐƠN VỊ
// NHỎ NHẤT. Một khoản lưu 123500 đang là $1.235,00; giữ nguyên con số đó khi
// sang JPY sẽ thành ¥123.500, tức sai đúng 100 lần.
export function rescaleAmount(amount: number, from: Currency, to: Currency): number {
  const factor = 10 ** minorUnits(to) / 10 ** minorUnits(from);
  return Math.round(amount * factor);
}

// Đổi sang đơn vị ít chữ số thập phân hơn thì có làm tròn — caller cần đếm
// trước bao nhiêu khoản bị ảnh hưởng để nói với người dùng.
export function losesPrecision(from: Currency, to: Currency): boolean {
  return minorUnits(to) < minorUnits(from);
}
