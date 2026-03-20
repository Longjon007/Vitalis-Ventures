import { useState } from 'react';
import {
  GenerationMode,
  GENERATION_MODE_LABELS,
  StemType,
  STEM_TYPE_LABELS,
} from '../../../core/ai/ai-types';
import { Button } from '../../../components/Button';

interface PromptInputProps {
  onGenerate: (prompt: string, mode: GenerationMode, options: {
    lyrics?: string;
    duration: number;
    stemType?: StemType;
    separateStems: boolean;
  }) => void;
  disabled?: boolean;
  maxDuration: number;
  canSeparateStems: boolean;
}

export function PromptInput({ onGenerate, disabled, maxDuration, canSeparateStems }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<GenerationMode>('instrumental');
  const [lyrics, setLyrics] = useState('');
  const [duration, setDuration] = useState(15);
  const [stemType, setStemType] = useState<StemType>('melody');
  const [separateStems, setSeparateStems] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    onGenerate(prompt.trim(), mode, {
      lyrics: showLyrics ? lyrics : undefined,
      duration: Math.min(duration, maxDuration),
      stemType: mode === 'stem' ? stemType : undefined,
      separateStems: separateStems && canSeparateStems,
    });
  };

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(GENERATION_MODE_LABELS) as [GenerationMode, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mode === key
                ? 'bg-forge-accent text-white'
                : 'bg-forge-surface border border-forge-border text-forge-muted hover:text-forge-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stem type selector */}
      {mode === 'stem' && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-forge-muted self-center mr-1">Stem:</span>
          {(Object.entries(STEM_TYPE_LABELS) as [StemType, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStemType(key)}
              className={`px-2 py-1 rounded text-xs ${
                stemType === key
                  ? 'bg-forge-accent/20 text-forge-accent border border-forge-accent/40'
                  : 'bg-forge-bg border border-forge-border text-forge-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Prompt textarea */}
      <div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the music you want to create... e.g. 'Upbeat jazz fusion with funky bass and smooth saxophone, 120 BPM'"
          className="w-full h-24 bg-forge-bg border border-forge-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-forge-accent placeholder:text-forge-muted/50"
          disabled={disabled}
        />
      </div>

      {/* Lyrics toggle + editor */}
      {(mode === 'full-song') && (
        <div>
          <button
            onClick={() => setShowLyrics(!showLyrics)}
            className="text-xs text-forge-accent hover:underline mb-2"
          >
            {showLyrics ? 'Hide Lyrics' : '+ Add Lyrics'}
          </button>
          {showLyrics && (
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Enter lyrics (optional)..."
              className="w-full h-20 bg-forge-bg border border-forge-border rounded-lg p-3 text-xs resize-none focus:outline-none focus:border-forge-accent font-mono"
              disabled={disabled}
            />
          )}
        </div>
      )}

      {/* Duration + options */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-forge-muted">Duration</label>
          <input
            type="range"
            min={5}
            max={maxDuration}
            step={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-24 accent-forge-accent"
          />
          <span className="text-xs font-mono w-8">{duration}s</span>
        </div>

        {canSeparateStems && mode !== 'stem' && (
          <label className="flex items-center gap-1.5 text-xs text-forge-muted cursor-pointer">
            <input
              type="checkbox"
              checked={separateStems}
              onChange={(e) => setSeparateStems(e.target.checked)}
              className="accent-forge-accent"
            />
            Separate into stems
          </label>
        )}

        <div className="ml-auto">
          <Button
            size="sm"
            variant="primary"
            onClick={handleSubmit}
            disabled={disabled || !prompt.trim()}
          >
            {disabled ? 'Generating...' : 'Generate'}
          </Button>
        </div>
      </div>
    </div>
  );
}
