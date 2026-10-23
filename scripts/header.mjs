// Generates assets/header.svg: a terminal that types `whoami`, decodes the
// name out of noise, prints a short intro, and spins an ASCII donut.
// No dependencies, no network: `node scripts/header.mjs`.
import { writeFileSync } from 'node:fs';
import { C, MONO, esc, line, chrome, donut, rng } from './lib.mjs';

const NAME = [
  '██╗  ██╗██╗   ██╗███╗   ██╗ █████╗ ██╗         ███████╗██╗██╗   ██╗ █████╗  ██████╗ ',
  '██║ ██╔╝██║   ██║████╗  ██║██╔══██╗██║         ██╔════╝██║╚██╗ ██╔╝██╔══██╗██╔════╝ ',
  '█████╔╝ ██║   ██║██╔██╗ ██║███████║██║         ███████╗██║ ╚████╔╝ ███████║██║  ███╗',
  '██╔═██╗ ██║   ██║██║╚██╗██║██╔══██║██║         ╚════██║██║  ╚██╔╝  ██╔══██║██║   ██║',
  '██║  ██╗╚██████╔╝██║ ╚████║██║  ██║███████╗    ███████║██║   ██║   ██║  ██║╚██████╔╝',
  '╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝    ╚══════╝╚═╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ',
];

const INTRO = [
  'I build things that move, break, or talk back.',
  'A Wayland recorder whose camera chases your cursor, a city run',
  'by five AI mayors, a store built to fall over on sale day.',
];

const W = 960, H = 340;
const PAD = 28;

// Name block: 84 columns squeezed into ~600px.
const NAME_CELL = 7.1, NAME_LH = 15.5, NAME_Y = 104;
// Body text.
const CELL = 7.8, LH = 21;
// Donut: right-hand side.
const DN = { W: 42, H: 21, K: 13, cell: 6.6, lh: 11.4, x: 650, y: 66, frames: 72, secs: 7.2 };

const T = { whoami: 0.3, decode: 1.1, decodeFrames: 16, decodeStep: 0.07, cat: 2.6, intro: 3.3 };

const css = [];
const body = [];

// Typed command: one tspan per character, each fading in on its own beat.
let typedId = 0;
function typed(x, y, cmd, start, perChar = 0.06) {
  const cls = `t${typedId++}`;
  const spans = [...cmd]
    .map((ch, i) => `<tspan class="${cls}" style="animation-delay:${(start + i * perChar).toFixed(2)}s">${esc(ch)}</tspan>`)
    .join('');
  body.push(
    `<text x="${x}" y="${y}"><tspan fill="${C.prompt}">kunal</tspan><tspan fill="${C.dim}">@</tspan><tspan fill="${C.path}">github</tspan><tspan fill="${C.dim}"> ~ $ </tspan><tspan fill="${C.text}">${spans}</tspan></text>`,
  );
  css.push(`.${cls}{fill-opacity:0;animation:ton .01s linear forwards}`);
  return start + cmd.length * perChar;
}

// 1. $ whoami
typed(PAD, 62, 'whoami', T.whoami);

// 2. Name decodes left to right out of a band of noise.
const rand = rng(7);
const NOISE = '<>/\\|[]{}=+*^#%&?!;:';
const cols = NAME[0].length;
const band = 10;
for (let k = 0; k < T.decodeFrames; k++) {
  const last = k === T.decodeFrames - 1;
  const edge = last ? Infinity : ((k + 1) / T.decodeFrames) * (cols + band) - band;
  const rows = NAME.map((row) =>
    [...row]
      .map((ch, c) => {
        if (ch === ' ' || c < edge) return ch;
        if (c < edge + band) return NOISE[Math.floor(rand() * NOISE.length)];
        return ' ';
      })
      .join(''),
  );
  const on = T.decode + k * T.decodeStep;
  const anim = last
    ? `on .01s linear ${on.toFixed(2)}s forwards`
    : `on .01s linear ${on.toFixed(2)}s forwards, off .01s linear ${(on + T.decodeStep).toFixed(2)}s forwards`;
  body.push(
    `<g class="nm${last ? ' final' : ''}" style="animation:${anim}">` +
      rows.map((r, i) => line(PAD, NAME_Y + i * NAME_LH, r, NAME_CELL)).join('') +
      `</g>`,
  );
}
css.push(`.nm{opacity:0;fill:url(#g);font-size:12.5px}`);

// 3. $ cat now.txt, then the intro.
const introY = NAME_Y + NAME.length * NAME_LH + 26;
typed(PAD, introY, 'cat now.txt', T.cat);
INTRO.forEach((s, i) => {
  body.push(
    `<text class="intro" x="${PAD}" y="${introY + (i + 1) * LH + 4}" style="animation-delay:${(T.intro + i * 0.35).toFixed(2)}s" fill="${i ? C.text : C.accent}">${esc(s)}</text>`,
  );
});
css.push(`.intro{opacity:0;animation:on .35s ease-out forwards}`);

// Blinking block cursor on a fresh prompt.
const cursorY = introY + (INTRO.length + 1) * LH + 12;
const cursorStart = T.intro + INTRO.length * 0.35 + 0.2;
body.push(
  `<g class="intro" style="animation-delay:${cursorStart.toFixed(2)}s"><text x="${PAD}" y="${cursorY}"><tspan fill="${C.prompt}">kunal</tspan><tspan fill="${C.dim}">@</tspan><tspan fill="${C.path}">github</tspan><tspan fill="${C.dim}"> ~ $ </tspan></text>` +
    `<rect class="cur" x="${PAD + 17 * CELL}" y="${cursorY - 13}" width="8" height="16" fill="${C.accent}"/></g>`,
);
css.push(`.cur{animation:blink 1.1s steps(1) infinite}`);

// 4. Donut, one group per frame, each shown for 1/frames of the loop.
const frameDur = DN.secs / DN.frames;
const donutFrames = [];
for (let f = 0; f < DN.frames; f++) {
  const a = (2 * Math.PI * f) / DN.frames;
  const rows = donut(a, a, DN.W, DN.H, DN.K);
  donutFrames.push(
    `<g class="dn${f === 0 ? ' d0' : ''}" style="animation-delay:${(f * frameDur - DN.secs).toFixed(3)}s">` +
      rows.map((r, i) => line(DN.x, DN.y + i * DN.lh, r, DN.cell)).join('') +
      `</g>`,
  );
}
const visiblePct = (100 / DN.frames).toFixed(4);
css.push(
  `.dn{opacity:0;fill:url(#d);font-size:10.5px;animation:frame ${DN.secs}s steps(1,end) infinite}`,
  `@keyframes frame{0%{opacity:1}${visiblePct}%,100%{opacity:0}}`,
);

css.push(
  `@keyframes on{from,to{opacity:1}}`,
  `@keyframes ton{from,to{fill-opacity:1}}`,
  `@keyframes off{from,to{opacity:0}}`,
  `@keyframes blink{0%{opacity:1}50%{opacity:0}}`,
  // Reduced motion: skip straight to the finished terminal and a still donut.
  `@media (prefers-reduced-motion:reduce){*{animation:none!important}.nm.final,.intro,.d0{opacity:1!important}[class^="t"]{fill-opacity:1!important}}`,
);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">
  <title id="title">Kunal Siyag</title>
  <desc id="desc">A terminal types whoami and prints KUNAL SIYAG in block letters, then: ${esc(INTRO.join(' '))} An ASCII donut spins beside it.</desc>
  <defs>
    <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${PAD}" x2="${PAD + NAME[0].length * NAME_CELL}" y1="0" y2="0">
      <stop offset="0" stop-color="${C.accent}"/><stop offset=".55" stop-color="${C.accent2}"/><stop offset="1" stop-color="${C.accent3}"/>
    </linearGradient>
    <linearGradient id="d" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${DN.y - 10}" y2="${DN.y + DN.H * DN.lh}">
      <stop offset="0" stop-color="${C.accent3}"/><stop offset="1" stop-color="${C.accent}"/>
    </linearGradient>
  </defs>
  <style>
    text{font-family:${MONO};font-size:13px;white-space:pre}
    ${css.join('\n    ')}
  </style>
  ${chrome(W, H, 'kunal@github: ~')}
  ${body.join('\n  ')}
  ${donutFrames.join('\n  ')}
</svg>
`;

writeFileSync(new URL('../assets/header.svg', import.meta.url), svg);
console.log(`assets/header.svg  ${(svg.length / 1024).toFixed(1)} KB`);
