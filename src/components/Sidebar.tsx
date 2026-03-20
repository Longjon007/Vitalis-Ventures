import { useNavigate, useLocation } from 'react-router-dom';
import { useProjectStore } from '../core/state/project-store';

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: 'H' },
  { path: '/builder', label: 'Builder', icon: '+' },
  { path: '/music', label: 'MusicForge', icon: 'M' },
  { path: '/tab', label: 'TabForge', icon: 'T' },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const project = useProjectStore((s) => s.project);

  function handleNav(path: string) {
    navigate(path);
    onClose?.();
  }

  return (
    <aside className="w-56 h-full bg-forge-surface border-r border-forge-border flex flex-col shrink-0">
      <div className="p-4 border-b border-forge-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-forge-accent">MusicForge</h1>
          <p className="text-xs text-forge-muted mt-1">+ TabForge</p>
        </div>
        {/* Close button for mobile */}
        <button
          onClick={onClose}
          className="md:hidden text-forge-muted hover:text-forge-text"
        >
          x
        </button>
      </div>

      <nav className="flex-1 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-forge-accent/10 text-forge-accent border-r-2 border-forge-accent'
                  : 'text-forge-muted hover:text-forge-text hover:bg-white/5'
              }`}
            >
              <span className="w-6 h-6 rounded bg-forge-border flex items-center justify-center text-xs font-bold">
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {project && (
        <div className="p-4 border-t border-forge-border">
          <p className="text-xs text-forge-muted">Project</p>
          <p className="text-sm font-medium truncate">{project.name}</p>
          <p className="text-xs text-forge-muted mt-1">
            {project.tempo} BPM | {project.tracks.length} tracks
          </p>
        </div>
      )}
    </aside>
  );
}
