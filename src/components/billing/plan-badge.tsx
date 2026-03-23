import React from 'react';

type PlanBadgeProps = {
  tier?: 'Free' | 'Pro' | 'Enterprise';
};

export function PlanBadge({ tier = 'Free' }: PlanBadgeProps) {
  const styles = {
    Free: 'bg-zinc-800 text-zinc-100',
    Pro: 'bg-indigo-500 text-white',
    Enterprise: 'bg-emerald-500 text-white',
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[tier]}`}>
      {tier}
    </span>
  );
}
