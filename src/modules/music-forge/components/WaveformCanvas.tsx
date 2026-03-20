import { useRef, useEffect, useState } from 'react';
import { Track } from '../../../core/types/project';
import { useTransportStore } from '../../../core/state/transport-store';

interface WaveformCanvasProps {
  track: Track;
}

export function WaveformCanvas({ track }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const [duration, setDuration] = useState(0);
  const currentTick = useTransportStore((s) => s.currentTick);

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
        await audioCtx.close();
      } catch {
        // Failed to decode — show fallback
      }
    };

    loadWaveform();
  }, [track.audioUrl]);

  // Draw waveform
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

    // Downsample waveform data to pixel width
    const samplesPerPixel = Math.floor(waveformData.length / width);
    const midY = height / 2;

    ctx.fillStyle = track.instrument.color;
    ctx.globalAlpha = 0.7;

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
      const y1 = midY + min * midY;
      const y2 = midY + max * midY;
      ctx.fillRect(px, y1, 1, Math.max(1, y2 - y1));
    }

    ctx.globalAlpha = 1;

    // Playhead — approximate position based on tick
    // This is a rough estimate since we don't know exact tick-to-px mapping for audio
    if (duration > 0) {
      const bpm = 120; // fallback
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
  }, [waveformData, track.instrument.color, currentTick, duration]);

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
          <span className="text-xs text-forge-muted ml-auto">{duration.toFixed(1)}s</span>
        )}
      </div>
      <div ref={containerRef} className="flex-1 p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={120}
          className="w-full h-full rounded"
        />
      </div>
      <div className="px-4 py-2 border-t border-forge-border">
        <audio controls src={track.audioUrl} className="w-full h-8" />
      </div>
    </div>
  );
}
