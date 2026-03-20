import { useState, useRef, useEffect } from 'react';
import { GenerationResult, GENERATION_MODE_LABELS } from '../../../core/ai/ai-types';
import { Button } from '../../../components/Button';

interface GenerationPreviewProps {
  result: GenerationResult;
  onImport: (result: GenerationResult) => void;
  isLatest?: boolean;
}

export function GenerationPreview({ result, onImport, isLatest }: GenerationPreviewProps) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(result.audioUrl);
      audioRef.current.addEventListener('ended', () => setPlaying(false));
    }

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  const timeAgo = getTimeAgo(result.createdAt);

  return (
    <div className={`bg-forge-surface border rounded-lg p-3 ${
      isLatest ? 'border-forge-accent/50' : 'border-forge-border'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{result.prompt}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-forge-accent/20 text-forge-accent">
              {GENERATION_MODE_LABELS[result.mode]}
            </span>
            <span className="text-[10px] text-forge-muted">{result.duration}s</span>
            {result.stems && (
              <span className="text-[10px] text-forge-muted">
                {result.stems.length} stems
              </span>
            )}
            <span className="text-[10px] text-forge-muted">{timeAgo}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-forge-bg border border-forge-border flex items-center justify-center text-xs hover:border-forge-accent transition-colors"
          >
            {playing ? 'II' : '\u25B6'}
          </button>
          <Button size="sm" variant="secondary" onClick={() => onImport(result)}>
            Import
          </Button>
        </div>
      </div>

      {/* Stem list */}
      {result.stems && result.stems.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {result.stems.map((stem) => (
            <span
              key={stem.type}
              className="text-[10px] px-1.5 py-0.5 rounded bg-forge-bg border border-forge-border text-forge-muted"
            >
              {stem.type}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
