import React from 'react';

type CreditMeterProps = {
  remaining: number;
  total: number;
};

export function CreditMeter({ remaining, total }: CreditMeterProps) {
  const used = total - remaining;
  const percent = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-2 text-sm font-medium text-zinc-300">Credits</div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-semibold text-white">{remaining} / {total}</div>
        <div className="text-xs text-zinc-400">{Math.round(percent)}% used</div>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full bg-emerald-400" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
