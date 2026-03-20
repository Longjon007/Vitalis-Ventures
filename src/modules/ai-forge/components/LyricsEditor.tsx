interface LyricsEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const LYRICS_TEMPLATES = [
  { label: 'Verse-Chorus', template: '[Verse 1]\n\n\n[Chorus]\n\n\n[Verse 2]\n\n\n[Chorus]\n' },
  { label: 'AABA', template: '[A]\n\n\n[A]\n\n\n[B]\n\n\n[A]\n' },
  { label: 'Freestyle', template: '' },
];

export function LyricsEditor({ value, onChange, disabled }: LyricsEditorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-forge-muted">Lyrics</h3>
        <div className="flex gap-1">
          {LYRICS_TEMPLATES.map((t) => (
            <button
              key={t.label}
              onClick={() => onChange(t.template)}
              className="text-[10px] px-2 py-0.5 rounded bg-forge-bg border border-forge-border text-forge-muted hover:text-forge-text transition-colors"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="[Verse 1]\nWrite your lyrics here...\n\n[Chorus]\nAnd the chorus goes..."
        className="w-full h-40 bg-forge-bg border border-forge-border rounded-lg p-3 text-xs resize-none focus:outline-none focus:border-forge-accent font-mono leading-relaxed"
        disabled={disabled}
      />
      <p className="text-[10px] text-forge-muted">
        Use [Verse], [Chorus], [Bridge] tags to structure your song.
      </p>
    </div>
  );
}
