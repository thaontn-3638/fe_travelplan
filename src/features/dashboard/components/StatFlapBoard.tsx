export interface FlapStat {
  id: string;
  label: string;
  value: string;
  accent: 'ocean' | 'coral' | 'amber' | 'violet';
}

const ACCENT_CLASSES: Record<FlapStat['accent'], { card: string; label: string; tile: string }> = {
  ocean: { card: 'bg-ocean-tint', label: 'text-ocean-dark', tile: 'bg-ocean-dark' },
  coral: { card: 'bg-coral-tint', label: 'text-coral-dark', tile: 'bg-coral-dark' },
  amber: { card: 'bg-amber-tint', label: 'text-amber-dark', tile: 'bg-amber-dark' },
  violet: { card: 'bg-violet-tint', label: 'text-violet-dark', tile: 'bg-violet-dark' },
};

function chunkFlapValue(value: string): string[] {
  if (value.length <= 3) {
    return value.split('');
  }

  const mid = Math.ceil(value.length / 2);
  return [value.slice(0, mid), value.slice(mid)];
}

interface StatFlapBoardProps {
  stats: FlapStat[];
}

export function StatFlapBoard({ stats }: StatFlapBoardProps) {
  return (
    <div className="mb-9 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      {stats.map((stat) => {
        const accent = ACCENT_CLASSES[stat.accent];

        return (
          <div key={stat.id} className={`rounded-2xl border border-line p-4 ${accent.card}`}>
            <div className={`mb-2.5 text-[11.5px] font-bold uppercase tracking-[0.08em] ${accent.label}`}>
              {stat.label}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {chunkFlapValue(stat.value).map((chunk, index) => (
                <div
                  key={index}
                  className={`relative min-w-[20px] rounded-[5px] px-2 py-1.5 text-center font-mono text-xl font-semibold text-white after:absolute after:inset-x-0 after:top-1/2 after:h-px after:bg-black/20 ${accent.tile}`}
                >
                  {chunk}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
