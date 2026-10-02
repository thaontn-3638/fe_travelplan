import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import type { BudgetNode, CostCategory, Currency, PartySize } from '../../../types';
import { formatMoney as fmt } from '../utils/money';
import { COST_CATEGORIES } from '../../../types';
import { MoneyInput } from './MoneyInput';
import { formatMoney } from '../utils/money';
import { MAX_BUDGET_TITLE_LENGTH, nodeTotal } from '../utils/budgetRules';

export interface BudgetNodeRowProps {
  node: BudgetNode;
  plan: BudgetNode[];
  party: PartySize;
  currency: Currency;
  depth: number;
  hasChildren: boolean;
  childCount: number;
  collapsed: boolean;
  canAddChild: boolean;
  dayLabel?: string | null;
  onDayClick?: () => void;
  // Giá tham khảo từ Place.price. Khác đơn vị tiền thì CHỈ hiện chú thích, không
  // chạm vào ô nhập — nhưng cũng không được giấu biến thông tin đi (B4).
  reference?: { amount: number; currency: Currency; unit?: string; sameCurrency: boolean };
  // Mục lịch trình gắn với khoản này đã bị xoá — giữ tiền, chỉ báo cho user biết (B3.6).
  orphaned?: boolean;
  showChildPrice: boolean;
  gridClass: string;
  onToggle: () => void;
  onPatch: (patch: Partial<BudgetNode>) => void;
  onAddChild: () => void;
  onDuplicate: () => void;
  onChangeCategory: (category: CostCategory) => void;
  onRemove: () => void;
}

type PricingChoice = 'lumpSum' | 'lumpSumAdults' | 'perPerson';

function patchForMode(choice: PricingChoice): Partial<BudgetNode> {
  if (choice === 'perPerson') {
    return { pricingMode: 'perPerson', lumpSum: undefined, lumpSumSplit: undefined };
  }
  return {
    pricingMode: 'lumpSum',
    lumpSumSplit: choice === 'lumpSumAdults' ? 'adultsOnly' : 'perHead',
    unitAdult: undefined,
    unitChild: undefined,
  };
}

// Dưới breakpoint lg các ô xếp chồng thành một cột. Không có nhãn thì chúng chỉ
// là một chuỗi ô số giống hệt nhau — nhìn không ra ô nào là giá trẻ em, ô nào
// là số lượng. Tiêu đề cột ở trên chỉ tồn tại từ lg trở lên.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 lg:block">
      <span className="w-24 flex-shrink-0 text-[11.5px] font-semibold text-ink-soft lg:hidden">{label}</span>
      <span className="min-w-0 flex-1 lg:block">{children}</span>
    </div>
  );
}

export function BudgetNodeRow({
  node,
  plan,
  party,
  currency,
  depth,
  hasChildren,
  childCount,
  collapsed,
  canAddChild,
  dayLabel,
  onDayClick,
  reference,
  orphaned = false,
  showChildPrice,
  gridClass,
  onToggle,
  onPatch,
  onAddChild,
  onDuplicate,
  onChangeCategory,
  onRemove,
}: BudgetNodeRowProps) {
  const { t } = useTranslation();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [categoryAnchor, setCategoryAnchor] = useState<HTMLElement | null>(null);

  const total = nodeTotal(node, plan, party);
  const perPerson = node.pricingMode === 'perPerson';
  const mode: PricingChoice = perPerson
    ? 'perPerson'
    : (node.lumpSumSplit ?? 'perHead') === 'adultsOnly'
      ? 'lumpSumAdults'
      : 'lumpSum';

  function openMenu(event: MouseEvent<HTMLButtonElement>): void {
    setMenuAnchor(event.currentTarget);
  }

  return (
    <div
      className={`flex flex-col gap-2 border-b border-line px-3 py-2 last:border-b-0 lg:items-center lg:gap-2 ${gridClass}`}
      style={{ paddingLeft: `${12 + (depth - 1) * 20}px` }}
    >
      {/* Tên + chevron + chip ngày */}
      <div className="flex min-w-0 items-center gap-1.5">
        {hasChildren ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={t('itinerary.step4.toggleChildren')}
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-ink-soft hover:bg-surface"
          >
            {collapsed ? (
              <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
            ) : (
              <ExpandMoreRoundedIcon sx={{ fontSize: 18 }} />
            )}
          </button>
        ) : (
          <span className="h-5 w-5 flex-shrink-0" />
        )}

        <input
          value={node.title}
          maxLength={MAX_BUDGET_TITLE_LENGTH}
          placeholder={t('itinerary.step4.titlePlaceholder')}
          onChange={(event) => onPatch({ title: event.target.value })}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-[13px] font-semibold text-ink outline-none transition hover:border-line focus:border-ocean focus:bg-white"
        />

        {dayLabel &&
          (onDayClick ? (
            <button
              type="button"
              onClick={onDayClick}
              className="flex-shrink-0 rounded-full bg-ocean-tint px-2 py-0.5 text-[11px] font-semibold text-ocean-dark transition hover:bg-ocean hover:text-white"
            >
              {dayLabel}
            </button>
          ) : (
            <span className="flex-shrink-0 rounded-full bg-ocean-tint px-2 py-0.5 text-[11px] font-semibold text-ocean-dark">
              {dayLabel}
            </span>
          ))}
        {orphaned && (
          // Chỉ icon, không nhãn chữ: nhãn "Mục đã bị xoá khỏi lịch trình" dài
          // hơn phần tên còn lại nên đẩy ô nhập tên co về 0 và mất hẳn.
          <Tooltip title={t('itinerary.step4.orphanedHint')}>
            <span
              aria-label={t('itinerary.step4.orphanedBadge')}
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-tint text-amber-dark"
            >
              <LinkOffRoundedIcon sx={{ fontSize: 13 }} />
            </span>
          </Tooltip>
        )}
      </div>

      {hasChildren ? (
        // §3.2 — node có con thì tiền của nó LÀ tổng của các con; mọi ô nhập bị
        // khoá để tổng của cha chỉ có một nguồn duy nhất.
        <p
          className={`m-0 text-[12px] italic text-ink-soft lg:text-right ${
            showChildPrice ? 'lg:col-span-4' : 'lg:col-span-3'
          }`}
        >
          {t('itinerary.step4.sumOfChildren', { count: childCount })}
        </p>
      ) : (
        <>
          {/* Một select thay vì hai. Trước đây "cách tính" và "chia cho" là hai
              ô riêng, và ô "chia cho" chiếm đúng cột Trẻ em — nên tiêu đề cột
              nói "Trẻ em" mà bên dưới lại là một select ghi "Cả nhóm". */}
          <Field label={t('itinerary.step4.colMode')}>
            <select
              value={mode}
              aria-label={t('itinerary.step4.colMode')}
              onChange={(event) => onPatch(patchForMode(event.target.value as PricingChoice))}
              className="w-full rounded-lg border border-line bg-white px-1.5 py-1.5 text-[12px] text-ink-soft outline-none focus:border-ocean"
            >
              <option value="lumpSum">{t('itinerary.step4.modeLumpSum')}</option>
              <option value="lumpSumAdults">{t('itinerary.step4.modeLumpSumAdults')}</option>
              <option value="perPerson">{t('itinerary.step4.modePerPerson')}</option>
            </select>
          </Field>

          <Field label={t('itinerary.step4.colAmount')}>
            {perPerson ? (
              <MoneyInput
                value={node.unitAdult}
                currency={currency}
                reference={reference?.sameCurrency ? reference.amount : undefined}
                ariaLabel={showChildPrice ? t('itinerary.step4.colAdult') : t('itinerary.step4.colAmount')}
                onChange={(value) => onPatch({ unitAdult: value })}
              />
            ) : (
              <MoneyInput
                value={node.lumpSum}
                currency={currency}
                reference={reference?.sameCurrency ? reference.amount : undefined}
                ariaLabel={t('itinerary.step4.colAmount')}
                onChange={(value) => onPatch({ lumpSum: value })}
              />
            )}
          </Field>

          {showChildPrice && (
            <Field label={t('itinerary.step4.colChild')}>
              {perPerson ? (
                <MoneyInput
                  value={node.unitChild}
                  currency={currency}
                  ariaLabel={t('itinerary.step4.colChild')}
                  onChange={(value) => onPatch({ unitChild: value })}
                />
              ) : (
                // Khoản trọn gói không có giá riêng cho trẻ em — ai gánh nó đã
                // nằm trong ô "cách tính" bên trái.
                <span className="block py-1.5 text-right text-[12.5px] text-ink-soft">—</span>
              )}
            </Field>
          )}

          <Field label={t('itinerary.step4.colQty')}>
            <input
              type="number"
              min={1}
              step={1}
              value={node.quantity}
              aria-label={t('itinerary.step4.colQty')}
              onChange={(event) => onPatch({ quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) })}
              className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-right font-mono text-[12.5px] text-ink outline-none focus:border-ocean"
            />
          </Field>
        </>
      )}

      <p className="m-0 text-right font-mono text-[13px] font-semibold text-ink">
        {formatMoney(total, currency)}
      </p>

      {reference && !hasChildren && (
        <p
          className={`m-0 text-[11px] text-ink-soft lg:col-span-full lg:pl-6 ${
            showChildPrice ? '' : ''
          }`}
        >
          {t('itinerary.step4.referenceHint', {
            amount: fmt(reference.amount, reference.currency),
            unit: reference.unit ? t(`itinerary.step4.priceUnit.${reference.unit}`) : '',
          })}
          {reference.sameCurrency ? (
            <button
              type="button"
              onClick={() =>
                onPatch(
                  perPerson ? { unitAdult: reference.amount } : { lumpSum: reference.amount },
                )
              }
              className="ml-2 font-semibold text-ocean-dark underline-offset-2 hover:underline"
            >
              {t('itinerary.step4.useReference')}
            </button>
          ) : (
            // Khác đơn vị tiền thì KHÔNG đưa số vào ô nhập — nhưng vẫn phải nói
            // ra, giấu đi là mất thông tin người dùng cần (B4).
            <span className="ml-2 italic">{t('itinerary.step4.referenceOtherCurrency')}</span>
          )}
        </p>
      )}

      <div className="flex justify-end">
        <IconButton size="small" onClick={openMenu} aria-label={t('itinerary.step4.rowMenu')}>
          <MoreHorizRoundedIcon fontSize="small" />
        </IconButton>
      </div>

      <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          disabled={!canAddChild}
          onClick={() => {
            setMenuAnchor(null);
            onAddChild();
          }}
        >
          {canAddChild ? t('itinerary.step4.addChild') : t('itinerary.step4.maxDepth')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onDuplicate();
          }}
        >
          {t('itinerary.step4.duplicate')}
        </MenuItem>
        {depth === 1 && (
          <MenuItem onClick={(event) => setCategoryAnchor(event.currentTarget)}>
            {t('itinerary.step4.changeCategory')}
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onRemove();
          }}
        >
          <span className="text-coral-dark">{t('itinerary.step4.remove')}</span>
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={categoryAnchor}
        open={categoryAnchor !== null}
        onClose={() => setCategoryAnchor(null)}
      >
        {COST_CATEGORIES.map((category) => (
          <MenuItem
            key={category}
            selected={category === node.category}
            onClick={() => {
              setCategoryAnchor(null);
              setMenuAnchor(null);
              onChangeCategory(category);
            }}
          >
            {t(`itinerary.step4.category.${category}`)}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}
