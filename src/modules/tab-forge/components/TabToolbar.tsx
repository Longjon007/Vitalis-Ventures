import { TabPosition, TUNING_PRESETS } from '../../../core/types/tab';
import { NoteDuration } from '../../../core/types/music';
import { downloadTabText } from '../../../core/export/tab-text-exporter';
import { Button } from '../../../components/Button';

const DURATION_OPTIONS: { value: NoteDuration; label: string; symbol: string }[] = [
  { value: 'whole', label: 'Whole', symbol: 'W' },
  { value: 'half', label: 'Half', symbol: 'H' },
  { value: 'quarter', label: 'Quarter', symbol: 'Q' },
  { value: 'eighth', label: 'Eighth', symbol: '8' },
  { value: 'sixteenth', label: '16th', symbol: '16' },
];

interface TabToolbarProps {
  onAddMeasure: () => void;
  onRemoveMeasure: () => void;
  onChangeTuning: (tuningKey: string) => void;
  onToggleChordLibrary: () => void;
  positions: TabPosition[];
  projectName: string;
  currentTuning: number[];
  onPlay: () => void;
  isPlaying: boolean;
  selectedDuration: NoteDuration;
  onDurationChange: (d: NoteDuration) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onToggleStrum: () => void;
  onCopyMeasure: () => void;
  onPasteMeasure: () => void;
  onDuplicateMeasure: () => void;
  hasClipboard: boolean;
}

export function TabToolbar({
  onAddMeasure,
  onRemoveMeasure,
  onChangeTuning,
  onToggleChordLibrary,
  positions,
  projectName,
  currentTuning,
  onPlay,
  isPlaying,
  selectedDuration,
  onDurationChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onToggleStrum,
  onCopyMeasure,
  onPasteMeasure,
  onDuplicateMeasure,
  hasClipboard,
}: TabToolbarProps) {
  const currentTuningKey =
    Object.entries(TUNING_PRESETS).find(
      ([, preset]) => JSON.stringify(preset.tuning) === JSON.stringify(currentTuning)
    )?.[0] ?? 'standard';

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-forge-surface border-b border-forge-border shrink-0 flex-wrap">
      <h2 className="text-sm font-semibold mr-1">TabForge</h2>

      {/* Playback */}
      <Button size="sm" variant={isPlaying ? 'primary' : 'secondary'} onClick={onPlay}>
        {isPlaying ? 'Stop' : '\u25B6 Play'}
      </Button>

      <div className="h-4 w-px bg-forge-border" />

      {/* Undo/Redo */}
      <Button size="sm" variant="ghost" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        {'<'}
      </Button>
      <Button size="sm" variant="ghost" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
        {'>'}
      </Button>

      <div className="h-4 w-px bg-forge-border" />

      {/* Measures */}
      <Button size="sm" variant="secondary" onClick={onAddMeasure}>
        + Measure
      </Button>
      <Button size="sm" variant="ghost" onClick={onRemoveMeasure}>
        - Measure
      </Button>

      <div className="h-4 w-px bg-forge-border" />

      {/* Duration selector */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-forge-muted">Dur</label>
        {DURATION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onDurationChange(opt.value)}
            title={opt.label}
            className={`px-1.5 py-0.5 text-[10px] rounded font-mono ${
              selectedDuration === opt.value
                ? 'bg-forge-accent text-white'
                : 'bg-forge-border text-forge-muted hover:text-forge-text'
            }`}
          >
            {opt.symbol}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-forge-border" />

      {/* Strum direction */}
      <Button size="sm" variant="ghost" onClick={onToggleStrum} title="Toggle strum direction">
        Strum
      </Button>

      {/* Tuning */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-forge-muted">Tuning</label>
        <select
          value={currentTuningKey}
          onChange={(e) => onChangeTuning(e.target.value)}
          className="bg-forge-bg border border-forge-border rounded px-2 py-1 text-xs"
        >
          {Object.entries(TUNING_PRESETS).map(([key, preset]) => (
            <option key={key} value={key}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      <div className="h-4 w-px bg-forge-border" />

      <Button size="sm" variant="secondary" onClick={onToggleChordLibrary}>
        Chords
      </Button>

      {/* Copy/Paste/Duplicate */}
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={onCopyMeasure} title="Copy measure (Ctrl+C)">
          Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={onPasteMeasure} disabled={!hasClipboard} title="Paste measure (Ctrl+V)">
          Paste
        </Button>
        <Button size="sm" variant="ghost" onClick={onDuplicateMeasure} title="Duplicate measure (Ctrl+D)">
          Dup
        </Button>
      </div>

      <div className="ml-auto">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => downloadTabText(positions, projectName)}
        >
          Export Tab
        </Button>
      </div>
    </div>
  );
}
