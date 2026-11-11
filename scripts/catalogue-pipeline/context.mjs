import {readFileSync} from 'node:fs';
import path from 'node:path';
import {digest} from '../editorial/content.mjs';
import {readJSON} from '../promotion/core.mjs';

const SKILL_FILES = ['SKILL.md','references/editing.md','references/catalogue.md'];
const skillText = root => SKILL_FILES.map(file => readFileSync(path.join(root,'skills/indiek-editorial',file),'utf8')).join('\n\n');

// Catalogue work reads the editorial skill and the catalogue entry rules. A review binds to this revision.
export const catalogueInstructions = root => skillText(root);
export const catalogueSkillRevision = root => digest(skillText(root));

// Search Console query rows from a UI export (Performance → Queries CSV) or API JSON.
export function parseSearchConsoleCSV(file) {
  const text = readFileSync(file,'utf8');
  if (file.endsWith('.json')) return JSON.parse(text).rows.map(r => ({query:r.keys?.[0] ?? r.query, clicks:r.clicks || 0, impressions:r.impressions || 0}));
  const lines = text.trim().split(/\r?\n/).map(line => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(cell => cell.replace(/,$/,'').replace(/^"|"$/g,'').replace(/""/g,'"')));
  const [header,...rows] = lines;
  const at = name => header.findIndex(h => h.toLowerCase().includes(name));
  const q = at('quer') >= 0 ? at('quer') : at('검색어'), c = at('click') >= 0 ? at('click') : at('클릭'), i = at('impression') >= 0 ? at('impression') : at('노출');
  if (q < 0 || c < 0 || i < 0) throw new Error('Expected query, clicks and impressions columns');
  return rows.filter(r => r[q]).map(r => ({query:r[q], clicks:Number(r[c]) || 0, impressions:Number(r[i]) || 0}));
}
export function loadSearchRows(file) {
  const data = readJSON(file,null);
  if (!data?.rows?.length) return {rows:[], note:'No Search Console query export was available, so search demand is 0 for every candidate.'};
  return {rows:data.rows, note:`Search Console rows: ${data.rows.length} queries (${data.period}, ${data.source}, checked ${data.checked}).`};
}
