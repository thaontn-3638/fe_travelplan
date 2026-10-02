import { describe, expect, it } from 'vitest';
import {
  formatMoney,
  formatPerHead,
  formatPrecise,
  formatSignedPrecise,
  fromMinor,
  minorUnits,
  parseMoney,
  roundPrecise,
  toMinor,
} from '../utils/money';

describe('đơn vị tiền', () => {
  it('yên và đồng không có phần lẻ, đô la lưu theo cent', () => {
    expect(minorUnits('JPY')).toBe(0);
    expect(minorUnits('VND')).toBe(0);
    expect(minorUnits('USD')).toBe(2);

    expect(toMinor(12.35, 'USD')).toBe(1235);
    expect(fromMinor(1235, 'USD')).toBe(12.35);
    expect(toMinor(12000, 'JPY')).toBe(12000);
  });

  it('định dạng theo đúng đơn vị', () => {
    expect(formatMoney(24000, 'JPY')).toBe('¥24,000');
    expect(formatMoney(1235, 'USD')).toBe('$12.35');
    expect(formatMoney(150000, 'VND')).toContain('₫');
  });

  it('đọc được chuỗi người dùng gõ, kể cả có dấu phân cách', () => {
    expect(parseMoney('24000', 'JPY')).toBe(24000);
    expect(parseMoney('24,000', 'JPY')).toBe(24000);
    expect(parseMoney('24.000', 'VND')).toBe(24000); // dấu chấm kiểu Việt Nam
    expect(parseMoney('12.35', 'USD')).toBe(1235);
    expect(parseMoney('12,35', 'USD')).toBe(1235); // dấu phẩy thập phân
    expect(parseMoney('1,234.50', 'USD')).toBe(123450);
    // "." của USD luôn là dấu thập phân, không phải phân cách hàng nghìn
    expect(parseMoney('0.125', 'USD')).toBe(13);
  });

  it('chuỗi không đọc được trả null thay vì 0 — để ô nhập không nhảy số khi đang gõ', () => {
    expect(parseMoney('', 'JPY')).toBeNull();
    expect(parseMoney('abc', 'JPY')).toBeNull();
    expect(parseMoney('-5', 'JPY')).toBeNull();
  });

  it('suất đầu người hiện tới 2 chữ số thập phân, còn lẻ thì đánh dấu ≈', () => {
    expect(formatPerHead(1000 / 3, 'JPY')).toBe('≈¥333.33');
    expect(formatPerHead(500 / 4, 'JPY')).toBe('¥125');
    expect(formatPerHead(18000, 'JPY')).toBe('¥18,000');
  });

  it('số dẫn xuất chính xác tới 0,01 của đơn vị hiển thị', () => {
    expect(roundPrecise(1000 / 3, 'JPY')).toBe(333.33);
    expect(roundPrecise(1000 / 3, 'USD')).toBe(333); // cent — 2 chữ số của đô la
    expect(formatPrecise(333.33, 'JPY')).toBe('¥333.33');
    expect(formatPrecise(1000, 'JPY')).toBe('¥1,000');
    expect(formatPrecise(1235, 'USD')).toBe('$12.35');
    expect(formatSignedPrecise(-0.004, 'JPY')).toBe('±0');
    expect(formatSignedPrecise(-12.5, 'JPY')).toBe('−¥12.50');
  });
});
