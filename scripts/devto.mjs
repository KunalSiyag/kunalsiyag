// Rewrites the block between <!-- devto:start --> and <!-- devto:end --> in
// README.md with the latest DEV articles. No token needed.
import { readFileSync, writeFileSync } from 'node:fs';

const USER = process.env.DEVTO_USER || 'kunalsiyag';
const COUNT = 5;

const res = await fetch(`https://dev.to/api/articles?username=${USER}&per_page=${COUNT}`, {
  headers: { Accept: 'application/vnd.forem.api-v1+json', 'User-Agent': 'profile-readme' },
});
if (!res.ok) throw new Error(`dev.to returned ${res.status}`);
const articles = await res.json();

const month = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const list = articles
  .map((a) => `- [${a.title.replace(/[[\]]/g, '')}](${a.url}) <sub>${month(a.published_at)} · ${a.reading_time_minutes} min</sub>`)
  .join('\n');

const path = new URL('../README.md', import.meta.url);
const readme = readFileSync(path, 'utf8');
const START = '<!-- devto:start -->', END = '<!-- devto:end -->';
const a = readme.indexOf(START), b = readme.lastIndexOf(END);
if (a < 0 || b < a) throw new Error('devto markers missing from README.md');
// Splice by index: titles can contain `$`, which String.replace would treat as a pattern.
const next = `${readme.slice(0, a + START.length)}\n${list}\n\n<sub>[all posts on DEV →](https://dev.to/${USER})</sub>\n${readme.slice(b)}`;
writeFileSync(path, next);
console.log(`README.md  ${articles.length} DEV articles`);
