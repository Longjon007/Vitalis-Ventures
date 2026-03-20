import { useRef, useEffect, useCallback, useState } from 'react';
import { useProjectStore } from '../../../core/state/project-store';
import { useTransportStore } from '../../../core/state/transport-store';
import { useUIStore, SNAP_GRID_TICKS } from '../../../core/state/ui-store';
import { TICKS_PER_BEAT } from '../../../core/types/music';
import { AutomationParam, AutomationPoint, AutomationLane as AutomationLaneType } from '../../../core/types/project';

const LANE_HEIGHT = 80;
const BASE_TICK_WIDTH = 0.15;
const POINT_RADIUS = 4;

const PARAM_LABELS: Record<AutomationParam, string> = {
  volume: 'Volume',
  pan: 'Pan',
  filterCutoff: 'Filter Cutoff',
};

const PARAM_COLORS: Record<AutomationParam, string> = {
  volume: '#6c5ce7',
  pan: '#00b894',
  filterCutoff: '#fdcb6e',
};

interface AutomationLaneProps {
  trackId: string;
  trackName: string;
}

export function AutomationLane({ trackId, trackName }: AutomationLaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedParam, setSelectedParam] = useState<AutomationParam>('volume');
  const [draggingPoint, setDraggingPoint] = useState<number | null>(null);
  const project = useProjectStore((s) => s.project);
  const updateTrack = useProjectStore((s) => s.updateTrack);
  const currentTick = useTransportStore((s) => s.currentTick);
  const zoom = useUIStore((s) => s.pianoRollZoom);
  const snapGrid = useUIStore((s) => s.snapGrid);

  const tickWidth = BASE_TICK_WIDTH * zoom;
  const GRID_SNAP = SNAP_GRID_TICKS[snapGrid];

  const track = project?.tracks.find((t) => t.id === trackId);
  const automation = track?.automation ?? [];
  const lane = automation.find((l) => l.param === selectedParam);
  const points = lane?.points ?? [];

  const totalTicks = project
    ? project.timeSignature[0] * TICKS_PER_BEAT * 32
    : TICKS_PER_BEAT * 128;
  const canvasWidth = totalTicks * tickWidth;

  // Update automation points on track
  const setPoints = useCallback((newPoints: AutomationPoint[]) => {
    if (!track) return;
    const existingAutomation = track.automation ?? [];
    const laneIndex = existingAutomation.findIndex((l) => l.param === selectedParam);

    let updatedAutomation: AutomationLaneType[];
    if (laneIndex >= 0) {
      updatedAutomation = existingAutomation.map((l, i) =>
        i === laneIndex ? { ...l, points: newPoints } : l
      );
    } else {
      updatedAutomation = [...existingAutomation, { param: selectedParam, points: newPoints }];
    }

    updateTrack(trackId, { automation: updatedAutomation });
  }, [track, selectedParam, trackId, updateTrack]);

  // Drawing
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#121225';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    for (let tick = 0; tick < totalTicks; tick += TICKS_PER_BEAT) {
      const x = tick * tickWidth;
      const isMeasure = tick % (TICKS_PER_BEAT * (project?.timeSignature[0] ?? 4)) === 0;
      ctx.strokeStyle = isMeasure ? '#3a3a5a' : '#1e1e38';
      ctx.lineWidth = isMeasure ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal reference lines (0%, 50%, 100%)
    ctx.strokeStyle = '#222240';
    ctx.lineWidth = 0.5;
    for (const frac of [0, 0.5, 1]) {
      const y = height - frac * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Labels
    ctx.fillStyle = '#444';
    ctx.font = '9px monospace';
    ctx.fillText('100%', 2, 10);
    ctx.fillText('50%', 2, height / 2 + 4);
    ctx.fillText('0%', 2, height - 3);

    const color = PARAM_COLORS[selectedParam];

    // Draw automation curve
    if (points.length > 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      // Start from left edge at first point's value
      const firstY = height - points[0].value * height;
      ctx.moveTo(0, firstY);

      for (const pt of points) {
        const x = pt.tick * tickWidth;
        const y = height - pt.value * height;
        ctx.lineTo(x, y);
      }

      // Extend to right edge at last point's value
      const lastY = height - points[points.length - 1].value * height;
      ctx.lineTo(width, lastY);
      ctx.stroke();

      // Fill under curve
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = color.replace(')', ', 0.1)').replace('rgb', 'rgba');
      ctx.globalAlpha = 0.15;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Draw points
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        const x = pt.tick * tickWidth;
        const y = height - pt.value * height;

        ctx.fillStyle = i === draggingPoint ? '#fff' : color;
        ctx.beginPath();
        ctx.arc(x, y, POINT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Playhead
    const playheadX = currentTick * tickWidth;
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
  }, [points, currentTick, totalTicks, project, tickWidth, selectedParam, draggingPoint]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Get canvas coordinates
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  // Hit test automation points
  const hitTestPoint = useCallback((x: number, y: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const height = canvas.height;

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const px = pt.tick * tickWidth;
      const py = height - pt.value * height;
      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      if (dist < POINT_RADIUS * 2) return i;
    }
    return null;
  }, [points, tickWidth]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const hitIndex = hitTestPoint(x, y);

    if (e.button === 2) {
      // Right click = delete point
      e.preventDefault();
      if (hitIndex !== null) {
        const newPoints = points.filter((_, i) => i !== hitIndex);
        setPoints(newPoints);
      }
      return;
    }

    if (hitIndex !== null) {
      setDraggingPoint(hitIndex);
    } else {
      // Add new point
      const tick = Math.round(x / tickWidth / GRID_SNAP) * GRID_SNAP;
      const value = Math.max(0, Math.min(1, 1 - y / canvas.height));
      const newPoints = [...points, { tick, value }].sort((a, b) => a.tick - b.tick);
      setPoints(newPoints);
      // Find index of new point
      const newIndex = newPoints.findIndex((p) => p.tick === tick && p.value === value);
      setDraggingPoint(newIndex);
    }
  }, [getCanvasCoords, hitTestPoint, points, setPoints, tickWidth, GRID_SNAP]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggingPoint === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasCoords(e);

    const tick = Math.max(0, Math.round(x / tickWidth / GRID_SNAP) * GRID_SNAP);
    const value = Math.max(0, Math.min(1, 1 - y / canvas.height));

    const newPoints = points.map((pt, i) =>
      i === draggingPoint ? { tick, value } : pt
    ).sort((a, b) => a.tick - b.tick);

    setPoints(newPoints);

    // Update dragging index after sort
    const newIndex = newPoints.findIndex((p) => p.tick === tick && p.value === value);
    if (newIndex !== draggingPoint) setDraggingPoint(newIndex);
  }, [draggingPoint, getCanvasCoords, points, setPoints, tickWidth, GRID_SNAP]);

  const handleMouseUp = useCallback(() => {
    setDraggingPoint(null);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Clear all points for this param
  const handleClear = useCallback(() => {
    setPoints([]);
  }, [setPoints]);

  // Add default curve (e.g., full range)
  const handleAddDefault = useCallback(() => {
    const defaultPoints: AutomationPoint[] = [
      { tick: 0, value: selectedParam === 'pan' ? 0.5 : 0.8 },
      { tick: totalTicks / 2, value: selectedParam === 'pan' ? 0.5 : 0.8 },
    ];
    setPoints(defaultPoints);
  }, [setPoints, selectedParam, totalTicks]);

  return (
    <div className="border-t border-forge-border bg-forge-bg shrink-0">
      <div className="flex items-center gap-3 px-4 py-1.5 bg-forge-surface/50 border-b border-forge-border">
        <span className="text-[10px] text-forge-muted font-mono">AUTO</span>
        <span className="text-xs font-medium truncate">{trackName}</span>

        {/* Parameter selector */}
        <div className="flex gap-1 ml-2">
          {(['volume', 'pan', 'filterCutoff'] as AutomationParam[]).map((param) => (
            <button
              key={param}
              onClick={() => setSelectedParam(param)}
              className={`text-[10px] px-2 py-0.5 rounded ${
                selectedParam === param
                  ? 'text-white'
                  : 'bg-forge-border text-forge-muted hover:text-forge-text'
              }`}
              style={selectedParam === param ? { backgroundColor: PARAM_COLORS[param] } : undefined}
            >
              {PARAM_LABELS[param]}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleAddDefault}
            className="text-[9px] px-1.5 py-0.5 rounded bg-forge-border text-forge-muted hover:text-forge-text"
          >
            Init
          </button>
          <button
            onClick={handleClear}
            className="text-[9px] px-1.5 py-0.5 rounded bg-forge-border text-forge-muted hover:text-forge-text"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex">
        <div className="w-12 shrink-0 border-r border-forge-border" />
        <div className="flex-1 overflow-auto">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={LANE_HEIGHT}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={handleContextMenu}
            className="cursor-crosshair"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      </div>
    </div>
  );
}
