import { TabPosition, STRING_LABELS } from '../../../core/types/tab';
import { NoteDuration } from '../../../core/types/music';

const DURATION_SYMBOLS: Record<NoteDuration, string> = {
  whole: 'w',
  half: 'h',
  quarter: 'q',
  eighth: 'e',
  sixteenth: 's',
};

interface TabGridProps {
  positions: TabPosition[];
  focusedCell: { string: number; position: number };
  onCellClick: (posIndex: number, stringIndex: number) => void;
  onCellChange: (posIndex: number, stringIndex: number, fret: number | null) => void;
  beatsPerMeasure: number;
  playingStep?: number;
}

export function TabGrid({
  positions,
  focusedCell,
  onCellClick,
  onCellChange,
  beatsPerMeasure,
  playingStep = -1,
}: TabGridProps) {
  // Group positions into measures
  const measures: TabPosition[][] = [];
  for (let i = 0; i < positions.length; i += beatsPerMeasure) {
    measures.push(positions.slice(i, i + beatsPerMeasure));
  }

  let globalPosIndex = 0;

  return (
    <div className="space-y-6">
      {measures.map((measure, measureIdx) => {
        const startIndex = globalPosIndex;
        globalPosIndex += measure.length;

        return (
          <div key={measureIdx}>
            <div className="text-xs text-forge-muted mb-1">Measure {measureIdx + 1}</div>
            <div className="border border-forge-border rounded-lg overflow-hidden bg-forge-surface">
              {/* Strum direction row */}
              <div className="flex items-center border-b border-forge-border/50">
                <div className="w-8 text-center text-[9px] font-mono text-forge-muted border-r border-forge-border py-0.5 bg-forge-bg" />
                <div className="flex flex-1">
                  {measure.map((pos, posInMeasure) => {
                    const absolutePosIdx = startIndex + posInMeasure;
                    const isCurrentlyPlaying = absolutePosIdx === playingStep;
                    return (
                      <div
                        key={pos.id + '-strum'}
                        className={`flex-1 text-center py-0.5 text-[10px] font-mono border-r border-forge-border/50 last:border-r-0 ${
                          isCurrentlyPlaying ? 'bg-forge-accent/20' : ''
                        }`}
                        style={{ minWidth: 40 }}
                      >
                        {pos.strum === 'down' && (
                          <span className="text-forge-accent" title="Down strum">{'\u2193'}</span>
                        )}
                        {pos.strum === 'up' && (
                          <span className="text-forge-accent" title="Up strum">{'\u2191'}</span>
                        )}
                        {!pos.strum && (
                          <span className="text-forge-border">{DURATION_SYMBOLS[pos.duration]}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* String rows */}
              {STRING_LABELS.map((label, stringIdx) => (
                <div key={stringIdx} className="flex items-center">
                  <div className="w-8 text-center text-xs font-mono text-forge-muted border-r border-forge-border py-1.5 bg-forge-bg">
                    {label}
                  </div>
                  <div className="flex flex-1">
                    {measure.map((pos, posInMeasure) => {
                      const absolutePosIdx = startIndex + posInMeasure;
                      const fret = pos.strings[stringIdx];
                      const isFocused =
                        focusedCell.string === stringIdx &&
                        focusedCell.position === absolutePosIdx;
                      const isCurrentlyPlaying = absolutePosIdx === playingStep;

                      return (
                        <div
                          key={pos.id + stringIdx}
                          onClick={() => onCellClick(absolutePosIdx, stringIdx)}
                          className={`flex-1 text-center py-1.5 text-sm font-mono cursor-pointer border-r border-forge-border last:border-r-0 transition-colors ${
                            isFocused
                              ? 'bg-forge-accent/20 text-forge-accent ring-1 ring-inset ring-forge-accent'
                              : isCurrentlyPlaying
                              ? 'bg-green-500/15 text-forge-text'
                              : fret !== null
                              ? 'bg-forge-bg text-forge-text hover:bg-forge-accent/10'
                              : 'text-forge-border hover:bg-white/5'
                          }`}
                          style={{ minWidth: 40 }}
                        >
                          {fret !== null ? fret : '-'}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
