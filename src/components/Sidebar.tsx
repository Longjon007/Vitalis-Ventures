import { useNavigate, useLocation } from 'react-router-dom';
import { useProjectStore } from '../core/state/project-store';
import { useSubscriptionStore } from '../core/state/subscription-store';
import { useAuthStore } from '../core/state/auth-store';
import { LyreLogo } from '../pages/LandingPage';

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: 'H' },
  { path: '/builder', label: 'Builder', icon: '+' },
  { path: '/music', label: 'MusicForge', icon: 'M' },
  { path: '/tab', label: 'TabForge', icon: 'T' },
  { path: '/drums', label: 'Drums', icon: 'D' },
  { path: '/ai', label: 'ForgeAI', icon: '*' },
  { path: '/projects', label: 'Projects', icon: 'P' },
];

const APP_ITEMS = [
  { path: '/app', label: 'Dashboard', icon: 'D' },
  { path: '/app/create', label: 'Create', icon: 'C' },
  { path: '/app/account', label: 'Account', icon: 'A' },
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
  const { status: authStatus, user, signOut } = useAuthStore();

  function handleNav(path: string) {
    navigate(path);
    onClose?.();
  }

  function NavButton({ path, label, icon }: { path: string; label: string; icon: string }) {
    const isActive =
      path === '/'
        ? location.pathname === '/'
        : path === '/app'
          ? location.pathname === '/app'
          : location.pathname === path || location.pathname.startsWith(path + '/');
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
        <div className="flex items-center gap-2">
          <LyreLogo className="w-8 h-8 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-bold bg-gradient-to-r from-[#d4a853] to-[#b8860b] bg-clip-text text-transparent truncate">
              Vitalis Ventures
            </h1>
            <p className="text-[10px] text-forge-muted">MusicForge + TabForge</p>
          </div>
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
        {authStatus === 'authenticated' && (
          <>
            <div className="my-2 mx-4 border-t border-forge-border" />
            {APP_ITEMS.map((item) => (
              <NavButton key={item.path} {...item} />
            ))}
          </>
        )}
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

        {/* Auth section */}
        <div className="px-4 py-2 border-t border-forge-border">
          {authStatus === 'authenticated' && user ? (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{user.email}</p>
                <p className="text-[10px] text-forge-muted">Cloud sync active</p>
              </div>
              <button
                onClick={() => signOut()}
                className="text-[10px] text-forge-muted hover:text-forge-text shrink-0 ml-2"
              >
                Sign out
              </button>
            </div>
          ) : authStatus === 'guest' ? (
            <button
              onClick={() => navigate('/login')}
              className="w-full text-left text-xs text-forge-accent hover:text-forge-accent-hover transition-colors"
            >
              Sign in to sync projects
            </button>
          ) : null}
        </div>

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
