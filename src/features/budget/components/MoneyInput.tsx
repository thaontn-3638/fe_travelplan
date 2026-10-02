import { useEffect, useState } from 'react';
import type { Currency } from '../../../types';
import { formatMoney, fromMinor, minorUnits, parseMoney } from '../utils/money';

interface MoneyInputProps {
  value: number | undefined;
  currency: Currency;
  onChange: (value: number | undefined) => void;
  ariaLabel: string;
  // Giá tham khảo từ Place.price. Chỉ hiện làm gợi ý mờ — KHÔNG tự điền, vì
  // đây là màn tiền và user cần phân biệt số mình đã duyệt với số máy đoán (B4).
  reference?: number;
  disabled?: boolean;
  className?: string;
}

export function MoneyInput({
  value,
  currency,
  onChange,
  ariaLabel,
  reference,
  disabled = false,
  className = '',
}: MoneyInputProps) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  // Trong lúc gõ thì ô là nguồn sự thật; ra khỏi ô mới đồng bộ lại theo state
  // bên ngoài, nếu không con trỏ sẽ nhảy mỗi lần format.
  useEffect(() => {
    if (!focused) {
      setText(value === undefined ? '' : String(fromMinor(value, currency)));
    }
  }, [value, currency, focused]);

  const placeholder =
    reference !== undefined ? formatMoney(reference, currency) : minorUnits(currency) === 0 ? '0' : '0.00';

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      disabled={disabled}
      value={focused ? text : value === undefined ? '' : formatMoney(value, currency)}
      placeholder={placeholder}
      onFocus={() => {
        setFocused(true);
        setText(value === undefined ? '' : String(fromMinor(value, currency)));
      }}
      onBlur={() => setFocused(false)}
      onChange={(event) => {
        setText(event.target.value);
        const parsed = parseMoney(event.target.value, currency);
        onChange(event.target.value.trim() === '' ? undefined : (parsed ?? undefined));
      }}
      className={`w-full rounded-lg border border-line bg-white px-2 py-1.5 text-right font-mono text-[12.5px] text-ink outline-none transition focus:border-ocean disabled:border-transparent disabled:bg-transparent disabled:text-ink-soft ${className}`}
    />
  );
}
