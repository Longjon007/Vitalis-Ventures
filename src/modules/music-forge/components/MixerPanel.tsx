import { useState } from 'react';
import { useProjectStore } from '../../../core/state/project-store';
import { AudioEngine } from '../../../core/audio/audio-engine';

export function MixerPanel() {
  const project = useProjectStore((s) => s.project);
  const updateTrack = useProjectStore((s) => s.updateTrack);
  const [expandedEq, setExpandedEq] = useState<string | null>(null);
  const [eqValues, setEqValues] = useState<Record<string, { low: number; mid: number; high: number }>>({});

  if (!project) return null;

  const getEq = (trackId: string) => eqValues[trackId] ?? { low: 0, mid: 0, high: 0 };

  const updateEq = (trackId: string, band: 'low' | 'mid' | 'high', value: number) => {
    const current = getEq(trackId);
    const updated = { ...current, [band]: value };
    setEqValues((prev) => ({ ...prev, [trackId]: updated }));
    // Apply EQ to audio engine
    AudioEngine.setTrackEffects(trackId, [{
      type: 'eq',
      enabled: true,
      params: updated,
    }]);
  };

  return (
    <div className="bg-forge-surface border-b border-forge-border px-4 py-3 overflow-x-auto">
      <div className="flex gap-4 min-w-max">
        {project.tracks.map((track) => {
          const eq = getEq(track.id);
          const isExpanded = expandedEq === track.id;
          return (
            <div
              key={track.id}
              className="flex flex-col gap-2 bg-forge-bg rounded-lg px-3 py-2 min-w-[200px]"
            >
              <div className="flex items-center gap-3">
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

                {/* EQ toggle */}
                <button
                  onClick={() => setExpandedEq(isExpanded ? null : track.id)}
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    isExpanded || (eq.low !== 0 || eq.mid !== 0 || eq.high !== 0)
                      ? 'bg-forge-accent/20 text-forge-accent'
                      : 'bg-forge-border text-forge-muted hover:text-forge-text'
                  }`}
                  title="3-Band EQ"
                >
                  EQ
                </button>
              </div>

              {/* Inline EQ */}
              {isExpanded && (
                <div className="flex items-center gap-3 pl-6 pb-1">
                  {(['low', 'mid', 'high'] as const).map((band) => (
                    <div key={band} className="flex items-center gap-1">
                      <span className="text-[9px] text-forge-muted capitalize w-6">{band}</span>
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={1}
                        value={eq[band]}
                        onChange={(e) => updateEq(track.id, band, Number(e.target.value))}
                        className="w-14 h-1 accent-forge-accent"
                      />
                      <span className="text-[9px] text-forge-muted w-7 text-right">
                        {eq[band] > 0 ? '+' : ''}{eq[band]}dB
                      </span>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      setEqValues((prev) => ({ ...prev, [track.id]: { low: 0, mid: 0, high: 0 } }));
                      AudioEngine.clearTrackEffects(track.id);
                    }}
                    className="text-[9px] text-forge-muted hover:text-forge-text"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
