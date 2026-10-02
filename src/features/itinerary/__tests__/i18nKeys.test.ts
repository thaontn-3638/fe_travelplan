import { describe, expect, it } from 'vitest';
import en from '../../../i18n/locales/en.json';
import ja from '../../../i18n/locales/ja.json';
import vi from '../../../i18n/locales/vi.json';

type Tree = Record<string, unknown>;

function flatten(node: Tree, path: string[] = []): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? flatten(value as Tree, [...path, key])
      : [[...path, key].join('.')],
  );
}

// Tiếng Anh có `_one`/`_other`, tiếng Nhật và tiếng Việt không phân biệt số ít
// số nhiều nên chỉ có một dạng — so sánh theo key gốc, không theo hậu tố.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function baseKeys(node: Tree): Set<string> {
  return new Set(flatten(node).map((key) => key.replace(PLURAL_SUFFIX, '')));
}

const locales = { en, ja, vi } as Record<string, Tree>;

// Đọc cây nguồn qua Vite thay vì node:fs — dự án không cài @types/node.
const SOURCE_FILES = import.meta.glob('../../../**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

describe('i18n', () => {
  it('ba ngôn ngữ có cùng tập key', () => {
    const [base, ...rest] = Object.keys(locales);
    const expected = baseKeys(locales[base!]!);

    for (const name of rest) {
      const keys = baseKeys(locales[name]!);
      expect({ locale: name, missing: [...expected].filter((k) => !keys.has(k)) }).toEqual({
        locale: name,
        missing: [],
      });
      expect({ locale: name, extra: [...keys].filter((k) => !expected.has(k)) }).toEqual({
        locale: name,
        extra: [],
      });
    }
  });

  // hintBothDates từng in ra nguyên tên key vì được lưu dạng `_other` nhưng chỗ
  // gọi không truyền `count` — i18next chỉ tìm hậu tố số nhiều khi có `count`.
  it('mọi key dạng số nhiều đều được gọi kèm count', () => {
    const pluralKeys = flatten(vi as Tree)
      .filter((key) => key.endsWith('_other'))
      .map((key) => key.slice(0, -'_other'.length).split('.').pop()!);

    const sources = Object.entries(SOURCE_FILES)
      .filter(([path]) => !path.includes('__tests__'))
      .map(([, content]) => content)
      .join('\n');
    const offenders = pluralKeys.filter((name) => {
      const calls = [...sources.matchAll(new RegExp(`${name}'\\s*,\\s*\\{([^}]*)\\}`, 'g'))];
      return calls.length > 0 && calls.some((match) => !match[1]!.includes('count'));
    });

    expect(offenders).toEqual([]);
  });
});

