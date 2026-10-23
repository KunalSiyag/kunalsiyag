// Shared pieces for the generated SVGs: palette, terminal chrome, ASCII donut.

export const C = {
  bg: '#0b0e14',
  chrome: '#141922',
  border: '#232a36',
  text: '#c9d1d9',
  dim: '#6e7681',
  prompt: '#7ee787',
  path: '#79c0ff',
  accent: '#ffa657',
  accent2: '#ff7b72',
  accent3: '#d2a8ff',
};

export const MONO = `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', monospace`;

export const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// One line of monospace text. textLength pins the width so rows line up even
// when the viewer's font falls back for box-drawing glyphs.
export const line = (x, y, s, cellW, attrs = '') =>
  s.trim() === ''
    ? ''
    : `<text x="${x}" y="${y}" textLength="${(s.length * cellW).toFixed(1)}" lengthAdjust="spacingAndGlyphs" ${attrs}>${esc(s)}</text>`;

export function chrome(w, h, title) {
  return `
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="12" fill="${C.bg}" stroke="${C.border}"/>
  <path d="M0.5 12.5a12 12 0 0 1 12-12h${w - 25}a12 12 0 0 1 12 12v20h-${w - 1}z" fill="${C.chrome}"/>
  <line x1="0.5" y1="32.5" x2="${w - 0.5}" y2="32.5" stroke="${C.border}"/>
  <circle cx="20" cy="17" r="5.5" fill="#ff5f57"/>
  <circle cx="38" cy="17" r="5.5" fill="#febc2e"/>
  <circle cx="56" cy="17" r="5.5" fill="#28c840"/>
  <text x="${w / 2}" y="21" text-anchor="middle" fill="${C.dim}" font-size="12">${esc(title)}</text>`;
}

// donut.c, adapted: returns rows of a W x H frame for rotation angles A, B.
export function donut(A, B, W = 44, H = 22, K = 13, yOff = 0) {
  const out = Array(W * H).fill(' ');
  const z = Array(W * H).fill(0);
  const [sA, cA, sB, cB] = [Math.sin(A), Math.cos(A), Math.sin(B), Math.cos(B)];
  for (let j = 0; j < 6.28; j += 0.07) {
    const [st, ct] = [Math.sin(j), Math.cos(j)];
    for (let i = 0; i < 6.28; i += 0.02) {
      const [sp, cp] = [Math.sin(i), Math.cos(i)];
      const h = ct + 2;
      const D = 1 / (sp * h * sA + st * cA + 5);
      const t = sp * h * cA - st * sA;
      const x = Math.floor(W / 2 + 2 * K * D * (cp * h * cB - t * sB));
      const y = Math.floor(H / 2 + yOff + K * D * (cp * h * sB + t * cB));
      const o = x + W * y;
      const N = Math.floor(8 * ((st * sA - sp * ct * cA) * cB - sp * ct * sA - st * cA - cp * ct * sB));
      if (y >= 0 && y < H && x >= 0 && x < W && D > z[o]) {
        z[o] = D;
        out[o] = '.,-~:;=!*#$@'[N > 0 ? N : 0];
      }
    }
  }
  const rows = [];
  for (let r = 0; r < H; r++) rows.push(out.slice(r * W, r * W + W).join(''));
  return rows;
}

// Small deterministic PRNG so regenerating the SVG doesn't produce a diff.
export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
