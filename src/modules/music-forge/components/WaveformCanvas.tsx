import { useRef, useEffect, useState, useCallback } from 'react';
import { Track } from '../../../core/types/project';
import { useProjectStore } from '../../../core/state/project-store';
import { useTransportStore } from '../../../core/state/transport-store';

interface WaveformCanvasProps {
  track: Track;
}

export function WaveformCanvas({ track }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const [duration, setDuration] = useState(0);
  const [sampleRate, setSampleRate] = useState(44100);
  const currentTick = useTransportStore((s) => s.currentTick);
  const updateTrack = useProjectStore((s) => s.updateTrack);

  // Trim state (in normalized 0-1 range)
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(1);
  const [fadeInLen, setFadeInLen] = useState(0); // 0-1 fraction of total
  const [fadeOutLen, setFadeOutLen] = useState(0);
  const [gain, setGain] = useState(1.0); // for normalize/gain

  // Selection drag state
  const [dragging, setDragging] = useState<'trimStart' | 'trimEnd' | null>(null);

  // Decode audio and extract waveform data
  useEffect(() => {
    if (!track.audioUrl) return;

    const loadWaveform = async () => {
      try {
        const response = await fetch(track.audioUrl!);
        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        setWaveformData(channelData);
        setDuration(audioBuffer.duration);
        setSampleRate(audioBuffer.sampleRate);
        await audioCtx.close();
      } catch {
        // Failed to decode — show fallback
      }
    };

    loadWaveform();
  }, [track.audioUrl]);

  // Draw waveform with trim regions and fades
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Center line
    ctx.strokeStyle = '#333355';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    if (!waveformData || waveformData.length === 0) {
      ctx.fillStyle = '#6c5ce7';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Loading waveform...', width / 2, height / 2);
      return;
    }

    // Trim region shading (dimmed areas outside trim)
    const trimStartPx = trimStart * width;
    const trimEndPx = trimEnd * width;

    // Draw dimmed regions
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, trimStartPx, height);
    ctx.fillRect(trimEndPx, 0, width - trimEndPx, height);

    // Downsample waveform data to pixel width
    const samplesPerPixel = Math.floor(waveformData.length / width);
    const midY = height / 2;

    ctx.fillStyle = track.instrument.color;

    for (let px = 0; px < width; px++) {
      const start = px * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, waveformData.length);
      let min = 0;
      let max = 0;
      for (let i = start; i < end; i++) {
        const val = waveformData[i];
        if (val < min) min = val;
        if (val > max) max = val;
      }

      // Apply gain
      min *= gain;
      max *= gain;

      // Apply fade envelope
      const pos = px / width; // 0-1 position
      let fadeMultiplier = 1;
      if (fadeInLen > 0 && pos < trimStart + fadeInLen * (trimEnd - trimStart)) {
        const fadePos = (pos - trimStart) / (fadeInLen * (trimEnd - trimStart));
        fadeMultiplier = Math.max(0, Math.min(1, fadePos));
      }
      if (fadeOutLen > 0) {
        const fadeOutStart = trimEnd - fadeOutLen * (trimEnd - trimStart);
        if (pos > fadeOutStart) {
          const fadePos = (trimEnd - pos) / (fadeOutLen * (trimEnd - trimStart));
          fadeMultiplier *= Math.max(0, Math.min(1, fadePos));
        }
      }

      min *= fadeMultiplier;
      max *= fadeMultiplier;

      // Dimmed outside trim
      const inTrim = pos >= trimStart && pos <= trimEnd;
      ctx.globalAlpha = inTrim ? 0.7 : 0.2;

      const y1 = midY + min * midY;
      const y2 = midY + max * midY;
      ctx.fillRect(px, y1, 1, Math.max(1, y2 - y1));
    }

    ctx.globalAlpha = 1;

    // Trim handles
    ctx.strokeStyle = '#6c5ce7';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);

    // Trim start handle
    ctx.beginPath();
    ctx.moveTo(trimStartPx, 0);
    ctx.lineTo(trimStartPx, height);
    ctx.stroke();
    ctx.fillStyle = '#6c5ce7';
    ctx.fillRect(trimStartPx - 1, 0, 6, 14);
    ctx.fillRect(trimStartPx - 1, height - 14, 6, 14);

    // Trim end handle
    ctx.beginPath();
    ctx.moveTo(trimEndPx, 0);
    ctx.lineTo(trimEndPx, height);
    ctx.stroke();
    ctx.fillRect(trimEndPx - 5, 0, 6, 14);
    ctx.fillRect(trimEndPx - 5, height - 14, 6, 14);

    // Fade in indicator
    if (fadeInLen > 0) {
      const fadeEndPx = trimStartPx + fadeInLen * (trimEndPx - trimStartPx);
      ctx.strokeStyle = 'rgba(108, 231, 108, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(trimStartPx, height);
      ctx.lineTo(fadeEndPx, 0);
      ctx.stroke();
    }

    // Fade out indicator
    if (fadeOutLen > 0) {
      const fadeStartPx = trimEndPx - fadeOutLen * (trimEndPx - trimStartPx);
      ctx.strokeStyle = 'rgba(231, 108, 108, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(fadeStartPx, 0);
      ctx.lineTo(trimEndPx, height);
      ctx.stroke();
    }

    // Playhead
    if (duration > 0) {
      const bpm = 120;
      const secondsPerTick = 60 / (bpm * 480);
      const playheadSeconds = currentTick * secondsPerTick;
      const playheadX = (playheadSeconds / duration) * width;
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }, [waveformData, track.instrument.color, currentTick, duration, trimStart, trimEnd, fadeInLen, fadeOutLen, gain]);

  // Handle trim drag on canvas
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;

    // Check if near trim handles (within 2% of width)
    if (Math.abs(x - trimStart) < 0.02) {
      setDragging('trimStart');
    } else if (Math.abs(x - trimEnd) < 0.02) {
      setDragging('trimEnd');
    }
  }, [trimStart, trimEnd]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    if (dragging === 'trimStart') {
      setTrimStart(Math.min(x, trimEnd - 0.02));
    } else if (dragging === 'trimEnd') {
      setTrimEnd(Math.max(x, trimStart + 0.02));
    }
  }, [dragging, trimStart, trimEnd]);

  const handleCanvasMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  // Normalize: find peak and set gain to maximize
  const handleNormalize = useCallback(() => {
    if (!waveformData) return;
    let peak = 0;
    const startSample = Math.floor(trimStart * waveformData.length);
    const endSample = Math.floor(trimEnd * waveformData.length);
    for (let i = startSample; i < endSample; i++) {
      const abs = Math.abs(waveformData[i]);
      if (abs > peak) peak = abs;
    }
    if (peak > 0) {
      setGain(1 / peak);
    }
  }, [waveformData, trimStart, trimEnd]);

  // Apply trim (create new audio blob from trimmed region)
  const handleApplyTrim = useCallback(async () => {
    if (!waveformData || !track.audioUrl) return;

    try {
      const response = await fetch(track.audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioCtx = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const startSample = Math.floor(trimStart * audioBuffer.length);
      const endSample = Math.floor(trimEnd * audioBuffer.length);
      const newLength = endSample - startSample;

      const newBuffer = audioCtx.createBuffer(
        audioBuffer.numberOfChannels,
        newLength,
        audioBuffer.sampleRate
      );

      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const oldData = audioBuffer.getChannelData(ch);
        const newData = newBuffer.getChannelData(ch);
        for (let i = 0; i < newLength; i++) {
          let sample = oldData[startSample + i] * gain;

          // Apply fade in
          if (fadeInLen > 0) {
            const fadeInSamples = fadeInLen * newLength;
            if (i < fadeInSamples) {
              sample *= i / fadeInSamples;
            }
          }

          // Apply fade out
          if (fadeOutLen > 0) {
            const fadeOutSamples = fadeOutLen * newLength;
            const fadeOutStart = newLength - fadeOutSamples;
            if (i > fadeOutStart) {
              sample *= (newLength - i) / fadeOutSamples;
            }
          }

          newData[i] = Math.max(-1, Math.min(1, sample));
        }
      }

      // Encode to WAV blob
      const wavBlob = audioBufferToWav(newBuffer);
      const newUrl = URL.createObjectURL(wavBlob);

      updateTrack(track.id, { audioUrl: newUrl });
      setTrimStart(0);
      setTrimEnd(1);
      setFadeInLen(0);
      setFadeOutLen(0);
      setGain(1);

      await audioCtx.close();
    } catch {
      // Failed to apply trim
    }
  }, [waveformData, track.audioUrl, track.id, trimStart, trimEnd, fadeInLen, fadeOutLen, gain, updateTrack]);

  const trimmedDuration = duration * (trimEnd - trimStart);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 bg-forge-surface/50 border-b border-forge-border flex items-center gap-3">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: track.instrument.color }}
        />
        <span className="text-sm font-medium">{track.name}</span>
        <span className="text-xs text-forge-muted">Audio Track</span>
        {duration > 0 && (
          <span className="text-xs text-forge-muted ml-auto">
            {trimmedDuration.toFixed(1)}s / {duration.toFixed(1)}s
          </span>
        )}
      </div>

      <div ref={containerRef} className="flex-1 p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={120}
          className="w-full h-full rounded cursor-col-resize"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        />
      </div>

      {/* Editing controls */}
      <div className="px-4 py-2 border-t border-forge-border bg-forge-surface/30 flex items-center gap-4 flex-wrap">
        {/* Fade In */}
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-forge-muted">Fade In</label>
          <input
            type="range"
            min={0}
            max={50}
            value={Math.round(fadeInLen * 100)}
            onChange={(e) => setFadeInLen(Number(e.target.value) / 100)}
            className="w-16 h-1 accent-green-400"
          />
          <span className="text-[10px] text-forge-muted w-8">
            {fadeInLen > 0 ? `${(fadeInLen * trimmedDuration).toFixed(1)}s` : 'Off'}
          </span>
        </div>

        {/* Fade Out */}
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-forge-muted">Fade Out</label>
          <input
            type="range"
            min={0}
            max={50}
            value={Math.round(fadeOutLen * 100)}
            onChange={(e) => setFadeOutLen(Number(e.target.value) / 100)}
            className="w-16 h-1 accent-red-400"
          />
          <span className="text-[10px] text-forge-muted w-8">
            {fadeOutLen > 0 ? `${(fadeOutLen * trimmedDuration).toFixed(1)}s` : 'Off'}
          </span>
        </div>

        {/* Gain */}
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-forge-muted">Gain</label>
          <input
            type="range"
            min={10}
            max={400}
            value={Math.round(gain * 100)}
            onChange={(e) => setGain(Number(e.target.value) / 100)}
            className="w-16 h-1 accent-forge-accent"
          />
          <span className="text-[10px] text-forge-muted w-10">
            {gain === 1 ? '0dB' : `${gain > 1 ? '+' : ''}${(20 * Math.log10(gain)).toFixed(1)}dB`}
          </span>
        </div>

        {/* Normalize */}
        <button
          onClick={handleNormalize}
          disabled={!waveformData}
          className="text-[10px] px-2 py-1 rounded bg-forge-border text-forge-muted hover:text-forge-text disabled:opacity-40"
        >
          Normalize
        </button>

        {/* Apply */}
        {(trimStart > 0 || trimEnd < 1 || fadeInLen > 0 || fadeOutLen > 0 || gain !== 1) && (
          <button
            onClick={handleApplyTrim}
            className="text-[10px] px-2 py-1 rounded bg-forge-accent/20 text-forge-accent hover:bg-forge-accent/30"
          >
            Apply Edit
          </button>
        )}

        {/* Reset */}
        <button
          onClick={() => { setTrimStart(0); setTrimEnd(1); setFadeInLen(0); setFadeOutLen(0); setGain(1); }}
          className="text-[10px] px-2 py-1 rounded bg-forge-border text-forge-muted hover:text-forge-text"
        >
          Reset
        </button>
      </div>

      <div className="px-4 py-2 border-t border-forge-border">
        <audio controls src={track.audioUrl} className="w-full h-8" />
      </div>
    </div>
  );
}

/** Encode an AudioBuffer as a WAV Blob */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2; // 16-bit
  const dataLength = length * numChannels * bytesPerSample;
  const headerLength = 44;
  const arrayBuffer = new ArrayBuffer(headerLength + dataLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Interleave channels
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = buffer.getChannelData(ch)[i];
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
