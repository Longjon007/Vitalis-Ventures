import { useProjectStore } from '../../../core/state/project-store';

export function MixerPanel() {
  const project = useProjectStore((s) => s.project);
  const updateTrack = useProjectStore((s) => s.updateTrack);

  if (!project) return null;

  return (
    <div className="bg-forge-surface border-b border-forge-border px-4 py-3 overflow-x-auto">
      <div className="flex gap-4 min-w-max">
        {project.tracks.map((track) => (
          <div
            key={track.id}
            className="flex items-center gap-3 bg-forge-bg rounded-lg px-3 py-2 min-w-[200px]"
          >
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: track.instrument.color }}
            />
            <span className="text-xs font-medium truncate w-20">{track.name}</span>

            <button
              onClick={() => updateTrack(track.id, { muted: !track.muted })}
              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                track.muted
                  ? 'bg-forge-danger/20 text-forge-danger'
                  : 'bg-forge-border text-forge-muted hover:text-forge-text'
              }`}
            >
              M
            </button>
            <button
              onClick={() => updateTrack(track.id, { solo: !track.solo })}
              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                track.solo
                  ? 'bg-forge-warning/20 text-forge-warning'
                  : 'bg-forge-border text-forge-muted hover:text-forge-text'
              }`}
            >
              S
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-forge-muted w-5 text-right">
                {Math.round(track.volume * 100)}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(track.volume * 100)}
                onChange={(e) =>
                  updateTrack(track.id, { volume: Number(e.target.value) / 100 })
                }
                className="w-16 h-1 accent-forge-accent"
              />
            </div>

            {/* Pan */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-forge-muted">P</span>
              <input
                type="range"
                min={-100}
                max={100}
                value={Math.round(track.pan * 100)}
                onChange={(e) =>
                  updateTrack(track.id, { pan: Number(e.target.value) / 100 })
                }
                className="w-12 h-1 accent-forge-accent"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
