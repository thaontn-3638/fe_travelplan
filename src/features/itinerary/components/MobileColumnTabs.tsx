interface MobileColumnTabsProps {
  activeTab: 'left' | 'right';
  onChange: (tab: 'left' | 'right') => void;
  leftLabel: string;
  rightLabel: string;
}

// Collapses the 2-column board into a tab switcher below `lg` — see spec §5.
export function MobileColumnTabs({ activeTab, onChange, leftLabel, rightLabel }: MobileColumnTabsProps) {
  return (
    <div className="mb-4 inline-flex w-full rounded-xl border border-line bg-white p-1 lg:hidden">
      {(['left', 'right'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`min-h-[44px] flex-1 rounded-lg text-[13px] font-semibold transition ${
            activeTab === tab ? 'bg-ocean-tint text-ocean-dark' : 'text-ink-soft'
          }`}
        >
          {tab === 'left' ? leftLabel : rightLabel}
        </button>
      ))}
    </div>
  );
}
