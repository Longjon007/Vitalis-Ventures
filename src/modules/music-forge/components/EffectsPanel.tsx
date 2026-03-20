import { useState, useEffect } from 'react';
import { EffectType, DEFAULT_EFFECT_PARAMS, EffectConfig } from '../../../core/audio/effects-chain';
import { AudioEngine } from '../../../core/audio/audio-engine';

interface EffectsPanelProps {
  trackId: string;
  trackName: string;
  onClose: () => void;
}

const EFFECT_LABELS: Record<EffectType, string> = {
  reverb: 'Reverb',
  delay: 'Delay',
  distortion: 'Distortion',
  chorus: 'Chorus',
  compressor: 'Compressor',
  eq: 'EQ',
};

export function EffectsPanel({ trackId, trackName, onClose }: EffectsPanelProps) {
  const [effects, setEffects] = useState<EffectConfig[]>(() =>
    (Object.keys(DEFAULT_EFFECT_PARAMS) as EffectType[]).map((type) => ({
      type,
      enabled: false,
      params: { ...DEFAULT_EFFECT_PARAMS[type] },
    }))
  );

  // Apply effects to audio engine whenever they change
  useEffect(() => {
    const enabledEffects = effects.filter((e) => e.enabled);
    if (enabledEffects.length > 0) {
      AudioEngine.setTrackEffects(trackId, enabledEffects);
    } else {
      AudioEngine.clearTrackEffects(trackId);
    }
  }, [effects, trackId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      AudioEngine.clearTrackEffects(trackId);
    };
  }, [trackId]);

  const toggleEffect = (type: EffectType) => {
    setEffects((prev) =>
      prev.map((e) => (e.type === type ? { ...e, enabled: !e.enabled } : e))
    );
  };

  const updateParam = (type: EffectType, param: string, value: number) => {
    setEffects((prev) =>
      prev.map((e) =>
        e.type === type ? { ...e, params: { ...e.params, [param]: value } } : e
      )
    );
  };

  return (
    <div className="w-72 border-l border-forge-border bg-forge-surface flex flex-col shrink-0 h-full">
      <div className="p-3 border-b border-forge-border flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold">Effects</span>
          <span className="text-xs text-forge-muted ml-2">{trackName}</span>
        </div>
        <button onClick={onClose} className="text-forge-muted hover:text-forge-text text-sm">
          x
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {effects.map((effect) => (
          <div
            key={effect.type}
            className={`rounded-lg border p-3 transition-colors ${
              effect.enabled
                ? 'bg-forge-accent/5 border-forge-accent/30'
                : 'bg-forge-bg border-forge-border'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{EFFECT_LABELS[effect.type]}</span>
              <button
                onClick={() => toggleEffect(effect.type)}
                className={`text-xs px-2 py-0.5 rounded ${
                  effect.enabled
                    ? 'bg-forge-accent text-white'
                    : 'bg-forge-border text-forge-muted'
                }`}
              >
                {effect.enabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {effect.enabled && (
              <div className="space-y-2">
                {Object.entries(effect.params).map(([param, value]) => (
                  <div key={param} className="flex items-center gap-2">
                    <label className="text-[10px] text-forge-muted w-14 capitalize">{param}</label>
                    <input
                      type="range"
                      min={param === 'threshold' ? -60 : param === 'ratio' ? 1 : param === 'low' || param === 'mid' || param === 'high' ? -12 : 0}
                      max={param === 'threshold' ? 0 : param === 'ratio' ? 20 : param === 'low' || param === 'mid' || param === 'high' ? 12 : param === 'decay' ? 10 : param === 'delayTime' ? 1 : 1}
                      step={param === 'threshold' || param === 'low' || param === 'mid' || param === 'high' ? 1 : 0.01}
                      value={value}
                      onChange={(e) =>
                        updateParam(effect.type, param, Number(e.target.value))
                      }
                      className="flex-1 h-1 accent-forge-accent"
                    />
                    <span className="text-[10px] text-forge-muted w-8 text-right">
                      {typeof value === 'number' ? value.toFixed(value < 1 ? 2 : 0) : value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
