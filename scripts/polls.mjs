// Listener poll pages come from content/polls.json, the same file the participation API reads.
// The API owns voting rules; the build checks what the page needs and keeps drafts out of public builds.
const statuses = ['draft', 'published', 'closed'];
export const pollPath = poll => `/polls/${poll.id}/`;

export function validatePolls(file, tracks) {
  if (file?.schemaVersion !== 1 || !Array.isArray(file.polls)) throw new Error('content/polls.json needs schemaVersion 1 and a polls list');
  const ids = new Set(tracks.map(track => track.id));
  const seen = new Set();
  return file.polls.map(poll => {
    const fail = message => { throw new Error(`Poll ${poll.id}: ${message}`); };
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(poll.id || '') || poll.id.length > 80) fail('invalid id');
    if (seen.has(poll.id)) fail('duplicate id');
    seen.add(poll.id);
    if (!statuses.includes(poll.status)) fail(`status must be ${statuses.join(', ')}`);
    const opens = Date.parse(poll.opensAt), closes = Date.parse(poll.closesAt);
    if (!/[+-]\d\d:\d\d$|Z$/.test(poll.opensAt || '') || !/[+-]\d\d:\d\d$|Z$/.test(poll.closesAt || '') || !(closes > opens)) fail('opensAt/closesAt must be RFC 3339 times with an offset, closing after opening');
    // Pages exist only for song polls so far; an artist poll needs its own template first.
    if (poll.choiceKind !== 'track') fail('only choiceKind "track" has a page');
    const choices = poll.choiceIds ?? [...ids];
    if (!Array.isArray(choices) || new Set(choices).size !== choices.length || choices.some(id => !ids.has(id))) fail('choiceIds must be distinct catalogue track IDs');
    if (!Number.isInteger(poll.maxChoices) || poll.maxChoices < 1 || poll.maxChoices > Math.min(10, choices.length)) fail('maxChoices must be 1–10 and no more than the choices');
    if (!['after-close', 'live', undefined].includes(poll.resultsVisibility)) fail('resultsVisibility must be after-close or live');
    for (const field of ['title', 'description', 'intro']) if (typeof poll[field] !== 'string' || !poll[field].trim()) fail(`missing ${field}`);
    return {...poll, resultsVisibility:poll.resultsVisibility || 'after-close', choiceIds:choices};
  });
}
