// Generates assets/hacktoberfest.svg from data/hacktoberfest.json: the sticker
// book as hexagons, earned ones in colour, the rest as outlines.
// Edit the JSON when you earn a sticker, then `node scripts/stickers.mjs`.
import { readFileSync, writeFileSync } from 'node:fs';
import { C, MONO, esc, chrome } from './lib.mjs';

const data = JSON.parse(readFileSync(new URL('../data/hacktoberfest.json', import.meta.url), 'utf8'));
const all = data.groups.flatMap((g) => g.stickers.map((s) => ({ ...s, group: g })));
const earned = all.filter((s) => s.earned).length;

const W = 960, PAD = 28;
const PER_ROW = 14, R = 25, GAP = 63;
const rows = Math.ceil(all.length / PER_ROW);
const TOP = 112;
const H = TOP + rows * 58 + 64;

const hex = (cx, cy, r) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

const body = [];
body.push(
  `<text x="${PAD}" y="62"><tspan fill="${C.prompt}">kunal</tspan><tspan fill="${C.dim}">@</tspan><tspan fill="${C.path}">github</tspan><tspan fill="${C.dim}"> ~ $ </tspan><tspan fill="${C.text}">hacktoberfest --stickers</tspan></text>`,
  `<text x="${PAD}" y="86"><tspan fill="#F5B726">${esc(data.title)}</tspan><tspan fill="${C.dim}">  ·  </tspan><tspan fill="${C.text}">${earned} of ${all.length} stickers</tspan>` +
    (data.highlight ? `<tspan fill="${C.dim}">  ·  </tspan><tspan fill="${C.accent}">${esc(data.highlight)}</tspan>` : '') +
    `</text>`,
);

// Sticker sheet: groups stay together, in book order.
const x0 = (W - (PER_ROW - 1) * GAP) / 2;
all.forEach((s, i) => {
  const cx = x0 + (i % PER_ROW) * GAP;
  const cy = TOP + 22 + Math.floor(i / PER_ROW) * 58;
  const col = s.group.color;
  const tip = `${s.group.name}: ${s.name}${s.earned ? ` (${s.earned})` : ' (not yet)'}`;
  body.push(
    s.earned
      ? `<g><title>${esc(tip)}</title><polygon points="${hex(cx, cy, R)}" fill="${col}" stroke="#F2F2EB" stroke-width="2.5"/>` +
          `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="#F2F2EB" font-size="${s.group.glyph.length > 2 ? 10.5 : 13}" font-weight="bold">${esc(s.group.glyph)}</text></g>`
      : `<g><title>${esc(tip)}</title><polygon points="${hex(cx, cy, R - 2)}" fill="none" stroke="${C.border}" stroke-width="1.5" stroke-dasharray="3 3"/>` +
          `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="${C.border}" font-size="${s.group.glyph.length > 2 ? 10.5 : 13}">${esc(s.group.glyph)}</text></g>`,
  );
});

// Legend: one entry per group with its count.
const legendY = TOP + rows * 58 + 30;
let lx = PAD;
for (const g of data.groups) {
  const got = g.stickers.filter((s) => s.earned).length;
  const label = `${g.name} ${got}/${g.stickers.length}`;
  body.push(
    `<rect x="${lx}" y="${legendY - 9}" width="10" height="10" rx="2" fill="${g.color}"/>`,
    `<text x="${lx + 16}" y="${legendY}" fill="${C.dim}" font-size="11.5">${esc(label)}</text>`,
  );
  lx += 16 + label.length * 6.9 + 22;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">
  <title id="title">Hacktoberfest ${data.year} sticker book</title>
  <desc id="desc">${esc(data.title)}: ${earned} of ${all.length} stickers. ${esc(data.highlight ?? '')}. Earned: ${esc(all.filter((s) => s.earned).map((s) => s.name).join('; '))}.</desc>
  <style>text{font-family:${MONO};font-size:13px;white-space:pre}</style>
  ${chrome(W, H, `hacktoberfest ${data.year}`)}
  ${body.join('\n  ')}
</svg>
`;

writeFileSync(new URL('../assets/hacktoberfest.svg', import.meta.url), svg);
console.log(`assets/hacktoberfest.svg  ${earned}/${all.length} stickers`);
