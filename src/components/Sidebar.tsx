import { useNavigate, useLocation } from 'react-router-dom';
import { useProjectStore } from '../core/state/project-store';
import { useSubscriptionStore } from '../core/state/subscription-store';

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: 'H' },
  { path: '/builder', label: 'Builder', icon: '+' },
  { path: '/music', label: 'MusicForge', icon: 'M' },
  { path: '/tab', label: 'TabForge', icon: 'T' },
  { path: '/drums', label: 'Drums', icon: 'D' },
  { path: '/projects', label: 'Projects', icon: 'P' },
];

const BOTTOM_ITEMS = [
  { path: '/store', label: 'Store', icon: 'S' },
  { path: '/pricing', label: 'Pricing', icon: '$' },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const project = useProjectStore((s) => s.project);
  const tier = useSubscriptionStore((s) => s.tier);

  function handleNav(path: string) {
    navigate(path);
    onClose?.();
  }

  function NavButton({ path, label, icon }: { path: string; label: string; icon: string }) {
    const isActive =
      path === '/'
        ? location.pathname === '/'
        : location.pathname === path;
    return (
      <button
        onClick={() => handleNav(path)}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
          isActive
            ? 'bg-forge-accent/10 text-forge-accent border-r-2 border-forge-accent'
            : 'text-forge-muted hover:text-forge-text hover:bg-white/5'
        }`}
      >
        <span className="w-6 h-6 rounded bg-forge-border flex items-center justify-center text-xs font-bold">
          {icon}
        </span>
        {label}
      </button>
    );
  }

  return (
    <aside className="w-56 h-full bg-forge-surface border-r border-forge-border flex flex-col shrink-0">
      <div className="p-4 border-b border-forge-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-forge-accent">MusicForge</h1>
          <p className="text-xs text-forge-muted mt-1">+ TabForge</p>
        </div>
        <button
          onClick={onClose}
          className="md:hidden text-forge-muted hover:text-forge-text"
        >
          x
        </button>
      </div>

      <nav className="flex-1 py-2">
        {NAV_ITEMS.map((item) => (
          <NavButton key={item.path} {...item} />
        ))}
        <div className="my-2 mx-4 border-t border-forge-border" />
        {BOTTOM_ITEMS.map((item) => (
          <NavButton key={item.path} {...item} />
        ))}
      </nav>

      <div className="border-t border-forge-border">
        {project && (
          <div className="px-4 py-3">
            <p className="text-xs text-forge-muted">Project</p>
            <p className="text-sm font-medium truncate">{project.name}</p>
            <p className="text-xs text-forge-muted mt-1">
              {project.tempo} BPM | {project.tracks.length} tracks
            </p>
          </div>
        )}
        <div className="px-4 py-2 border-t border-forge-border">
          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
            tier === 'studio'
              ? 'bg-yellow-500/20 text-yellow-400'
              : tier === 'pro'
              ? 'bg-forge-accent/20 text-forge-accent'
              : 'bg-forge-border text-forge-muted'
          }`}>
            {tier} plan
          </span>
        </div>
      </div>
    </aside>
  );
}
