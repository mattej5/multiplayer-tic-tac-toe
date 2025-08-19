function round(n: number) {
  'worklet';
  return Math.round(n); // crisper lines
}

const SIZE = 96;         // each square
const GAP = 8;           // space between squares
const GRID = SIZE * 3 + GAP * 2; // total grid box
const THICKNESS = 6;     // strike line thickness

export default function getWinLineStyle(line: number[]) {
  // Common base for an absolutely-positioned line inside GRID x GRID box
  const base: any = {
    position: 'absolute',
    borderRadius: 999,
    height: THICKNESS,
  };

  // Rows
  if (line[0] % 3 === 0 && line[1] === line[0] + 1 && line[2] === line[0] + 2) {
    const row = Math.floor(line[0] / 3); // 0..2
    const top = row * (SIZE + GAP) + SIZE / 2 - THICKNESS / 2;
    return {
      ...base,
      left: 0,
      top: round(top),
      width: GRID,
      transform: [], // no rotation
    };
  }

  // Columns
  if (line[0] < 3 && line[1] === line[0] + 3 && line[2] === line[0] + 6) {
    const col = line[0] % 3; // 0..2
    const left = col * (SIZE + GAP) + SIZE / 2 - THICKNESS / 2;
    return {
      position: 'absolute',
      top: 0,
      left: round(left),
      width: THICKNESS,
      height: GRID,
      borderRadius: 999,
      transform: [],
    };
  }

  // Diagonals — draw through the exact center and rotate
  const centerTop = GRID / 2 - THICKNESS / 2;
  const diagLen = GRID * Math.SQRT2; // reach corner-to-corner
  const left = (GRID - diagLen) / 2;

  const rotate = line[0] === 0 ? '45deg' : '-45deg'; // 0,4,8 vs 2,4,6

  return {
    ...base,
    width: diagLen,
    left: round(left),
    top: round(centerTop),
    transform: [{ rotate }],
  };
}