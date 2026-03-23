import { useMemo, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

type ShareMethod = 'copy_link' | 'copy_text' | 'native_share';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  generationId: string;
  prompt: string;
  audioUrl: string | null;
  onShared?: (method: ShareMethod) => void;
}

function sanitizePrompt(prompt: string): string {
  const normalized = prompt.trim();
  if (!normalized) return 'Untitled track';
  if (normalized.length <= 160) return normalized;
  return `${normalized.slice(0, 157)}...`;
}

export function ShareModal({ open, onClose, generationId, prompt, audioUrl, onShared }: ShareModalProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const title = useMemo(() => sanitizePrompt(prompt), [prompt]);
  const sharePath = useMemo(() => `/g/${generationId}`, [generationId]);
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined' || !window.location?.origin) {
      return sharePath;
    }
    return `${window.location.origin}${sharePath}`;
  }, [sharePath]);
  const shareText = useMemo(
    () => `Made this with AI on MusicForge 🎵 ${shareUrl}\nPrompt: "${title}"\nCreated with MusicForge`,
    [shareUrl, title],
  );

  const canUseNativeShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function';

  async function copyText(value: string, method: ShareMethod) {
    setFeedback(null);
    setIsWorking(true);
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard is not available.');
      }
      await navigator.clipboard.writeText(value);
      onShared?.(method);
      setFeedback(method === 'copy_link' ? 'Share link copied.' : 'Share caption copied.');
    } catch {
      setFeedback('Unable to copy automatically. Please copy manually.');
    } finally {
      setIsWorking(false);
    }
  }

  async function handleNativeShare() {
    if (!canUseNativeShare) return;
    setFeedback(null);
    setIsWorking(true);
    try {
      await navigator.share({
        title: 'Created with MusicForge',
        text: shareText,
        url: shareUrl,
      });
      onShared?.('native_share');
      setFeedback('Shared successfully.');
    } catch {
      setFeedback('Share cancelled.');
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Share your generation">
      <div className="space-y-4">
        <div className="rounded-xl border border-forge-border bg-forge-bg/60 p-3">
          <div className="text-xs uppercase tracking-wide text-forge-muted">Track prompt</div>
          <p className="mt-1 text-sm text-forge-text">{title}</p>
        </div>

        {audioUrl && (
          <div className="rounded-xl border border-forge-border bg-forge-bg/60 p-3">
            <div className="text-xs uppercase tracking-wide text-forge-muted">Preview</div>
            <audio controls src={audioUrl} className="mt-2 w-full" preload="none" />
          </div>
        )}

        <div className="rounded-xl border border-forge-border bg-forge-bg/60 p-3">
          <div className="text-xs uppercase tracking-wide text-forge-muted">Public share link</div>
          <p className="mt-2 break-all text-xs text-forge-muted">{shareUrl}</p>
        </div>

        <div className="rounded-xl border border-forge-border bg-forge-bg/60 p-3">
          <div className="text-xs uppercase tracking-wide text-forge-muted">Share caption</div>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-forge-muted font-sans">{shareText}</pre>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void copyText(shareUrl, 'copy_link')} disabled={isWorking}>
            Copy Link
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void copyText(shareText, 'copy_text')}
            disabled={isWorking}
          >
            Copy Caption
          </Button>
          {canUseNativeShare && (
            <Button size="sm" variant="ghost" onClick={() => void handleNativeShare()} disabled={isWorking}>
              Share...
            </Button>
          )}
        </div>

        {feedback && <p className="text-xs text-forge-muted">{feedback}</p>}
      </div>
    </Modal>
  );
}
