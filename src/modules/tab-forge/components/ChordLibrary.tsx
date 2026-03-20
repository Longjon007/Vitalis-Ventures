import { useState } from 'react';
import { CHORD_SHAPES, ChordShape } from '../data/chord-shapes';
import { ChordDiagram } from './ChordDiagram';

interface ChordLibraryProps {
  onSelectChord: (frets: (number | null)[]) => void;
  onClose: () => void;
}

export function ChordLibrary({ onSelectChord, onClose }: ChordLibraryProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'barre' | 'power'>('all');

  const filtered = CHORD_SHAPES.filter((chord) => {
    if (filter !== 'all' && chord.category !== filter) return false;
    if (search && !chord.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="w-64 border-l border-forge-border bg-forge-surface flex flex-col shrink-0">
      <div className="p-3 border-b border-forge-border flex items-center justify-between">
        <span className="text-sm font-semibold">Chord Library</span>
        <button onClick={onClose} className="text-forge-muted hover:text-forge-text text-sm">
          x
        </button>
      </div>

      <div className="p-3 space-y-2 border-b border-forge-border">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chords..."
          className="w-full bg-forge-bg border border-forge-border rounded px-2 py-1 text-sm"
        />
        <div className="flex gap-1">
          {(['all', 'open', 'barre', 'power'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2 py-0.5 text-xs rounded ${
                filter === cat
                  ? 'bg-forge-accent text-white'
                  : 'bg-forge-border text-forge-muted hover:text-forge-text'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2">
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((chord) => (
            <ChordCard key={chord.name} chord={chord} onSelect={() => onSelectChord(chord.frets)} />
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="text-sm text-forge-muted text-center py-4">No chords found</p>
        )}
      </div>
    </div>
  );
}

function ChordCard({ chord, onSelect }: { chord: ChordShape; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="p-2 bg-forge-bg border border-forge-border rounded-lg hover:border-forge-accent transition-colors text-left flex flex-col items-center"
    >
      <div className="text-sm font-semibold mb-0.5">{chord.name}</div>
      <ChordDiagram frets={chord.frets} size={70} />
    </button>
  );
}
