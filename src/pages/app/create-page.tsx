import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShareModal } from '../../components/ShareModal';
import { UpgradePrompt } from '../../components/UpgradePrompt';
import { getErrorMessage } from '../../core/utils/errors';
import { trackEvent } from '../../core/analytics/tracker';
import {
  calculateRemainingCredits,
  consumeCredits,
  getCreditWallet,
  type CreditWallet,
} from '../../core/supabase/credits';
import {
  createGeneration,
  isGenerationPending,
  listGenerations,
  normalizeGenerationError,
  type GenerationRecord,
  updateGenerationStatus,
} from '../../core/supabase/generations';
import {
  getPublicGeneration,
  incrementGenerationShareCount,
} from '../../core/supabase/public';
import {
  createProjectInvite,
  createProject,
  getProjectCollaborators,
  joinProjectInvite,
  listProjects,
  type ProjectCollaboratorRecord,
  type ProjectRecord,
} from '../../core/supabase/projects';
import {
  normalizeRunGenerationError,
  runGeneration,
} from '../../modules/ai-forge/services/run-generation';
import { logWarn } from '../../core/observability/logger';

const DEFAULT_FORM = {
  projectId: '',
  prompt: '',
  mode: 'standard',
  genre: 'cinematic',
  bpm: '120',
  keySignature: 'Am',
  duration: '60',
};

const CREDIT_COST = 5;
const POLL_BASE_DELAY_MS = 4000;
const POLL_MAX_DELAY_MS = 30000;
const LOW_CREDIT_THRESHOLD = 10;
const URGENT_CREDIT_THRESHOLD = 5;

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'border-emerald-700 bg-emerald-900/40 text-emerald-300';
    case 'failed':
      return 'border-red-800 bg-red-950/50 text-red-300';
    case 'processing':
      return 'border-sky-700 bg-sky-900/40 text-sky-300';
    case 'queued':
    default:
      return 'border-zinc-700 bg-zinc-800 text-zinc-200';
  }
}

function toSafeAudioUrl(url: string | null): string | null {
  if (!url) return null;
  const normalized = url.trim();
  if (!normalized) return null;
  if (
    normalized.startsWith('https://') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('blob:') ||
    normalized.startsWith('data:audio/')
  ) {
    return normalized;
  }
  return null;
}

function parseNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function toStringValue(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized) return normalized;
    return fallback;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.round(value));
  }
  return fallback;
}

export default function CreatePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMountedRef = useRef(true);
  const generationStatusMapRef = useRef<Record<string, string>>({});
  const hasHydratedGenerationStatusRef = useRef(false);
  const hasTrackedLowCreditsRef = useRef(false);
  const hydratedRemixSourceIdRef = useRef<string | null>(null);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [generations, setGenerations] = useState<GenerationRecord[]>([]);
  const [wallet, setWallet] = useState<CreditWallet | null>(null);

  const [isBooting, setIsBooting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pollingNotice, setPollingNotice] = useState<string | null>(null);
  const [shareGeneration, setShareGeneration] = useState<GenerationRecord | null>(null);
  const [parentGenerationId, setParentGenerationId] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<ProjectCollaboratorRecord[]>([]);
  const [collaborationError, setCollaborationError] = useState<string | null>(null);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [generatedInviteCode, setGeneratedInviteCode] = useState<string | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [isJoiningInvite, setIsJoiningInvite] = useState(false);

  const remainingCredits = useMemo(() => calculateRemainingCredits(wallet), [wallet]);
  const isLowCredits = remainingCredits < LOW_CREDIT_THRESHOLD;
  const isUrgentCredits = remainingCredits <= URGENT_CREDIT_THRESHOLD;
  const recentProject = useMemo(() => projects[0] ?? null, [projects]);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === form.projectId) ?? null,
    [projects, form.projectId],
  );
  const latestCompletedGeneration = useMemo(
    () => generations.find((generation) => generation.status === 'completed') ?? null,
    [generations],
  );

  async function loadInitialData() {
    if (!isMountedRef.current) return;
    setIsBooting(true);
    setError(null);
    setPollingNotice(null);

    try {
      const [projectRows, generationRows, walletRow] = await Promise.all([
        listProjects(),
        listGenerations(),
        getCreditWallet(),
      ]);

      if (!isMountedRef.current) return;

      setProjects(projectRows);
      setGenerations(generationRows);
      setWallet(walletRow);
      setForm((prev) => {
        if (prev.projectId || projectRows.length === 0) return prev;
        return { ...prev, projectId: projectRows[0].id };
      });
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(getErrorMessage(err, 'Failed to load create workspace.'));
    } finally {
      if (isMountedRef.current) {
        setIsBooting(false);
      }
    }
  }

  async function refreshWalletAndGenerations() {
    const [walletResult, generationsResult] = await Promise.allSettled([
      getCreditWallet(),
      listGenerations(),
    ]);

    if (!isMountedRef.current) return;

    if (walletResult.status === 'fulfilled') {
      setWallet(walletResult.value);
    } else {
      setError((prev) => prev ?? getErrorMessage(walletResult.reason, 'Failed to refresh wallet.'));
    }

    if (generationsResult.status === 'fulfilled') {
      setGenerations(generationsResult.value);
    } else {
      setPollingNotice('Live status updates are delayed. Retrying automatically.');
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    void loadInitialData();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const remixSourceId = (searchParams.get('remix') ?? '').trim();
    if (!remixSourceId) return;
    if (hydratedRemixSourceIdRef.current === remixSourceId) return;

    hydratedRemixSourceIdRef.current = remixSourceId;

    let active = true;
    setError(null);

    void (async () => {
      try {
        const source = await getPublicGeneration(remixSourceId);
        if (!active || !isMountedRef.current) return;

        if (!source) {
          setError('Remix source is unavailable.');
          return;
        }

        setParentGenerationId(source.id);
        setForm((prev) => ({
          ...prev,
          prompt: source.prompt || prev.prompt,
          mode: 'remix',
          genre: toStringValue(source.input_params.genre, prev.genre),
          bpm: toStringValue(source.input_params.bpm, prev.bpm),
          keySignature: toStringValue(source.input_params.keySignature, prev.keySignature),
          duration: toStringValue(source.input_params.duration, prev.duration),
        }));
        setSuccess('Remix loaded. Update the prompt or settings, then generate your version.');
        trackEvent('generation_remixed', {
          parentGenerationId: source.id,
          source: 'create_page',
        });

        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('remix');
        setSearchParams(nextParams, { replace: true });
      } catch (err) {
        if (!active || !isMountedRef.current) return;
        setError(getErrorMessage(err, 'Unable to load remix source.'));
      }
    })();

    return () => {
      active = false;
    };
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (isLowCredits && !hasTrackedLowCreditsRef.current) {
      trackEvent('credits_low_shown', {
        remainingCredits,
        threshold: LOW_CREDIT_THRESHOLD,
      });
      hasTrackedLowCreditsRef.current = true;
      return;
    }

    if (!isLowCredits) {
      hasTrackedLowCreditsRef.current = false;
    }
  }, [isLowCredits, remainingCredits]);

  useEffect(() => {
    if (!selectedProject) {
      setCollaborators([]);
      setCollaborationError(null);
      return;
    }

    let active = true;
    setCollaborationError(null);

    void (async () => {
      try {
        const rows = await getProjectCollaborators(selectedProject.id);
        if (!active || !isMountedRef.current) return;
        setCollaborators(rows);
      } catch (err) {
        if (!active || !isMountedRef.current) return;
        setCollaborationError(getErrorMessage(err, 'Unable to load collaborators.'));
        setCollaborators([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedProject]);

  useEffect(() => {
    if (isBooting) return;

    let cancelled = false;
    let timeoutId: number | undefined;
    let inFlight = false;
    let failureCount = 0;

    const getNextDelay = () =>
      Math.min(POLL_BASE_DELAY_MS * 2 ** Math.min(failureCount, 3), POLL_MAX_DELAY_MS);

    const scheduleNext = (delay: number) => {
      if (cancelled) return;
      timeoutId = window.setTimeout(() => {
        void pollGenerations();
      }, delay);
    };

    const pollGenerations = async () => {
      if (cancelled || inFlight) {
        scheduleNext(getNextDelay());
        return;
      }

      inFlight = true;
      try {
        const updated = await listGenerations();
        if (cancelled || !isMountedRef.current) return;

        failureCount = 0;
        setPollingNotice(null);
        setGenerations(updated);
      } catch (err) {
        failureCount += 1;
        if (!cancelled && isMountedRef.current) {
          if (failureCount === 1 || failureCount % 5 === 0) {
            logWarn('Generation polling retrying.', {
              reason: getErrorMessage(err, 'Polling failed.'),
              failureCount,
            });
          }
          if (failureCount >= 2) {
            setPollingNotice('Live status updates are delayed. Retrying automatically.');
          }
        }
      } finally {
        inFlight = false;
        scheduleNext(getNextDelay());
      }
    };

    scheduleNext(0);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isBooting]);

  useEffect(() => {
    const nextStatusMap: Record<string, string> = {};

    if (!hasHydratedGenerationStatusRef.current) {
      for (const generation of generations) {
        nextStatusMap[generation.id] = generation.status;
      }
      generationStatusMapRef.current = nextStatusMap;
      hasHydratedGenerationStatusRef.current = true;
      return;
    }

    for (const generation of generations) {
      const previousStatus = generationStatusMapRef.current[generation.id];
      if (previousStatus && previousStatus !== generation.status) {
        if (generation.status === 'completed') {
          trackEvent('generation_completed', {
            generationId: generation.id,
            mode: generation.mode,
          });
          if (isMountedRef.current) {
            setSuccess('Track generated successfully. Want more like this? Generate again or upgrade for more credits.');
          }
        } else if (generation.status === 'failed') {
          trackEvent('generation_failed', {
            generationId: generation.id,
            mode: generation.mode,
            reason: generation.error_message ?? undefined,
          });
        }
      }
      nextStatusMap[generation.id] = generation.status;
    }

    generationStatusMapRef.current = nextStatusMap;
  }, [generations]);

  function updateField<K extends keyof typeof DEFAULT_FORM>(key: K, value: (typeof DEFAULT_FORM)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleOpenShare(generation: GenerationRecord) {
    setShareGeneration(generation);
    trackEvent('generation_shared', {
      generationId: generation.id,
      method: 'modal_opened',
      hadAudio: Boolean(toSafeAudioUrl(generation.output_url)),
    });
  }

  async function handleShareAction(method: 'copy_link' | 'copy_text' | 'native_share') {
    if (!shareGeneration) return;
    trackEvent('generation_shared', {
      generationId: shareGeneration.id,
      method,
      hadAudio: Boolean(toSafeAudioUrl(shareGeneration.output_url)),
    });

    try {
      const shareCount = await incrementGenerationShareCount(shareGeneration.id);
      if (!isMountedRef.current) return;
      setGenerations((prev) =>
        prev.map((item) =>
          item.id === shareGeneration.id
            ? {
                ...item,
                share_count: shareCount,
              }
            : item,
        ),
      );
    } catch {
      // Share counters are non-blocking operational metrics.
    }

    setSuccess(method === 'copy_link' ? 'Share link copied.' : 'Share text ready to share.');
  }

  function handleContinueLastProject() {
    if (!recentProject) return;
    setError(null);
    setSuccess(`Continuing project: ${recentProject.title}`);
    setForm((prev) => ({ ...prev, projectId: recentProject.id }));
  }

  function handleTryAgain(generation: GenerationRecord) {
    const params = generation.input_params ?? {};
    setError(null);
    setSuccess('Loaded previous settings. Update if needed, then Generate Track.');
    setForm((prev) => ({
      ...prev,
      projectId: generation.project_id ?? prev.projectId,
      prompt: generation.prompt || prev.prompt,
      mode: generation.mode || prev.mode,
      genre: toStringValue(params.genre, prev.genre),
      bpm: toStringValue(params.bpm, prev.bpm),
      keySignature: toStringValue(params.keySignature, prev.keySignature),
      duration: toStringValue(params.duration, prev.duration),
    }));
  }

  function handleQuickAction(action: 'variation' | 'extend' | 'genre') {
    if (action === 'variation') {
      setForm((prev) => ({ ...prev, mode: 'variation' }));
      setParentGenerationId(latestCompletedGeneration?.id ?? null);
      setSuccess('Variation mode selected. Update prompt and generate again.');
      return;
    }

    if (action === 'extend') {
      setForm((prev) => ({ ...prev, mode: 'extend' }));
      setParentGenerationId(latestCompletedGeneration?.id ?? null);
      setSuccess('Extend mode selected. Generate Track to continue building.');
      return;
    }

    setForm((prev) => ({
      ...prev,
      genre: prev.genre.toLowerCase() === 'cinematic' ? 'electronic' : 'cinematic',
    }));
    setSuccess('Genre updated. Generate Track for a fresh direction.');
  }

  async function handleCreateInvite() {
    if (!selectedProject || isCreatingInvite) return;
    setCollaborationError(null);
    setGeneratedInviteCode(null);
    setIsCreatingInvite(true);

    try {
      const result = await createProjectInvite(selectedProject.id);
      if (!result.success || !result.inviteCode) {
        setCollaborationError(result.error ?? 'Unable to create invite link.');
        return;
      }

      setGeneratedInviteCode(result.inviteCode);
      trackEvent('collaboration_invited', {
        projectId: selectedProject.id,
        inviteCode: result.inviteCode,
      });
    } catch (err) {
      setCollaborationError(getErrorMessage(err, 'Unable to create invite link.'));
    } finally {
      setIsCreatingInvite(false);
    }
  }

  async function handleJoinInvite(e: React.FormEvent) {
    e.preventDefault();
    if (isJoiningInvite) return;
    const code = inviteCodeInput.trim();
    if (!code) {
      setCollaborationError('Invite code is required.');
      return;
    }

    setCollaborationError(null);
    setIsJoiningInvite(true);
    try {
      const result = await joinProjectInvite(code);
      if (!result.success || !result.projectId) {
        setCollaborationError(result.error ?? 'Unable to join collaboration invite.');
        return;
      }

      trackEvent('collaboration_joined', {
        projectId: result.projectId,
        via: 'invite_code',
      });

      setInviteCodeInput('');
      setSuccess('Joined collaborative project.');
      const refreshedProjects = await listProjects();
      if (!isMountedRef.current) return;
      setProjects(refreshedProjects);
      setForm((prev) => ({ ...prev, projectId: result.projectId ?? prev.projectId }));
    } catch (err) {
      if (!isMountedRef.current) return;
      setCollaborationError(getErrorMessage(err, 'Unable to join collaboration invite.'));
    } finally {
      if (isMountedRef.current) {
        setIsJoiningInvite(false);
      }
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (isCreatingProject) return;

    setError(null);
    setSuccess(null);

    const title = newProjectTitle.trim();
    if (!title) {
      setError('Project title is required');
      return;
    }

    setIsCreatingProject(true);
    try {
      const created = await createProject({ title, status: 'draft' });
      if (!isMountedRef.current) return;

      setProjects((prev) => [created, ...prev]);
      setForm((prev) => ({ ...prev, projectId: created.id }));
      setNewProjectTitle('');
      setSuccess('Project created');
      trackEvent('project_created', { projectId: created.id });
    } catch (err) {
      if (isMountedRef.current) {
        setError(getErrorMessage(err, 'Failed to create project.'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsCreatingProject(false);
      }
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setSuccess(null);

    const prompt = form.prompt.trim();
    if (!prompt) {
      setError('Prompt is required');
      return;
    }

    if (remainingCredits < CREDIT_COST) {
      setError('Insufficient credits');
      return;
    }

    setIsSubmitting(true);
    let createdGenerationId: string | null = null;

    try {
      const parsedBpm = parseNumber(form.bpm, 120);
      const parsedDuration = parseNumber(form.duration, 60);

      await consumeCredits(CREDIT_COST, 'ai_generation', {
        mode: form.mode,
        genre: form.genre,
        bpm: parsedBpm,
        keySignature: form.keySignature,
        duration: parsedDuration,
      });

      const created = await createGeneration({
        projectId: form.projectId || null,
        parentGenerationId,
        prompt,
        mode: form.mode,
        provider: 'replicate',
        inputParams: {
          genre: form.genre,
          bpm: parsedBpm,
          keySignature: form.keySignature,
          duration: parsedDuration,
        },
        creditsUsed: CREDIT_COST,
        status: 'queued',
      });
      createdGenerationId = created.id;

      if (!isMountedRef.current) return;
      setGenerations((prev) => [created, ...prev]);
      setSuccess('Generation queued');
      trackEvent('generation_started', {
        generationId: created.id,
        mode: form.mode,
      });

      if (parentGenerationId) {
        trackEvent('generation_remixed', {
          parentGenerationId,
          source: 'create_page',
        });
      }

      void (async () => {
        try {
          const runResult = await runGeneration({
            generationId: created.id,
            prompt,
            mode: form.mode,
            genre: form.genre,
            bpm: parsedBpm,
            keySignature: form.keySignature,
            duration: parsedDuration,
          });

          if (!runResult.success) {
            const runError = runResult.error ?? 'Generation failed.';
            try {
              await updateGenerationStatus(created.id, {
                status: 'failed',
                error_message: runError,
              });
            } catch {
              // Ignore secondary persistence errors.
            }

            if (isMountedRef.current) {
              setError(runError);
            }
          }
        } catch (runErr) {
          const runError = normalizeRunGenerationError(runErr);
          try {
            await updateGenerationStatus(created.id, {
              status: 'failed',
              error_message: runError,
            });
          } catch {
            // Ignore secondary persistence errors.
          }

          if (isMountedRef.current) {
            setError(runError);
          }
        } finally {
          await refreshWalletAndGenerations();
        }
      })();
    } catch (err) {
      const message = normalizeGenerationError(err);
      if (isMountedRef.current) {
        setError(message);
      }

      if (createdGenerationId) {
        try {
          await updateGenerationStatus(createdGenerationId, {
            status: 'failed',
            error_message: message,
          });
        } catch {
          // Ignore secondary persistence errors to preserve primary error context.
        }
      }
    } finally {
      try {
        await refreshWalletAndGenerations();
      } catch (refreshErr) {
        if (isMountedRef.current) {
          setError((prev) => prev ?? getErrorMessage(refreshErr, 'Failed to refresh workspace.'));
        }
      }

      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }

  if (isBooting) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-sm text-zinc-300">Loading your create workspace...</p>
          <p className="mt-1 text-xs text-zinc-500">Fetching projects, generations, and credits.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Create</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Generate AI music tracks, manage outputs, and keep your projects moving.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Remaining credits</div>
          <div className="mt-1 text-2xl font-semibold text-white">{remainingCredits}</div>
          <p className="mt-1 text-xs text-zinc-400">You have {remainingCredits} credits remaining.</p>
          {isUrgentCredits && (
            <p className="mt-1 text-xs text-amber-300">Only {remainingCredits} credits left.</p>
          )}
        </div>
      </div>

      {recentProject && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-zinc-300">
              Continue your last project:{' '}
              <span className="font-medium text-white">{recentProject.title}</span>
            </p>
            <button
              type="button"
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-white hover:bg-zinc-800"
              onClick={handleContinueLastProject}
            >
              Continue Project
            </button>
          </div>
        </section>
      )}

      {isLowCredits && <UpgradePrompt feature="AI music generation" />}

      {(error || success || pollingNotice) && (
        <div className="space-y-2">
          {error && (
            <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
              {success}
            </div>
          )}
          {pollingNotice && (
            <div className="rounded-lg border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
              {pollingNotice}
            </div>
          )}
          {latestCompletedGeneration && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-200">
              <p>Want more like this? Try a variation, extend this track, or change genre.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                  onClick={() => handleQuickAction('variation')}
                >
                  Try a variation
                </button>
                <button
                  type="button"
                  className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                  onClick={() => handleQuickAction('extend')}
                >
                  Extend this track
                </button>
                <button
                  type="button"
                  className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                  onClick={() => handleQuickAction('genre')}
                >
                  Change genre
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-medium text-white">New generation</h2>
          <p className="mt-1 text-sm text-zinc-400">Each generation costs {CREDIT_COST} credits.</p>
          {parentGenerationId && (
            <p className="mt-1 text-xs text-zinc-500">
              Remix lineage active from{' '}
              <a
                href={`/g/${parentGenerationId}`}
                target="_blank"
                rel="noreferrer"
                className="text-forge-accent hover:underline"
              >
                source generation
              </a>
              .
            </p>
          )}

          <form className="mt-5 space-y-4" onSubmit={handleGenerate}>
            <div>
              <label className="mb-2 block text-sm text-zinc-300">Project</label>
              <select
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                value={form.projectId}
                onChange={(e) => updateField('projectId', e.target.value)}
              >
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                    {project.is_owner === false ? ' (shared)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Collaboration</p>
                {selectedProject && (
                  <button
                    type="button"
                    onClick={() => void handleCreateInvite()}
                    disabled={isCreatingInvite}
                    className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
                  >
                    {isCreatingInvite ? 'Creating invite...' : 'Create Invite Link'}
                  </button>
                )}
              </div>

              {!selectedProject && (
                <p className="mt-2 text-xs text-zinc-500">Select a project to manage collaborators.</p>
              )}

              {selectedProject && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-zinc-400">
                    {selectedProject.is_owner === false
                      ? 'Shared project access enabled.'
                      : 'Project owner controls active.'}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {collaborators.map((collaborator) => (
                      <span
                        key={`${collaborator.user_id}-${collaborator.role}`}
                        className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-300"
                      >
                        {collaborator.is_owner ? 'Owner' : collaborator.role}:{' '}
                        {collaborator.username ? `@${collaborator.username}` : collaborator.display_name ?? 'Creator'}
                      </span>
                    ))}
                    {collaborators.length === 0 && (
                      <span className="text-xs text-zinc-500">No collaborators yet.</span>
                    )}
                  </div>

                  {generatedInviteCode && (
                    <p className="text-xs text-emerald-300">
                      Invite code created: <span className="font-mono">{generatedInviteCode}</span>
                    </p>
                  )}
                </div>
              )}

              <form className="mt-2 flex flex-wrap gap-2" onSubmit={handleJoinInvite}>
                <input
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value)}
                  placeholder="Join via invite code"
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-white"
                />
                <button
                  type="submit"
                  disabled={isJoiningInvite}
                  className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
                >
                  {isJoiningInvite ? 'Joining...' : 'Join Project'}
                </button>
              </form>

              {collaborationError && (
                <p className="mt-2 text-xs text-red-300">{collaborationError}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-300">Prompt</label>
              <textarea
                className="min-h-[140px] w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white"
                placeholder="Describe the sound, energy, instrumentation, and intended use."
                value={form.prompt}
                onChange={(e) => updateField('prompt', e.target.value)}
              />
              <p className="mt-2 text-xs text-zinc-500">
                Describe your track clearly for better results and stronger shareable content.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">Mode</label>
                <select
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  value={form.mode}
                  onChange={(e) => {
                    const nextMode = e.target.value;
                    updateField('mode', nextMode);
                    if (nextMode !== 'remix') {
                      setParentGenerationId(null);
                    }
                  }}
                >
                  <option value="standard">Standard</option>
                  <option value="variation">Variation</option>
                  <option value="extend">Extend</option>
                  <option value="remix">Remix</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">Genre</label>
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  value={form.genre}
                  onChange={(e) => updateField('genre', e.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">BPM</label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  value={form.bpm}
                  onChange={(e) => updateField('bpm', e.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">Key</label>
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  value={form.keySignature}
                  onChange={(e) => updateField('keySignature', e.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">Duration (sec)</label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  value={form.duration}
                  onChange={(e) => updateField('duration', e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-zinc-300">Advanced creation modes</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateField('mode', 'extend')}
                    className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                  >
                    Extend
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('mode', 'remix')}
                    className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                  >
                    Remix
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('mode', 'variation')}
                    className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                  >
                    Create Variation
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="inline-flex items-center rounded-xl bg-white px-4 py-2 font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Generating Track…' : `Generate Track (${CREDIT_COST} credits)`}
            </button>
          </form>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-lg font-medium text-white">Quick project</h2>
            <form className="mt-4 flex gap-3" onSubmit={handleCreateProject}>
              <input
                className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                placeholder="New project title"
                value={newProjectTitle}
                onChange={(e) => setNewProjectTitle(e.target.value)}
              />
              <button
                type="submit"
                disabled={isCreatingProject}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-white disabled:opacity-50"
              >
                {isCreatingProject ? 'Creating…' : 'Add'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-lg font-medium text-white">Recent work</h2>
            <p className="mt-1 text-xs text-zinc-500">Your latest generations and project-ready outputs.</p>
            <div className="mt-4 space-y-3">
              {generations.length === 0 && !isSubmitting && (
                <p className="text-sm text-zinc-400">
                  Start your first track - describe the sound you want and click Generate Track.
                </p>
              )}

              {generations.length === 0 && isSubmitting && (
                <p className="text-sm text-sky-300">Preparing your generation...</p>
              )}

              {generations.map((item, index) => {
                const audioUrl = toSafeAudioUrl(item.output_url);
                const isNewestPending = index === 0 && isGenerationPending(item.status);

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border bg-zinc-900 p-4 transition ${
                      isNewestPending
                        ? 'border-sky-700 shadow-[0_0_0_1px_rgba(14,165,233,0.25)]'
                        : item.status === 'completed'
                          ? 'border-emerald-800/70'
                          : 'border-zinc-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">{item.prompt || 'Untitled generation'}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {item.mode} · {item.status} · {item.credits_used} credits
                          {item.parent_generation_id ? ' · remixed' : ''}
                        </div>
                        {item.parent_generation_id && (
                          <div className="mt-1 text-xs text-zinc-500">
                            Remixed from{' '}
                            <a
                              href={`/g/${item.parent_generation_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-forge-accent hover:underline"
                            >
                              original track
                            </a>
                          </div>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${getStatusBadgeClass(
                          item.status,
                        )}`}
                      >
                        {item.status === 'processing' && (
                          <span className="h-3 w-3 rounded-full border-2 border-sky-300 border-t-transparent animate-spin" />
                        )}
                        {item.status}
                      </span>
                    </div>

                    {item.status === 'processing' && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-sky-300">
                        <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                        Processing generation...
                      </div>
                    )}

                    {item.status === 'failed' && (
                      <div className="mt-3 space-y-2">
                        <div className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                          {item.error_message?.trim() || 'Generation failed. Please try again.'}
                        </div>
                        <button
                          type="button"
                          className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                          onClick={() => handleTryAgain(item)}
                        >
                          Try Again
                        </button>
                      </div>
                    )}

                    {audioUrl && (
                      <div className="mt-3">
                        <audio controls src={audioUrl} className="w-full" preload="none" />
                      </div>
                    )}

                    {!audioUrl && item.status === 'completed' && item.output_url && (
                      <div className="mt-3 text-xs text-zinc-400">
                        Output is ready, but preview audio could not be loaded safely.
                      </div>
                    )}

                    {item.status === 'completed' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                          onClick={() => handleTryAgain(item)}
                        >
                          Try Again
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-forge-accent/50 px-2.5 py-1 text-xs text-forge-accent hover:bg-forge-accent/10"
                          onClick={() => handleOpenShare(item)}
                        >
                          Share
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>

      <ShareModal
        open={Boolean(shareGeneration)}
        onClose={() => setShareGeneration(null)}
        generationId={shareGeneration?.id ?? ''}
        prompt={shareGeneration?.prompt ?? ''}
        audioUrl={toSafeAudioUrl(shareGeneration?.output_url ?? null)}
        onShared={handleShareAction}
      />
    </div>
  );
}
