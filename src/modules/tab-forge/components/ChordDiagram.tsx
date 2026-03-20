interface ChordDiagramProps {
  frets: (number | null)[];
  size?: number;
}

const STRINGS = 6;
const FRETS_SHOWN = 5;

export function ChordDiagram({ frets, size = 80 }: ChordDiagramProps) {
  const padding = 10;
  const topPadding = 14;
  const width = size;
  const height = size + 8;
  const fretboardWidth = width - padding * 2;
  const fretboardHeight = height - topPadding - padding;
  const stringSpacing = fretboardWidth / (STRINGS - 1);
  const fretSpacing = fretboardHeight / FRETS_SHOWN;
  const dotRadius = Math.min(stringSpacing, fretSpacing) * 0.3;

  // Determine if we need an offset (for barre chords above fret 4)
  const playedFrets = frets.filter((f): f is number => f !== null && f > 0);
  const minFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 0;
  const maxFret = playedFrets.length > 0 ? Math.max(...playedFrets) : 0;
  const offset = maxFret > FRETS_SHOWN ? minFret - 1 : 0;
  const showNut = offset === 0;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Open / muted indicators */}
      {frets.map((fret, i) => {
        const x = padding + i * stringSpacing;
        const y = topPadding - 5;
        if (fret === null) {
          return (
            <text
              key={`ind-${i}`}
              x={x}
              y={y}
              textAnchor="middle"
              fontSize={7}
              fill="#888"
            >
              x
            </text>
          );
        }
        if (fret === 0) {
          return (
            <circle
              key={`ind-${i}`}
              cx={x}
              cy={y - 2}
              r={dotRadius * 0.8}
              fill="none"
              stroke="#888"
              strokeWidth={1}
            />
          );
        }
        return null;
      })}

      {/* Nut or fret offset label */}
      {showNut ? (
        <line
          x1={padding}
          y1={topPadding}
          x2={padding + fretboardWidth}
          y2={topPadding}
          stroke="#e2e2f0"
          strokeWidth={2.5}
        />
      ) : (
        <text
          x={padding - 7}
          y={topPadding + fretSpacing * 0.6}
          fontSize={6}
          fill="#888"
          textAnchor="middle"
        >
          {offset + 1}
        </text>
      )}

      {/* Fret lines */}
      {Array.from({ length: FRETS_SHOWN + 1 }).map((_, i) => {
        const y = topPadding + i * fretSpacing;
        return (
          <line
            key={`fret-${i}`}
            x1={padding}
            y1={y}
            x2={padding + fretboardWidth}
            y2={y}
            stroke="#3a3a5a"
            strokeWidth={i === 0 && !showNut ? 1 : 0.8}
          />
        );
      })}

      {/* String lines */}
      {Array.from({ length: STRINGS }).map((_, i) => {
        const x = padding + i * stringSpacing;
        return (
          <line
            key={`str-${i}`}
            x1={x}
            y1={topPadding}
            x2={x}
            y2={topPadding + fretboardHeight}
            stroke="#555"
            strokeWidth={0.8}
          />
        );
      })}

      {/* Finger dots */}
      {frets.map((fret, i) => {
        if (fret === null || fret === 0) return null;
        const adjustedFret = fret - offset;
        const x = padding + i * stringSpacing;
        const y = topPadding + (adjustedFret - 0.5) * fretSpacing;
        return (
          <circle
            key={`dot-${i}`}
            cx={x}
            cy={y}
            r={dotRadius}
            fill="#6c5ce7"
          />
        );
      })}
    </svg>
  );
}
