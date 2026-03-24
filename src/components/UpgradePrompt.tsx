import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { trackEvent } from '../core/analytics/tracker';

interface UpgradePromptProps {
  feature: string;
  requiredTier?: string;
  ctaPath?: string;
}

export function UpgradePrompt({ feature, requiredTier = 'Pro', ctaPath = '/pricing' }: UpgradePromptProps) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    trackEvent('upgrade_prompt_viewed', {
      feature,
      requiredTier,
      path: location.pathname,
    });
  }, [feature, requiredTier, location.pathname]);

  function handleClick() {
    trackEvent('upgrade_prompt_clicked', {
      feature,
      requiredTier,
      path: location.pathname,
      targetPath: ctaPath,
    });
    navigate(ctaPath);
  }

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-forge-accent/10 flex items-center justify-center mb-3">
        <span className="text-forge-accent text-xl">+</span>
      </div>
      <h3 className="font-semibold text-sm mb-1">Unlock more workspace power</h3>
      <p className="text-xs text-forge-muted mb-3 max-w-xs">
        Upgrade for unlimited projects, full effects chain, MIDI/WAV export, and more AI generation credits.
      </p>
      <ul className="text-xs text-forge-muted space-y-1 mb-3">
        <li>Unlimited projects & tracks</li>
        <li>Full export and effects tools</li>
        <li>More AI generation capacity</li>
      </ul>
      <p className="text-[11px] text-forge-muted mb-4">
        Recommended for {feature}: <span className="text-forge-accent font-medium">{requiredTier}</span>
      </p>
      <Button size="sm" variant="primary" onClick={handleClick}>
        Upgrade Now
      </Button>
    </div>
  );
}
