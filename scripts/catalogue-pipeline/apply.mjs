// Local apply step for reviewed entries: release artwork with its rights record, the artist and
// tracks in content/catalogue.json, and a ledger entry that the checks hold the catalogue to.
// It does not commit, push or deploy.
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createCatalogue} from '../catalogue.mjs';
import {digest} from '../editorial/content.mjs';
import {atomicWrite,readJSON} from '../promotion/core.mjs';
import {koreanDay} from '../promotion/news.mjs';
import {verifyPlayback} from './playback.mjs';
import {citedSources,entryHash} from './entries.mjs';

const json = value => JSON.stringify(value, null, 2) + '\n';

// A reproducible sample for human review: the lowest hashes, at least one per batch.
export function humanSample(trackIds, rate) {
  const count = Math.max(1, Math.ceil(trackIds.length * rate));
  return new Set([...trackIds].sort((a, b) => digest(a).localeCompare(digest(b))).slice(0, count));
}

export function rightsEntry({file, artist, release, day}) {
  return {file, label:`${artist} — ${release.collectionName} artwork`, source:release.collectionURL, original:release.artwork, credit:'Apple Music release artwork', language:'English', status:'unconfirmed', checked:day,
    notes:'Release artwork used to identify the selected recording. No reuse licence established; source credit does not establish permission.'};
}

export async function applyApproved({root, state, config, files, batch, deps = {}}) {
  const day = koreanDay(new Date());
  const batchFile = path.join(state, 'batches', `${batch}.json`);
  const data = readJSON(batchFile, null);
  if (!data) throw new Error(`No prepared batch ${batch}`);
  const ready = Object.values(data.units).filter(u => u.status === 'approved');
  if (!ready.length) throw new Error(`Nothing approved in ${batch}`);
  const candidatesData = readJSON(files.candidates, {candidates:[]});
  const source = JSON.parse(readFileSync(path.join(root, 'content/catalogue.json'), 'utf8'));
  const rights = JSON.parse(readFileSync(path.join(root, 'content/image-rights.json'), 'utf8'));
  const ledger = readJSON(files.ledger, {schemaVersion:1, description:'Catalogue entries added by the expansion pipeline. Each track records the exact reviewed content hash, sources and playback check; scripts/catalogue-pipeline.test.mjs fails if the catalogue drifts from it.', artists:{}, tracks:{}});
  const playback = deps.playback || verifyPlayback;
  const download = deps.download || (async (url, file) => {
    const response = await fetch(url, {signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`Artwork ${response.status}: ${url}`);
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  });
  const added = [];
  for (const unit of ready) {
    const {entries, review} = unit.approved;
    const candidate = candidatesData.candidates.find(c => c.id === unit.artistId);
    if (!candidate || candidate.batch !== batch || candidate.status !== 'approved') throw new Error(`${unit.artistId} is not an approved candidate of ${batch}`);
    if (entries.artist && source.artists.some(a => a.id === entries.artist.id)) throw new Error(`Artist ${entries.artist.id} already exists`);
    for (const t of entries.tracks) {
      if (source.tracks.some(x => x.id === t.entry.id)) throw new Error(`Track ${t.entry.id} already exists`);
      if (review.hashes[t.entry.id] !== entryHash(entries.artist, t.entry)) throw new Error(`${t.entry.id} changed after review`);
    }
    // Playback is checked again right before the entry enters the catalogue.
    const fresh = await playback(entries.tracks.map(t => t.entry.videoId), config.playback);
    const failed = entries.tracks.filter(t => !fresh[t.entry.videoId]?.playing);
    if (failed.length) throw new Error(`Playback no longer works for ${failed.map(t => t.entry.id).join(', ')}; prepare again`);
    for (const t of entries.tracks) {
      const target = path.join(root, 'dist/assets', t.entry.image);
      if (!rights.images.some(i => i.file === t.entry.image)) {
        if (!existsSync(target)) await download(t.release.artwork, target);
        rights.images.push(rightsEntry({file:t.entry.image, artist:t.release.artistName, release:t.release, day}));
      }
    }
    if (entries.artist) source.artists.push(entries.artist);
    source.tracks.push(...entries.tracks.map(t => t.entry));
    createCatalogue(structuredClone(source));
    if (entries.artist) ledger.artists[entries.artist.id] = {artistId:entries.artist.id, batch, addedAt:day, candidate:{score:candidate.score, rank:candidate.rank, approved:candidate.approved, signals:candidate.signals.map(s => ({type:s.type, url:s.url}))}};
    for (const t of entries.tracks) {
      ledger.tracks[t.entry.id] = {trackId:t.entry.id, artistId:t.entry.artistId, batch, grade:t.grade, role:t.role, addedAt:day,
        contentHash:review.hashes[t.entry.id], skillRevision:review.skillRevision, reviewedAt:review.checkedAt,
        sources:citedSources({artist:entries.artist, tracks:[t]}),
        release:{appleMusic:t.release.collectionURL, trackName:t.release.trackName, releaseDate:t.release.releaseDate, checkedAt:t.release.checkedAt},
        playback:{...review.playback[t.entry.id], recheckedAt:fresh[t.entry.videoId].checkedAt, advancedSeconds:fresh[t.entry.videoId].advancedSeconds},
        facts:review.facts, editorial:review.editorial};
      added.push(t.entry.id);
    }
    Object.assign(candidate, {status:'added', added:{date:day, trackIds:entries.tracks.map(t => t.entry.id)}});
    unit.status = 'applied';
  }
  const sample = humanSample(added, config.humanSampleRate);
  for (const id of added) if (sample.has(id)) Object.assign(ledger.tracks[id], {humanSample:true, humanReview:{status:'pending'}});
  writeFileSync(path.join(root, 'content/catalogue.json'), json(source));
  writeFileSync(path.join(root, 'content/image-rights.json'), json(rights));
  atomicWrite(files.ledger, json(ledger));
  atomicWrite(files.candidates, json(candidatesData));
  atomicWrite(batchFile, json(data));
  (deps.images || (() => execFileSync('python3', [path.join(root, 'scripts/prepare-images.py')], {cwd:root, stdio:'inherit'})))();
  console.log(`Added ${added.length} tracks: ${added.join(', ')}. Human review sample: ${[...sample].join(', ')}.\nNext: npm run build && npm run check, then review the pages on desktop and mobile.`);
  return {added, sample:[...sample]};
}
