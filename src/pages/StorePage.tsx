import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscriptionStore } from '../core/state/subscription-store';
import { useStoreItemsStore } from '../core/state/store-items-store';
import { useProjectStore } from '../core/state/project-store';
import { INSTRUMENTS } from '../core/types/instrument';
import { Button } from '../components/Button';

interface StoreItem {
  id: string;
  name: string;
  description: string;
  category: 'sound-pack' | 'template' | 'preset' | 'ai-pack';
  price: string;
  tags: string[];
}

const STORE_ITEMS: StoreItem[] = [
  {
    id: 'sp-lo-fi',
    name: 'Lo-Fi Chill Pack',
    description: 'Warm, vintage-style synth presets perfect for lo-fi beats and chill vibes.',
    category: 'sound-pack',
    price: 'Pro',
    tags: ['lo-fi', 'chill', 'synth'],
  },
  {
    id: 'sp-orchestral',
    name: 'Orchestral Essentials',
    description: 'Realistic string, brass, and woodwind patches for cinematic compositions.',
    category: 'sound-pack',
    price: 'Pro',
    tags: ['orchestral', 'cinematic', 'strings'],
  },
  {
    id: 'sp-edm',
    name: 'EDM Power Pack',
    description: 'Hard-hitting basses, leads, and risers for electronic dance music.',
    category: 'sound-pack',
    price: 'Pro',
    tags: ['edm', 'electronic', 'bass'],
  },
  {
    id: 'tp-jazz',
    name: 'Jazz Ensemble Template',
    description: 'Pre-configured 5-track jazz setup with piano, bass, drums, sax, and trumpet.',
    category: 'template',
    price: 'Free',
    tags: ['jazz', 'ensemble'],
  },
  {
    id: 'tp-ambient',
    name: 'Ambient Layers Template',
    description: 'Atmospheric multi-layer template with pad, strings, and effects.',
    category: 'template',
    price: 'Free',
    tags: ['ambient', 'atmospheric'],
  },
  {
    id: 'pr-guitar-fx',
    name: 'Guitar Effects Presets',
    description: 'Curated effects chain presets for clean, crunch, and lead guitar tones.',
    category: 'preset',
    price: 'Pro',
    tags: ['guitar', 'effects', 'presets'],
  },
  {
    id: 'pr-vocal',
    name: 'Vocal Processing Presets',
    description: 'Studio-quality reverb and compression presets for vocal tracks.',
    category: 'preset',
    price: 'Studio',
    tags: ['vocal', 'effects', 'studio'],
  },
  {
    id: 'tp-metal',
    name: 'Metal Template',
    description: 'Heavy 6-track template with dual guitars, bass, drums, and lead.',
    category: 'template',
    price: 'Pro',
    tags: ['metal', 'rock', 'heavy'],
  },
  {
    id: 'ai-cinematic',
    name: 'AI Cinematic Prompts',
    description: 'Curated prompt collection for generating epic orchestral, trailer, and cinematic music with ForgeAI.',
    category: 'ai-pack',
    price: 'Pro',
    tags: ['ai', 'cinematic', 'orchestral'],
  },
  {
    id: 'ai-lofi-beats',
    name: 'AI Lo-Fi Generator Pack',
    description: 'Optimized prompts and settings for generating chill lo-fi beats, jazzy loops, and ambient textures.',
    category: 'ai-pack',
    price: 'Pro',
    tags: ['ai', 'lo-fi', 'chill'],
  },
  {
    id: 'ai-edm-pack',
    name: 'AI EDM Production Pack',
    description: 'Generate hard-hitting drops, buildups, and electronic dance tracks with stem separation included.',
    category: 'ai-pack',
    price: 'Studio',
    tags: ['ai', 'edm', 'electronic'],
  },
  {
    id: 'ai-songwriting',
    name: 'AI Songwriting Assistant',
    description: 'Guided prompt templates for full songs with lyrics, verse-chorus structure, and vocal generation.',
    category: 'ai-pack',
    price: 'Studio',
    tags: ['ai', 'vocals', 'songwriting'],
  },
];

// Template definitions - what tracks to create when a template is installed/applied
const TEMPLATE_CONFIGS: Record<string, { tracks: { name: string; instrument: string }[]; tempo: number; key: string }> = {
  'tp-jazz': {
    tracks: [
      { name: 'Piano', instrument: 'piano' },
      { name: 'Upright Bass', instrument: 'bass' },
      { name: 'Drums', instrument: 'drums' },
      { name: 'Sax', instrument: 'synth' },
      { name: 'Trumpet', instrument: 'synth' },
    ],
    tempo: 130,
    key: 'Bb',
  },
  'tp-ambient': {
    tracks: [
      { name: 'Pad Layer 1', instrument: 'pad' },
      { name: 'Pad Layer 2', instrument: 'pad' },
      { name: 'Strings', instrument: 'strings' },
      { name: 'Atmosphere', instrument: 'synth' },
    ],
    tempo: 72,
    key: 'Am',
  },
  'tp-metal': {
    tracks: [
      { name: 'Rhythm Guitar L', instrument: 'guitar' },
      { name: 'Rhythm Guitar R', instrument: 'guitar' },
      { name: 'Lead Guitar', instrument: 'guitar' },
      { name: 'Bass', instrument: 'bass' },
      { name: 'Drums', instrument: 'drums' },
      { name: 'Lead Synth', instrument: 'synth' },
    ],
    tempo: 160,
    key: 'Em',
  },
};

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'sound-pack', label: 'Sound Packs' },
  { key: 'template', label: 'Templates' },
  { key: 'preset', label: 'Presets' },
  { key: 'ai-pack', label: 'AI Packs' },
];

export function StorePage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const canAccess = useSubscriptionStore((s) => s.canAccess);
  const tier = useSubscriptionStore((s) => s.tier);
  const { installedIds, install, uninstall } = useStoreItemsStore();
  const createProject = useProjectStore((s) => s.createProject);

  const handleInstall = useCallback((item: StoreItem) => {
    if (installedIds.includes(item.id)) {
      uninstall(item.id);
      return;
    }

    install(item.id);

    // If it's a template, offer to create a project from it
    if (item.category === 'template') {
      const config = TEMPLATE_CONFIGS[item.id];
      if (config) {
        createProject({
          name: `${item.name}`,
          tempo: config.tempo,
          timeSignature: [4, 4],
          key: config.key,
          tracks: config.tracks.map((t) => ({
            name: t.name,
            instrument: INSTRUMENTS[t.instrument] ?? INSTRUMENTS.synth,
          })),
        });
        navigate('/music');
      }
    }
  }, [installedIds, install, uninstall, createProject, navigate]);

  const filtered = STORE_ITEMS.filter((item) => {
    if (filter !== 'all' && item.category !== filter) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase()) &&
        !item.tags.some((t) => t.includes(search.toLowerCase()))) return false;
    return true;
  });

  const tierRank = { Free: 0, Pro: 1, Studio: 2 };
  const currentRank = tierRank[tier === 'free' ? 'Free' : tier === 'pro' ? 'Pro' : 'Studio'];

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-forge-border bg-forge-surface shrink-0">
        <h2 className="text-lg font-semibold">Store</h2>
        <p className="text-xs text-forge-muted mt-1">Sound packs, templates, and presets</p>
      </div>

      <div className="px-6 py-3 border-b border-forge-border bg-forge-surface/50 flex items-center gap-3 flex-wrap shrink-0">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-forge-bg border border-forge-border rounded px-3 py-1.5 text-sm w-48"
        />
        <div className="flex gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                filter === c.key
                  ? 'bg-forge-accent text-white'
                  : 'bg-forge-border text-forge-muted hover:text-forge-text'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {filtered.length === 0 ? (
          <div className="text-center text-forge-muted py-12 text-sm">No items found.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item) => {
              const requiredRank = tierRank[item.price as keyof typeof tierRank] ?? 0;
              const locked = currentRank < requiredRank;
              return (
                <div
                  key={item.id}
                  className={`rounded-lg border p-4 transition-colors ${
                    locked
                      ? 'border-forge-border/50 bg-forge-bg opacity-60'
                      : 'border-forge-border bg-forge-surface hover:border-forge-accent/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                        item.category === 'sound-pack'
                          ? 'bg-purple-500/20 text-purple-400'
                          : item.category === 'template'
                          ? 'bg-blue-500/20 text-blue-400'
                          : item.category === 'ai-pack'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}
                    >
                      {item.category.replace('-', ' ')}
                    </span>
                    <span
                      className={`text-[10px] font-semibold ${
                        item.price === 'Free'
                          ? 'text-forge-success'
                          : item.price === 'Pro'
                          ? 'text-forge-accent'
                          : 'text-yellow-400'
                      }`}
                    >
                      {item.price}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{item.name}</h3>
                  <p className="text-xs text-forge-muted mb-3 line-clamp-2">{item.description}</p>
                  <div className="flex gap-1 mb-3">
                    {item.tags.map((tag) => (
                      <span key={tag} className="text-[10px] bg-forge-border px-1.5 py-0.5 rounded text-forge-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                  {locked ? (
                    <Button size="sm" variant="ghost" disabled>
                      Requires {item.price}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={installedIds.includes(item.id) ? 'primary' : 'secondary'}
                      onClick={() => handleInstall(item)}
                    >
                      {installedIds.includes(item.id)
                        ? (item.category === 'template' ? 'Installed' : 'Uninstall')
                        : (item.category === 'template' ? 'Use Template' : 'Install')}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
