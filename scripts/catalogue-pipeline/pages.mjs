// Source pages fetched by the pipeline itself, with the same fetcher the literal evidence check
// uses. Text is passed to the writer and reviewers in the prompt only and never saved, so lyric
// pages are read for commentary without collecting the lyrics.
import {publicRequest, plain} from '../promotion/news.mjs';

export const PAGE_LIMIT = 12000;
export async function fetchPages(urls, request = publicRequest, {limit = 4} = {}) {
  const queue = [...new Set(urls.filter(url => /^https:\/\//.test(url || '')))], pages = {};
  await Promise.all(Array.from({length:Math.min(limit, queue.length)}, async () => {
    while (queue.length) {
      const url = queue.shift();
      try {
        const response = await request(url);
        const text = plain(response.body || '');
        pages[url] = (response.status ?? 200) < 400 && text.length > 200 ? {ok:true, text:text.slice(0, PAGE_LIMIT)} : {ok:false, reason:`HTTP ${response.status ?? '?'} or empty page`};
      } catch (error) { pages[url] = {ok:false, reason:error.message}; }
    }
  }));
  return pages;
}
export const pageSummary = pages => Object.fromEntries(Object.entries(pages).map(([url, page]) => [url, page.ok ? {ok:true, chars:page.text.length} : page]));
export const pageText = pages => Object.fromEntries(Object.entries(pages).map(([url, page]) => [url, page.ok ? page.text : `UNAVAILABLE to the pipeline fetcher: ${page.reason}`]));
export function dossierURLs(dossier) {
  const urls = [...dossier.artist.profileSources.map(s => s.url), ...dossier.artist.facts.map(f => f.sourceURL)];
  for (const t of dossier.tracks) urls.push(t.creditsSource?.url, t.lyricSource?.url, ...t.backgroundSources.map(s => s.url), ...t.facts.map(f => f.sourceURL));
  return urls.filter(url => url && !/^https:\/\/(www\.)?(youtube\.com|youtu\.be|music\.apple\.com)\//.test(url));
}
