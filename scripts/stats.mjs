// Generates assets/stats.svg: a neofetch-style card with GitHub numbers and an
// ASCII contribution heatmap. Needs a token: GITHUB_TOKEN=... node scripts/stats.mjs
import { writeFileSync } from 'node:fs';
import { C, MONO, esc, line, chrome, donut } from './lib.mjs';

const LOGIN = process.env.LOGIN || 'KunalSiyag';
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error('GITHUB_TOKEN is not set');

const query = `query($login: String!) {
  user(login: $login) {
    createdAt
    followers { totalCount }
    pullRequests(states: MERGED) { totalCount }
    repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100) {
      totalCount
      nodes {
        stargazerCount
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } }
      }
    }
    contributionsCollection {
      totalCommitContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, variables: { login: LOGIN } }),
});
const json = await res.json();
if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? json));
const u = json.data.user;

const repos = u.repositories.nodes;
const stars = repos.reduce((n, r) => n + r.stargazerCount, 0);
const cal = u.contributionsCollection.contributionCalendar;
const days = cal.weeks.flatMap((w) => w.contributionDays);

// Current streak counts back from today, or from yesterday if today is still empty.
let i = days.length - 1;
if (days[i].contributionCount === 0) i--;
let streak = 0;
while (i >= 0 && days[i].contributionCount > 0) streak++, i--;
let longest = 0, run = 0;
for (const d of days) (run = d.contributionCount ? run + 1 : 0), (longest = Math.max(longest, run));

const langs = new Map();
for (const r of repos)
  for (const e of r.languages.edges) {
    const l = langs.get(e.node.name) ?? { size: 0, color: e.node.color ?? C.dim };
    l.size += e.size;
    langs.set(e.node.name, l);
  }
const langTotal = [...langs.values()].reduce((n, l) => n + l.size, 0);
const topLangs = [...langs.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 5);

const years = new Date().getFullYear() - new Date(u.createdAt).getFullYear();
const fmt = (n) => n.toLocaleString('en-US');

// ---- layout ----
const W = 960, H = 408, PAD = 28, CELL = 7.8, LH = 20;
const body = [];

// Left: a still frame of the header's donut, so the two cards read as a pair.
donut(0.9, 0.5, 34, 17, 10.5).forEach((r, k) =>
  body.push(line(PAD, 62 + k * 11, r, 6.4, `class="logo"`)),
);

// Right: key/value lines, neofetch style.
const X = 290;
const kv = [
  ['repos', `${fmt(u.repositories.totalCount)} public`],
  ['stars', fmt(stars)],
  ['followers', fmt(u.followers.totalCount)],
  ['merged prs', fmt(u.pullRequests.totalCount)],
  ['commits', `${fmt(u.contributionsCollection.totalCommitContributions)} in the last year`],
  ['contribs', `${fmt(cal.totalContributions)} in the last year`],
  ['streak', `${streak} day${streak === 1 ? '' : 's'} now, ${longest} best`],
  ['on github', `${years} year${years === 1 ? '' : 's'}`],
];
body.push(
  `<text x="${X}" y="62"><tspan fill="${C.prompt}" font-weight="bold">kunal</tspan><tspan fill="${C.dim}">@</tspan><tspan fill="${C.path}" font-weight="bold">github</tspan></text>`,
  `<text x="${X}" y="${62 + LH * 0.8}" fill="${C.dim}">${'─'.repeat(12)}</text>`,
);
kv.forEach(([k, v], n) =>
  body.push(
    `<text x="${X}" y="${62 + LH * (n + 1.8)}"><tspan fill="${C.accent}">${esc(k.padEnd(11))}</tspan><tspan fill="${C.text}">${esc(v)}</tspan></text>`,
  ),
);

// Languages: one bar split by share, then a legend.
const LX = 640, LW = 290;
body.push(`<text x="${LX}" y="62" fill="${C.accent}">languages</text>`);
let off = 0;
const shown = topLangs.reduce((n, [, l]) => n + l.size, 0);
topLangs.forEach(([name, l], n) => {
  const w = (l.size / shown) * LW;
  body.push(`<rect x="${(LX + off).toFixed(1)}" y="76" width="${Math.max(w - 2, 1).toFixed(1)}" height="8" rx="2" fill="${l.color}"/>`);
  off += w;
  const pct = ((l.size / langTotal) * 100).toFixed(1);
  body.push(
    `<circle cx="${LX + 5}" cy="${108 + n * LH - 4}" r="4" fill="${l.color}"/>`,
    `<text x="${LX + 16}" y="${108 + n * LH}" fill="${C.text}">${esc(name.padEnd(14))}<tspan fill="${C.dim}">${pct.padStart(5)}%</tspan></text>`,
  );
});

// Bottom: the last year of contributions as shaded ASCII cells.
const SHADES = ['·', '░', '▒', '▓', '█'];
const SHADE_FILL = [C.border, '#0e4429', '#006d32', '#26a641', '#39d353'];
const counts = days.map((d) => d.contributionCount).filter(Boolean).sort((a, b) => a - b);
const q = (p) => counts[Math.floor(p * (counts.length - 1))] ?? 1;
const cuts = [q(0.25), q(0.5), q(0.75)];
const level = (n) => (n === 0 ? 0 : n <= cuts[0] ? 1 : n <= cuts[1] ? 2 : n <= cuts[2] ? 3 : 4);

const HY = 296, HCELL = 16.6, HROW = 14.2;
body.push(`<text x="${PAD}" y="${HY - 14}" fill="${C.dim}">$ git log --since="1 year ago" | heatmap</text>`);
cal.weeks.forEach((w, c) =>
  w.contributionDays.forEach((d) => {
    const lv = level(d.contributionCount);
    const r = new Date(d.date + 'T00:00:00Z').getUTCDay();
    body.push(
      `<text x="${(PAD + c * HCELL).toFixed(1)}" y="${HY + r * HROW}" fill="${SHADE_FILL[lv]}" font-size="9" textLength="14" lengthAdjust="spacingAndGlyphs">${SHADES[lv].repeat(2)}<title>${d.date}: ${d.contributionCount}</title></text>`,
    );
  }),
);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">
  <title id="title">GitHub stats for ${esc(LOGIN)}</title>
  <desc id="desc">${esc(kv.map(([k, v]) => `${k}: ${v}`).join('; '))}. Top languages: ${esc(topLangs.map(([n]) => n).join(', '))}.</desc>
  <style>
    text{font-family:${MONO};font-size:13px;white-space:pre}
    .logo{fill:${C.accent3};font-size:10px;opacity:.85}
  </style>
  ${chrome(W, H, 'neofetch')}
  ${body.join('\n  ')}
</svg>
`;

writeFileSync(new URL('../assets/stats.svg', import.meta.url), svg);
console.log(`assets/stats.svg  ${(svg.length / 1024).toFixed(1)} KB  (${stars} stars, streak ${streak}/${longest})`);
