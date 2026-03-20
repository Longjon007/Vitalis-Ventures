import { TabPosition, TUNING_PRESETS } from '../../../core/types/tab';
import { downloadTabText } from '../../../core/export/tab-text-exporter';
import { Button } from '../../../components/Button';

interface TabToolbarProps {
  onAddMeasure: () => void;
  onRemoveMeasure: () => void;
  onChangeTuning: (tuningKey: string) => void;
  onToggleChordLibrary: () => void;
  positions: TabPosition[];
  projectName: string;
  currentTuning: number[];
}

export function TabToolbar({
  onAddMeasure,
  onRemoveMeasure,
  onChangeTuning,
  onToggleChordLibrary,
  positions,
  projectName,
  currentTuning,
}: TabToolbarProps) {
  const currentTuningKey =
    Object.entries(TUNING_PRESETS).find(
      ([, preset]) => JSON.stringify(preset.tuning) === JSON.stringify(currentTuning)
    )?.[0] ?? 'standard';

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-forge-surface border-b border-forge-border shrink-0 flex-wrap">
      <h2 className="text-sm font-semibold mr-2">TabForge</h2>

      <Button size="sm" variant="secondary" onClick={onAddMeasure}>
        + Measure
      </Button>
      <Button size="sm" variant="ghost" onClick={onRemoveMeasure}>
        - Measure
      </Button>

      <div className="h-4 w-px bg-forge-border" />

      <div className="flex items-center gap-2">
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
