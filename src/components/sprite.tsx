// A tiny 1-bit companion that reacts to how the hunt is going (PLAN.md §8).
const FACES: Record<"idle" | "happy" | "sad", string[]> = {
  idle: [
    "....XXXXXX....",
    "..XX......XX..",
    ".X..........X.",
    "X...XX..XX...X",
    "X...XX..XX...X",
    "X............X",
    "X............X",
    "X...XXXXXX...X",
    ".X..........X.",
    "..XX......XX..",
    "....XXXXXX....",
    "...X..XX..X...",
    "..X...XX...X..",
    "......XX......",
  ],
  happy: [
    "....XXXXXX....",
    "..XX......XX..",
    ".X..........X.",
    "X...X....X...X",
    "X..X.X..X.X..X",
    "X............X",
    "X..X......X..X",
    "X...XXXXXX...X",
    ".X..........X.",
    "..XX......XX..",
    "....XXXXXX....",
    ".X....XX....X.",
    "..X...XX...X..",
    "...X..XX..X...",
  ],
  sad: [
    "....XXXXXX....",
    "..XX......XX..",
    ".X..........X.",
    "X...XX..XX...X",
    "X............X",
    "X............X",
    "X...XXXXXX...X",
    "X..X......X..X",
    ".X..........X.",
    "..XX......XX..",
    "....XXXXXX....",
    "......XX......",
    ".....X..X.....",
    "....X....X....",
  ],
};

export function Sprite({ mood, size = 4 }: { mood: keyof typeof FACES; size?: number }) {
  const rows = FACES[mood];
  return (
    <svg className="sprite" width={14 * size} height={14 * size} viewBox="0 0 14 14" shapeRendering="crispEdges" role="img" aria-label={`Companion looks ${mood}`}>
      {rows.flatMap((r, y) => [...r].map((c, x) => (c === "X" ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" /> : null)))}
    </svg>
  );
}
