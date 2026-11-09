import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {lastmodTracker, pageSignature, sitemapDates, sitemapXML} from './sitemap.mjs';

const page = ({title = 'A', body = 'Song notes', version = '1'} = {}) => `<!doctype html><html><head><title>${title}</title><meta name="description" content="About ${title}"><link rel="stylesheet" href="/styles.css?v=${version}"></head><body><header>nav ${version}</header><main id="main">${body}</main><footer>${version}</footer></body></html>\n`;

test('page signature follows content, not shared chrome or asset versions', () => {
  assert.equal(pageSignature(page({version:'1'})), pageSignature(page({version:'2'})));
  assert.notEqual(pageSignature(page()), pageSignature(page({body:'New song notes'})));
  assert.notEqual(pageSignature(page()), pageSignature(page({title:'B'})));
});

test('sitemap dates round-trip through the XML', () => {
  const xml = sitemapXML([{url:'https://indiek.com/', lastmod:'2026-11-09'}, {url:'https://indiek.com/about/'}]);
  assert.match(xml, /<url><loc>https:\/\/indiek.com\/<\/loc><lastmod>2026-11-09<\/lastmod><\/url><url><loc>https:\/\/indiek.com\/about\/<\/loc><\/url>/);
  assert.deepEqual([...sitemapDates(xml)], [['https://indiek.com/', '2026-11-09']]);
});

test('lastmod keeps committed dates and moves only changed or new pages', t => {
  const root = mkdtempSync(path.join(tmpdir(), 'indiek-sitemap-'));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  const run = (args, date = '2026-11-01T12:00:00+09:00') => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {cwd:root, stdio:'ignore', env:{...process.env, GIT_AUTHOR_NAME:'test', GIT_AUTHOR_EMAIL:'test@example.com', GIT_COMMITTER_NAME:'test', GIT_COMMITTER_EMAIL:'test@example.com', GIT_COMMITTER_DATE:date}});
  const write = (file, text) => { mkdirSync(path.dirname(path.join(root, file)), {recursive:true}); writeFileSync(path.join(root, file), text); };
  run(['init', '-q']);
  write('dist/a/index.html', page({title:'A'}));
  write('dist/b/index.html', page({title:'B'}));
  write('dist/sitemap.xml', sitemapXML([{url:'https://indiek.com/a/'}, {url:'https://indiek.com/b/'}]));
  run(['add', '.']);
  run(['commit', '-qm', 'first'], '2026-10-20T12:00:00+09:00');
  write('dist/a/index.html', page({title:'A', version:'2'}));
  run(['commit', '-qam', 'asset bump'], '2026-11-01T12:00:00+09:00');

  const now = new Date('2026-11-10T01:00:00+09:00');
  const first = lastmodTracker(root, {now});
  assert.equal(first('https://indiek.com/a/', page({title:'A', version:'3'})), '2026-10-20', 'asset-only commits keep the first content date');
  assert.equal(first('https://indiek.com/b/', page({title:'B', body:'Edited'})), '2026-11-10', 'changed content takes the build date');
  assert.equal(first('https://indiek.com/c/', page({title:'C'})), '2026-11-10', 'new pages take the build date');

  write('dist/sitemap.xml', sitemapXML([{url:'https://indiek.com/a/', lastmod:'2026-10-25'}, {url:'https://indiek.com/b/', lastmod:'2026-10-26'}]));
  run(['commit', '-qam', 'dates']);
  const second = lastmodTracker(root, {now});
  assert.equal(second('https://indiek.com/a/', page({title:'A'})), '2026-10-25', 'committed sitemap dates carry forward');
  assert.equal(second('https://indiek.com/b/', page({title:'B', body:'Edited'})), '2026-11-10');
});
