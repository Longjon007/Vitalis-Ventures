import { TabPosition, STRING_LABELS } from '../types/tab';

export function exportToTabText(
  positions: TabPosition[],
  measuresPerLine: number = 4,
  beatsPerMeasure: number = 4
): string {
  if (positions.length === 0) return '';

  const positionsPerMeasure = beatsPerMeasure;
  const measures: TabPosition[][] = [];

  for (let i = 0; i < positions.length; i += positionsPerMeasure) {
    measures.push(positions.slice(i, i + positionsPerMeasure));
  }

  const lines: string[] = [];

  for (let lineStart = 0; lineStart < measures.length; lineStart += measuresPerLine) {
    const lineMeasures = measures.slice(lineStart, lineStart + measuresPerLine);
    const stringLines: string[] = Array(6).fill('');

    for (let s = 0; s < 6; s++) {
      stringLines[s] = `${STRING_LABELS[s]}|`;
    }

    for (const measure of lineMeasures) {
      for (const pos of measure) {
        for (let s = 0; s < 6; s++) {
          const fret = pos.strings[s];
          if (fret === null) {
            stringLines[s] += '--';
          } else {
            const fretStr = fret.toString();
            stringLines[s] += fretStr.length === 1 ? `-${fretStr}` : fretStr;
          }
        }
      }
      for (let s = 0; s < 6; s++) {
        stringLines[s] += '-|';
      }
    }

    lines.push(stringLines.join('\n'));
  }

  return lines.join('\n\n');
}

export function downloadTabText(positions: TabPosition[], filename: string) {
  const text = exportToTabText(positions);
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename.replace(/\s+/g, '_')}.tab.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
