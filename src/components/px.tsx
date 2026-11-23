// Tiny 9×9 pixel icons, drawn from strings so they stay crisp at any integer scale.
const ICONS = {
  home: ["....X....", "...XXX...", "..XXXXX..", ".XXXXXXX.", "XXXXXXXXX", ".X.....X.", ".X.XXX.X.", ".X.X.X.X.", ".XXXXXXX."],
  search: ["..XXXX...", ".X....X..", "X......X.", "X......X.", "X......X.", ".X....X..", "..XXXXXX.", "......XXX", ".......XX"],
  list: ["XXXXXXXXX", "X.......X", "X.XX.XX.X", "X.......X", "X.XXXXX.X", "X.......X", "X.XXX...X", "X.......X", "XXXXXXXXX"],
  calendar: [".X.....X.", "XXXXXXXXX", "X.......X", "XXXXXXXXX", "X.X.X.X.X", "X.......X", "X.X.X.X.X", "X.......X", "XXXXXXXXX"],
  user: ["...XXX...", "..XXXXX..", "..XXXXX..", "...XXX...", ".........", "..XXXXX..", ".XXXXXXX.", "XXXXXXXXX", "XXXXXXXXX"],
  book: [".XXX.XXX.", "X...X...X", "X.X.X.X.X", "X...X...X", "X.X.X.X.X", "X...X...X", "X...X...X", ".XXX.XXX.", "....X...."],
  quill: [".......XX", "......XXX", ".....XXX.", "....XXX..", "...XXX...", "..XXX....", "..XX.....", ".X.......", "X........"],
  flask: ["..XXXXX..", "...X.X...", "...X.X...", "..X...X..", ".X.....X.", "X..XXX..X", "X.XXXXX.X", "X.XXXXX.X", ".XXXXXXX."],
  mail: [".........", "XXXXXXXXX", "XX.....XX", "X.X...X.X", "X..X.X..X", "X...X...X", "X.......X", "XXXXXXXXX", "........."],
  chart: ["........X", "......X.X", "......X.X", "...X..X.X", "...X..X.X", "X..X..X.X", "X..X..X.X", "X..X..X.X", "XXXXXXXXX"],
  gear: ["...XXX...", ".X.X.X.X.", "..XXXXX..", "XXX...XXX", "XX.....XX", "XXX...XXX", "..XXXXX..", ".X.X.X.X.", "...XXX..."],
  plus: ["...XXX...", "...XXX...", "...XXX...", "XXXXXXXXX", "XXXXXXXXX", "XXXXXXXXX", "...XXX...", "...XXX...", "...XXX..."],
  heart: [".XX...XX.", "XXXX.XXXX", "XXXXXXXXX", "XXXXXXXXX", ".XXXXXXX.", "..XXXXX..", "...XXX...", "....X....", "........."],
  star: ["....X....", "....X....", "...XXX...", "XXXXXXXXX", ".XXXXXXX.", "..XXXXX..", "..XX.XX..", ".XX...XX.", ".X.....X."],
  sparkle: ["....X....", "....X....", "...XXX...", "XXXXXXXXX", "...XXX...", "....X....", "....X....", ".........", "........."],
  clock: ["..XXXXX..", ".X..X..X.", "X...X...X", "X...X...X", "X...XXX.X", "X.......X", "X.......X", ".X.....X.", "..XXXXX.."],
  check: [".........", "........X", ".......XX", "X.....XX.", "XX...XX..", ".XX.XX...", "..XXX....", "...X.....", "........."],
  doc: ["XXXXXX...", "X....XX..", "X....XXX.", "X......X.", "X.XXXX.X.", "X......X.", "X.XXXX.X.", "X......X.", "XXXXXXXX."],
  bolt: ["....XXX..", "...XXX...", "..XXX....", ".XXXXXXX.", "....XXX..", "...XXX...", "..XX.....", ".X.......", "........."],
  flag: ["X........", "XXXXXX...", "XXXXXXXX.", "XXXXXX...", "X........", "X........", "X........", "X........", "X........"],
  link: ["....XXXXX", ".....XXXX", "....XXXXX", "...XXX.XX", "..XXX...X", ".XXX.....", "XXX......", "XX.......", "........."],
} as const;

export type IconName = keyof typeof ICONS;

export function Px({ name, size = 2, className, label }: { name: IconName; size?: number; className?: string; label?: string }) {
  const rows = ICONS[name];
  return (
    <svg
      className={`px ${className ?? ""}`}
      width={9 * size}
      height={9 * size}
      viewBox="0 0 9 9"
      shapeRendering="crispEdges"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {rows.flatMap((r, y) => [...r].map((c, x) => (c === "X" ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" /> : null)))}
    </svg>
  );
}
