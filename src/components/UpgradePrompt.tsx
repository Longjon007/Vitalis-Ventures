import { useNavigate } from 'react-router-dom';
import { Button } from './Button';

interface UpgradePromptProps {
  feature: string;
  requiredTier?: string;
}

export function UpgradePrompt({ feature, requiredTier = 'Pro' }: UpgradePromptProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-forge-accent/10 flex items-center justify-center mb-3">
        <span className="text-forge-accent text-xl">$</span>
      </div>
      <h3 className="font-semibold text-sm mb-1">{feature} requires {requiredTier}</h3>
      <p className="text-xs text-forge-muted mb-4 max-w-xs">
        Upgrade your plan to unlock this feature and more.
      </p>
      <Button size="sm" variant="primary" onClick={() => navigate('/pricing')}>
        View Plans
      </Button>
    </div>
  );
}
