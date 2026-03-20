import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { useAuthSync } from '../core/hooks/useAuthSync';

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useAuthSync();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - always visible on md+, toggleable on mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile hamburger */}
        <div className="md:hidden flex items-center gap-3 px-4 py-2 bg-forge-surface border-b border-forge-border">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-forge-muted hover:text-forge-text text-lg"
          >
            |||
          </button>
          <span className="text-sm font-semibold text-forge-accent">MusicForge</span>
        </div>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
