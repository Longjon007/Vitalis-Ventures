import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAiStore } from '../../core/state/ai-store';
import { useProjectStore } from '../../core/state/project-store';
import { useSubscriptionStore } from '../../core/state/subscription-store';
import { GenerationMode, StemType, AiModel, GenerationResult } from '../../core/ai/ai-types';
import { estimateCost } from '../../core/ai/ai-engine';
import { PromptInput } from './components/PromptInput';
import { GenerationPreview } from './components/GenerationPreview';
import { UpgradePrompt } from '../../components/UpgradePrompt';
import { Button } from '../../components/Button';

export function AiForge() {
  const navigate = useNavigate();
  const project = useProjectStore((s) => s.project);
  const canAccess = useSubscriptionStore((s) => s.canAccess);
  const features = useSubscriptionStore((s) => s.features);
  const tier = useSubscriptionStore((s) => s.tier);

  const {
    status,
    error,
    results,
    hasKey,
    generationsUsed,
    startGeneration,
    cancelGeneration,
    importResult,
    setApiKey,
    clearApiKey,
    clearHistory,
  } = useAiStore();

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const handleGenerate = useCallback(
    async (prompt: string, mode: GenerationMode, options: {
      lyrics?: string;
      duration: number;
      stemType?: StemType;
      separateStems: boolean;
      model?: AiModel;
    }) => {
      // Check generation limits
      if (features.aiGenerationsPerMonth !== Infinity && generationsUsed >= features.aiGenerationsPerMonth) {
        return;
      }

      await startGeneration(
        {
          mode,
          prompt: options.lyrics ? `${prompt}\n\nLyrics:\n${options.lyrics}` : prompt,
          lyrics: options.lyrics,
          duration: options.duration,
          tempo: project?.tempo,
          key: project?.key,
          stemType: options.stemType,
          model: options.model,
        },
        options.separateStems
      );
    },
    [startGeneration, project, features.aiGenerationsPerMonth, generationsUsed]
  );

  const handleImport = useCallback(
    (result: GenerationResult) => {
      importResult(result);
      navigate('/music');
    },
    [importResult, navigate]
  );

  const handleSaveKey = () => {
    if (apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim());
      setApiKeyInput('');
      setShowSettings(false);
    }
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Project Loaded</h2>
          <p className="text-forge-muted mb-4">Create a project first to use AI generation.</p>
          <button
            onClick={() => navigate('/builder')}
            className="px-4 py-2 bg-forge-accent rounded-lg text-sm"
          >
            Go to Builder
          </button>
        </div>
      </div>
    );
  }

  if (!canAccess('aiGeneration')) {
    return <UpgradePrompt feature="ForgeAI Music Generation" />;
  }

  const atLimit = features.aiGenerationsPerMonth !== Infinity && generationsUsed >= features.aiGenerationsPerMonth;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-forge-surface border-b border-forge-border shrink-0 flex-wrap">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <span className="text-forge-accent">*</span>
          ForgeAI
        </h2>
        <span className="text-xs text-forge-muted">
          Project: {project.name} | {project.tempo} BPM | Key: {project.key}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {features.aiGenerationsPerMonth !== Infinity && (
            <span className="text-[10px] text-forge-muted">
              {generationsUsed}/{features.aiGenerationsPerMonth} generations this month
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={() => setShowSettings(!showSettings)}>
            Settings
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-4 space-y-6">
          {/* API Key Setup */}
          {!hasKey && (
            <div className="bg-forge-surface border border-forge-accent/30 rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-2">Setup Required</h3>
              <p className="text-xs text-forge-muted mb-3">
                ForgeAI uses Replicate to generate music. Enter your Replicate API key to get started.
                Get one free at replicate.com.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="r8_..."
                  className="flex-1 bg-forge-bg border border-forge-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-forge-accent"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                />
                <Button size="sm" variant="primary" onClick={handleSaveKey}>
                  Save Key
                </Button>
              </div>
            </div>
          )}

          {/* Settings panel */}
          {showSettings && hasKey && (
            <div className="bg-forge-surface border border-forge-border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-2">ForgeAI Settings</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-forge-muted mb-1">Replicate API Key</p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Enter new key..."
                      className="flex-1 bg-forge-bg border border-forge-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-forge-accent"
                    />
                    <Button size="sm" variant="secondary" onClick={handleSaveKey}>
                      Update
                    </Button>
                    <Button size="sm" variant="danger" onClick={clearApiKey}>
                      Remove
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-forge-muted">
                    Tier: <span className="text-forge-text capitalize">{tier}</span> |
                    Max duration: {features.aiMaxDuration}s |
                    Stem separation: {features.aiStemSeparation ? 'Yes' : 'No'}
                  </span>
                  <Button size="sm" variant="ghost" onClick={clearHistory}>
                    Clear History
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Generation prompt */}
          {hasKey && (
            <>
              {atLimit ? (
                <div className="bg-forge-surface border border-forge-warning/30 rounded-lg p-4 text-center">
                  <p className="text-sm font-semibold mb-1">Monthly Limit Reached</p>
                  <p className="text-xs text-forge-muted mb-3">
                    You've used all {features.aiGenerationsPerMonth} generations this month.
                    Upgrade for more.
                  </p>
                  <Button size="sm" variant="primary" onClick={() => navigate('/pricing')}>
                    View Plans
                  </Button>
                </div>
              ) : (
                <PromptInput
                  onGenerate={handleGenerate}
                  disabled={status === 'generating' || status === 'processing'}
                  maxDuration={features.aiMaxDuration}
                  canSeparateStems={features.aiStemSeparation}
                />
              )}
            </>
          )}

          {/* Status */}
          {(status === 'generating' || status === 'processing') && (
            <div className="bg-forge-surface border border-forge-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-forge-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">
                    {status === 'generating' ? 'Generating music...' : 'Processing stems...'}
                  </span>
                </div>
                <Button size="sm" variant="ghost" onClick={cancelGeneration}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && error && (
            <div className="bg-forge-danger/10 border border-forge-danger/30 rounded-lg p-3">
              <p className="text-sm text-forge-danger">{error}</p>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-forge-muted uppercase tracking-wide">
                Generation History
              </h3>
              {results.map((result, i) => (
                <GenerationPreview
                  key={result.id}
                  result={result}
                  onImport={handleImport}
                  isLatest={i === 0}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {hasKey && results.length === 0 && status === 'idle' && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3 opacity-30">*</div>
              <h3 className="text-sm font-semibold mb-1">Ready to Create</h3>
              <p className="text-xs text-forge-muted max-w-sm mx-auto">
                Describe the music you want and ForgeAI will generate it.
                Import the results into your project as editable tracks.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
