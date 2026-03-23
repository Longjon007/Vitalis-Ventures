import { Link } from 'react-router-dom';

export function TopNav() {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-lg font-semibold text-white">
          MusicForge AI
        </Link>
        <nav className="flex items-center gap-4 text-sm text-zinc-300">
          <Link to="/pricing" className="hover:text-white">Pricing</Link>
          <Link to="/projects" className="hover:text-white">Projects</Link>
          <Link to="/app" className="rounded-lg bg-white px-3 py-2 font-medium text-black">Open App</Link>
        </nav>
      </div>
    </header>
  );
}