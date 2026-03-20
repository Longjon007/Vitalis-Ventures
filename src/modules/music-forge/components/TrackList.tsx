import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../../core/state/project-store';
import { useUIStore } from '../../../core/state/ui-store';
import { useSubscriptionStore } from '../../../core/state/subscription-store';
import { INSTRUMENTS } from '../../../core/types/instrument';
import { Button } from '../../../components/Button';

export function TrackList() {
  const navigate = useNavigate();
  const project = useProjectStore((s) => s.project);
  const updateTrack = useProjectStore((s) => s.updateTrack);
  const addTrack = useProjectStore((s) => s.addTrack);
  const removeTrack = useProjectStore((s) => s.removeTrack);
  const selectedTrackId = useUIStore((s) => s.selectedTrackId);
  const setSelectedTrackId = useUIStore((s) => s.setSelectedTrackId);
  const features = useSubscriptionStore((s) => s.features);
  const canAi = useSubscriptionStore((s) => s.canAccess('aiGeneration'));

  if (!project) return null;

  const atTrackLimit = project.tracks.length >= features.maxTracksPerProject;

  return (
    <div className="w-52 bg-forge-surface border-r border-forge-border flex flex-col shrink-0">
      <div className="p-3 border-b border-forge-border flex items-center justify-between">
        <span className="text-xs font-semibold text-forge-muted uppercase tracking-wider">Tracks</span>
        <div className="flex items-center gap-1">
          {canAi && (
            <Button
              size="sm"
              variant="ghost"
              title="Generate with AI"
              onClick={() => navigate('/ai')}
            >
              AI
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={atTrackLimit}
            title={atTrackLimit ? `Max ${features.maxTracksPerProject} tracks on your plan` : 'Add track'}
            onClick={() => addTrack(`Track ${project.tracks.length + 1}`, INSTRUMENTS.synth)}
          >
            +
          </Button>
        </div>
      </div>

      {atTrackLimit && features.maxTracksPerProject < Infinity && (
        <div className="px-3 py-1.5 bg-forge-accent/5 border-b border-forge-border">
          <p className="text-[10px] text-forge-accent">
            Track limit reached ({features.maxTracksPerProject}). Upgrade for unlimited.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {project.tracks.map((track) => {
          const isSelected = track.id === selectedTrackId;
          return (
            <div
              key={track.id}
              onClick={() => setSelectedTrackId(track.id)}
              className={`p-3 border-b border-forge-border cursor-pointer transition-colors ${
                isSelected ? 'bg-forge-accent/10' : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: track.instrument.color }}
                />
                <span className="text-sm font-medium truncate flex-1">{track.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTrack(track.id);
                  }}
                  className="text-forge-muted hover:text-forge-danger text-xs"
                >
                  x
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateTrack(track.id, { muted: !track.muted });
                  }}
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    track.muted ? 'bg-forge-danger/20 text-forge-danger' : 'bg-forge-border text-forge-muted'
                  }`}
                >
                  M
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateTrack(track.id, { solo: !track.solo });
                  }}
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    track.solo ? 'bg-forge-warning/20 text-forge-warning' : 'bg-forge-border text-forge-muted'
                  }`}
                >
                  S
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(track.volume * 100)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    updateTrack(track.id, { volume: Number(e.target.value) / 100 })
                  }
                  className="flex-1 h-1 accent-forge-accent"
                />
              </div>

              <p className="text-xs text-forge-muted mt-1">
                {track.instrument.name} | {track.audioUrl ? 'AI Audio' : `${track.notes.length} notes`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
