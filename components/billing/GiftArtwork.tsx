/**
 * Header artwork for the welcome gift: a mint mosaic that dissolves into loose
 * pixels at its edges, with a 3D gift box at the centre.
 *
 * Pure SVG rather than an image: it scales with the card, costs no request, and
 * keeps the `$5` as real text instead of baking a price into a bitmap that would
 * go stale the day the grant changes.
 */

const COLUMNS = 24;
const ROWS = 9;
const CELL = 16;
const WIDTH = COLUMNS * CELL;
const HEIGHT = ROWS * CELL;

/**
 * Stable pseudo-random value in `[0, 1)` for a cell.
 *
 * Integer arithmetic via `Math.imul`, not `Math.random` or `Math.sin`. The mosaic
 * is rendered on the server and again in the browser, so the field has to come out
 * bit-identical on both or React reports a hydration mismatch — and `Math.sin` is
 * only specified to be *approximately* right, which is not the same thing.
 */
function cellNoise(x: number, y: number): number {
  let h = Math.imul(x + 1, 0x27d4eb2d) ^ Math.imul(y + 1, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/**
 * How solid the mosaic is at a cell: 1 in the middle of the blob, 0 outside it.
 *
 * A wide, squashed ellipse sitting slightly low. Wide enough that the middle rows
 * still scatter cells into the first and last column, so the banner reads as
 * full-bleed mint the way the design does, while the corners fall to zero and keep
 * the shape from hardening into a rectangle with noise sprinkled on it.
 */
function density(x: number, y: number): number {
  const dx = (x - COLUMNS / 2 + 0.5) / (COLUMNS * 0.62);
  const dy = (y - ROWS * 0.56) / (ROWS * 0.72);
  return Math.max(0, Math.min(1, 1.22 - (dx * dx + dy * dy) * 1.15));
}

/** Three mint steps: the blob reads as a gradient without needing one. */
function cellFill(t: number): string {
  if (t > 0.72) return "#5eead4";
  if (t > 0.42) return "#99f6e4";
  return "#cffafe";
}

interface Cell {
  key: string;
  x: number;
  y: number;
  fill: string;
  opacity: number;
}

const CELLS: Cell[] = (() => {
  const out: Cell[] = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLUMNS; x += 1) {
      const t = density(x, y);
      // Inside the blob every cell is drawn; at the fringe the noise decides, which
      // is what produces the scattered single squares instead of a hard edge.
      if (t <= 0 || cellNoise(x, y) > t) continue;
      out.push({
        key: `${x}-${y}`,
        x: x * CELL,
        y: y * CELL,
        fill: cellFill(t),
        opacity: 0.34 + 0.66 * t,
      });
    }
  }
  return out;
})();

export default function GiftArtwork({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={className}
      role="img"
      aria-label="صندوق هدية بقيمة 5 دولارات"
    >
      <g>
        {CELLS.map((cell) => (
          <rect
            key={cell.key}
            x={cell.x}
            y={cell.y}
            width={CELL - 1.5}
            height={CELL - 1.5}
            rx={1.5}
            fill={cell.fill}
            opacity={cell.opacity}
          />
        ))}
      </g>

      <Sparkle x={318} y={34} size={26} opacity={0.95} />
      <Sparkle x={62} y={112} size={18} opacity={0.8} />

      {/* The box is drawn in its own 200-unit space and placed as a whole, so its
          proportions do not have to be re-derived if the banner changes size. */}
      <g transform={`translate(${WIDTH / 2} ${HEIGHT / 2 - 2}) scale(0.63) translate(-104 -100)`}>
        <GiftBox />
      </g>
    </svg>
  );
}

function Sparkle({
  x,
  y,
  size,
  opacity,
}: {
  x: number;
  y: number;
  size: number;
  opacity: number;
}) {
  const r = size / 2;
  return (
    <path
      transform={`translate(${x} ${y}) scale(${r / 12})`}
      d="M0 -12Q1.4 -1.4 12 0Q1.4 1.4 0 12Q-1.4 1.4 -12 0Q-1.4 -1.4 0 -12Z"
      fill="#2dd4bf"
      opacity={opacity}
    />
  );
}

/**
 * The box itself: a flat front face carrying the amount, with an isometric lid and
 * a bow on top. Front-facing rather than fully isometric so `$5` sits on a
 * rectangle and stays legible at the size a dialog header allows.
 */
function GiftBox() {
  return (
    <g>
      <ellipse cx="104" cy="182" rx="66" ry="9" fill="#0f766e" opacity="0.16" />

      {/* Body: right side first, so the front face overlaps its edge. */}
      <path d="M164 80 181 62v98l-17 16V80Z" fill="#0d9488" />
      <path d="M44 80h120v96a6 6 0 0 1-6 6H50a6 6 0 0 1-6-6V80Z" fill="#14b8a6" />

      {/* Lid, wider than the body — the overhang is what makes it read as a lid. */}
      <path d="M172 56 189 38v30l-17 18V56Z" fill="#0d9488" />
      <path d="M36 56h136v26a4 4 0 0 1-4 4H40a4 4 0 0 1-4-4V56Z" fill="#2dd4bf" />
      <path d="M53 38h136l-17 18H36l17-18Z" fill="#5eead4" />

      {/* Ribbon: on the lid only. The front face belongs to the number. */}
      <path d="M96 56h18v30H96V56Z" fill="#99f6e4" />
      <path d="M113 38h18l-17 18H96l17-18Z" fill="#ccfbf1" />

      <g fill="#0d9488">
        <path d="M105 38c-6-16-18-24-30-20-10 4-10 16 0 20h30Z" />
        <path d="M105 38c6-16 18-24 30-20 10 4 10 16 0 20h-30Z" />
      </g>
      <ellipse cx="105" cy="36" rx="11" ry="8" fill="#0f766e" />

      <text
        x="104"
        y="141"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="42"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
        letterSpacing="-1"
      >
        $5
      </text>
    </g>
  );
}
