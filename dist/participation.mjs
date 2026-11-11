// Listener polls and reader requests call the optional participation API under /api/.
// Pages, playback and Saved never wait for it: voting and request controls appear only after
// the API answers, and any failure leaves the page as a plain listening page with a short note.
export const pollStorageKey = 'indiek-polls-v1';
export const requestTextLimit = 140;
const readTimeout = 6000;
const writeTimeout = 10000;
const numberWords = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const countWord = n => numberWords[n] || String(n);

// At least 128 random bits as base64url, the format the API accepts (22–64 characters).
export function createToken(random = globalThis.crypto) {
  const bytes = new Uint8Array(18);
  random.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export const validToken = value => typeof value === 'string' && /^[A-Za-z0-9_-]{22,64}$/.test(value);

// Stored per poll: the random voting code and whether this browser has voted. Nothing else.
export function readBallots(value) {
  try {
    const data = JSON.parse(value || '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data)
      .filter(([id, entry]) => /^[a-z0-9-]{1,80}$/.test(id) && validToken(entry?.token))
      .map(([id, entry]) => [id, {token:entry.token, voted:entry.voted === true}]));
  } catch { return {}; }
}

// Mirrors the API's checks (api/src/validate.rs) so most problems are explained before sending.
export const normalizeRequestText = text => String(text ?? '').split(/\s+/).filter(Boolean).join(' ');
export const requestTextLength = text => [...normalizeRequestText(text)].length;
function looksLikeEmail(text) {
  return text.split(' ').some(word => {
    const at = word.indexOf('@');
    if (at < 0) return false;
    const domain = word.slice(at + 1), dot = domain.indexOf('.');
    return /[\p{Alphabetic}\p{N}]/u.test(word.slice(0, at)) && dot > 0 && /\p{Alphabetic}/u.test(domain.slice(dot + 1));
  });
}
function hasPhoneNumber(text) {
  let digits = 0;
  for (const char of text) {
    if (char >= '0' && char <= '9') { if (++digits >= 9) return true; }
    else if (!' -.()+'.includes(char)) digits = 0;
  }
  return false;
}
export function requestTextProblem(text) {
  const clean = normalizeRequestText(text);
  if (!clean) return null;
  if ([...clean].length > requestTextLimit) return 'text_too_long';
  if (/[\p{Cc}‪-‮⁦-⁩‎‏﻿]/u.test(clean)) return 'text_invalid_characters';
  const lower = clean.toLowerCase();
  if (lower.includes('://') || lower.includes('www.')) return 'text_has_link';
  if (looksLikeEmail(clean) || hasPhoneNumber(clean)) return 'text_has_contact';
  return null;
}

// The page's own dates decide what to say when the API cannot be reached.
export function pollPhase({opensAt, closesAt, status}, now = Date.now()) {
  if (status === 'closed' || now >= Date.parse(closesAt)) return 'closed';
  return now < Date.parse(opensAt) ? 'upcoming' : 'open';
}

// Equal counts share a rank; `order` (catalogue order) breaks ties for display only.
export function rankResults(results, ballots, order) {
  const rows = (Array.isArray(results) ? results : [])
    .filter(row => order.has(row?.id) && Number.isInteger(row.votes) && row.votes > 0)
    .sort((a, b) => b.votes - a.votes || order.get(a.id) - order.get(b.id));
  let rank = 0, previous = null;
  return rows.map((row, i) => {
    if (row.votes !== previous) { rank = i + 1; previous = row.votes; }
    return {id:row.id, votes:row.votes, rank, share:ballots > 0 ? Math.min(1, row.votes / ballots) : 0};
  });
}

const seoul = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Seoul', day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
const parts = (format, date) => Object.fromEntries(format.formatToParts(date).map(part => [part.type, part.value]));
// "10 December 2026, 12:00 KST"
export function kstLabel(iso) {
  const p = parts(seoul, new Date(iso));
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute} KST`;
}
// The reader's own clock, shown beside KST times; empty when the reader is in Korea time.
export function localTimeLabel(iso, timeZone) {
  try {
    timeZone ||= new Intl.DateTimeFormat().resolvedOptions().timeZone;
    const date = new Date(iso);
    const local = new Intl.DateTimeFormat('en-GB', {timeZone, day:'numeric', month:'long', hour:'2-digit', minute:'2-digit', hourCycle:'h23', timeZoneName:'short'});
    const p = parts(local, date), k = parts(seoul, date);
    if (p.day === k.day && p.hour === k.hour && p.minute === k.minute) return '';
    return `${p.day} ${p.month}, ${p.hour}:${p.minute} ${p.timeZoneName}`;
  } catch { return ''; }
}

export async function callAPI(path, {method = 'GET', body, timeout = readTimeout, signal, fetchImpl = globalThis.fetch} = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, {once:true});
  const timer = setTimeout(abort, timeout);
  try {
    const response = await fetchImpl(path, {
      method, signal:controller.signal, credentials:'omit',
      headers:body ? {'Content-Type':'application/json', Accept:'application/json'} : {Accept:'application/json'},
      body:body ? JSON.stringify(body) : undefined,
    });
    const json = (response.headers.get('content-type') || '').includes('application/json');
    const data = json ? await response.json().catch(() => null) : null;
    return {ok:response.ok, status:response.status, data, error:response.ok ? null : data?.error || 'unavailable'};
  } catch {
    return {ok:false, status:0, data:null, error:signal?.aborted ? 'aborted' : 'unavailable'};
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

// Without browser storage the code lives only in this page session (it survives internal navigation).
const memoryBallots = {};
function loadBallot(win, id) {
  try {
    const stored = readBallots(win.localStorage.getItem(pollStorageKey))[id];
    if (stored) return stored;
  } catch { /* Storage unavailable. */ }
  return memoryBallots[id] || null;
}
function saveBallot(win, id, entry) {
  try {
    const all = readBallots(win.localStorage.getItem(pollStorageKey));
    all[id] = entry;
    win.localStorage.setItem(pollStorageKey, JSON.stringify(all));
    delete memoryBallots[id];
    return true;
  } catch {
    memoryBallots[id] = entry;
    return false;
  }
}

const listWords = items => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

export function initPoll({doc = document, win = window, fetchImpl = globalThis.fetch, now = () => Date.now()} = {}) {
  const root = doc.querySelector('[data-poll]');
  if (!root) return;
  const poll = {id:root.dataset.poll, opensAt:root.dataset.pollOpens, closesAt:root.dataset.pollCloses, status:root.dataset.pollStatus, max:Number(root.dataset.pollMax)};
  const endpoint = `/api/polls/${encodeURIComponent(poll.id)}`;
  // The song list sits outside the form (its play and save buttons are not submit buttons);
  // each checkbox joins the form through its form attribute.
  const form = root.querySelector('[data-poll-form]');
  const songList = root.querySelector('[data-poll-ballot]');
  const inputs = [...root.querySelectorAll('[data-poll-input]')];
  const choices = new Map([...root.querySelectorAll('[data-poll-choice]')].map((row, i) => [row.dataset.pollChoice, {row, index:i}]));
  const order = new Map([...choices].map(([id, choice]) => [id, choice.index]));
  const status = root.querySelector('[data-poll-status-text]');
  const retry = root.querySelector('[data-poll-retry]');
  const count = root.querySelector('[data-poll-count]');
  const actions = root.querySelector('[data-poll-actions]');
  const submit = root.querySelector('[data-poll-submit]');
  const message = root.querySelector('[data-poll-message]');
  const results = root.querySelector('[data-poll-results]');
  const controller = new AbortController();
  let open = false, sending = false, attempted = false, liveResults = false;
  const closes = kstLabel(poll.closesAt), opens = kstLabel(poll.opensAt);
  const titleOf = id => choices.get(id)?.row.dataset.pollTitle || id;
  // Polls with live results show counts while open; the approved default publishes them after closing.
  const resultsNote = () => liveResults ? 'The results so far are shown above.' : `Results will be published here after voting closes on ${closes}.`;

  root.querySelectorAll('[data-local-time]').forEach(el => {
    const label = localTimeLabel(el.dataset.localTime);
    el.textContent = label ? ` · ${label} your time` : '';
  });

  function setBallot(enabled) {
    open = enabled;
    root.classList.toggle('is-voting', enabled);
    inputs.forEach(input => { input.hidden = !enabled; input.disabled = !enabled; if (!enabled) input.checked = false; });
    if (!enabled) choices.forEach(({row}) => row.classList.remove('is-chosen'));
    actions.hidden = !enabled;
    count.hidden = !enabled;
    if (enabled) syncCount();
  }
  function syncCount() {
    const chosen = inputs.filter(input => input.checked).length;
    const full = chosen >= poll.max;
    inputs.forEach(input => {
      input.disabled = !open || sending || (full && !input.checked);
      choices.get(input.value)?.row.classList.toggle('is-chosen', input.checked);
    });
    count.textContent = `${chosen} of ${poll.max} chosen${full ? '. Untick a song to change your picks.' : '.'}`;
    submit.disabled = sending || !chosen;
  }
  function say(text, {retryable = false} = {}) {
    status.textContent = text;
    retry.hidden = !retryable;
  }
  function showResults(data) {
    const rows = rankResults(data.results, data.ballots, order);
    const list = results.querySelector('[data-poll-result-rows]');
    const total = Number.isInteger(data.ballots) ? data.ballots : 0;
    results.querySelector('[data-poll-ballots]').textContent = `${total.toLocaleString('en-GB')} ${total === 1 ? 'ballot' : 'ballots'}${data.state === 'closed' ? ', final count' : ' so far'}. Percentages show the share of ballots that included each song.`;
    list.replaceChildren(...rows.map(row => {
      const choice = choices.get(row.id).row;
      const item = doc.createElement('li');
      item.className = 'poll-result';
      const rank = doc.createElement('span');
      rank.className = 'poll-rank mono';
      rank.textContent = String(row.rank).padStart(2, '0');
      const link = doc.createElement('a');
      link.href = choice.querySelector('[data-poll-link]').getAttribute('href');
      link.append(doc.createElement('strong'), doc.createElement('span'));
      link.firstChild.textContent = choice.dataset.pollTitle;
      link.lastChild.textContent = choice.dataset.pollArtist;
      const votes = doc.createElement('span');
      votes.className = 'poll-votes';
      const percent = Math.round(row.share * 100);
      votes.textContent = `${row.votes.toLocaleString('en-GB')} ${row.votes === 1 ? 'vote' : 'votes'} · ${percent}%`;
      const bar = doc.createElement('span');
      bar.className = 'poll-bar';
      bar.setAttribute('aria-hidden', 'true');
      bar.append(doc.createElement('span'));
      bar.firstChild.style.width = `${Math.max(percent, 1)}%`;
      item.append(rank, link, votes, bar);
      return item;
    }));
    results.querySelector('[data-poll-empty]').hidden = rows.length > 0;
    results.hidden = false;
  }
  function render(data) {
    const ballot = loadBallot(win, poll.id);
    results.hidden = true;
    liveResults = Boolean(data.results) && data.state === 'open';
    if (data.results) showResults(data);
    if (data.state === 'upcoming') {
      setBallot(false);
      say(`Voting opens ${opens}. Every song below can be played in the meantime.`);
    } else if (data.state === 'open' && ballot?.voted) {
      setBallot(false);
      say(`This browser has already voted. ${resultsNote()}`);
    } else if (data.state === 'open') {
      if (!open) setBallot(true);
      say(`Voting is open until ${closes}. Choose up to ${countWord(poll.max)} songs, then send your picks.`);
    } else {
      setBallot(false);
      // A poll stopped early has closed before its scheduled time.
      const closed = now() < Date.parse(poll.closesAt) ? 'Voting has closed.' : `Voting closed on ${closes}.`;
      say(`${closed} ${data.results ? 'Here are the results.' : 'Results will appear here soon.'}`);
    }
  }
  function unavailable() {
    setBallot(false);
    results.hidden = true;
    const phase = pollPhase(poll, now());
    if (phase === 'upcoming') say(`Voting opens ${opens}.`);
    else if (phase === 'open' && loadBallot(win, poll.id)?.voted) say(`This browser has already voted. Results will be published here after voting closes on ${closes}.`);
    else if (phase === 'open') say('Voting isn’t available right now. Please try again later.', {retryable:true});
    else say('The results aren’t available right now. Please try again later.', {retryable:true});
  }
  async function refresh() {
    retry.hidden = true;
    root.setAttribute('aria-busy', 'true');
    const response = await callAPI(`${endpoint}/results`, {signal:controller.signal, fetchImpl});
    if (controller.signal.aborted) return;
    root.removeAttribute('aria-busy');
    const valid = response.ok && ['upcoming', 'open', 'closed'].includes(response.data?.state);
    if (valid) render(response.data);
    else unavailable();
  }
  const failures = {
    invalid_choice_count: () => `Choose between one and ${countWord(poll.max)} songs.`,
    duplicate_choice: () => `Choose between one and ${countWord(poll.max)} songs.`,
    unknown_choice: () => 'One of these songs can’t be chosen right now. Reload the page and try again.',
    rate_limited: () => 'Too many attempts from this connection. Please try again in a few minutes.',
    invalid_token: () => 'Your vote didn’t go through. Reload the page and try again.',
  };
  async function vote(event) {
    event.preventDefault();
    if (!open || sending) return;
    const picks = inputs.filter(input => input.checked).map(input => input.value);
    if (!picks.length || picks.length > poll.max) { message.textContent = failures.invalid_choice_count(); return; }
    const stored = loadBallot(win, poll.id);
    const token = stored?.token || createToken(win.crypto);
    const persisted = saveBallot(win, poll.id, {token, voted:false});
    sending = true; syncCount();
    message.textContent = 'Sending your picks…';
    const response = await callAPI(`${endpoint}/votes`, {method:'POST', body:{token, choices:picks}, timeout:writeTimeout, signal:controller.signal, fetchImpl});
    if (controller.signal.aborted) return;
    sending = false;
    const wasAttempted = attempted;
    attempted = true;
    if (response.ok || response.error === 'already_voted') {
      saveBallot(win, poll.id, {token, voted:true});
      setBallot(false);
      message.textContent = '';
      const thanks = response.ok || wasAttempted
        ? `Thank you. Your ${picks.length === 1 ? 'pick was' : 'picks were'} recorded: ${listWords(picks.map(titleOf))}.`
        : 'This browser has already voted in this poll.';
      say(`${thanks} ${resultsNote()}${persisted ? '' : ' This browser couldn’t store its voting code, so it won’t remember this vote after you reload or leave the site.'}`);
      status.focus({preventScroll:true});
      status.scrollIntoView?.({block:'nearest'});
    } else if (['poll_closed', 'poll_not_open', 'unknown_poll'].includes(response.error)) {
      message.textContent = '';
      await refresh();
    } else {
      syncCount();
      message.textContent = failures[response.error]?.() || 'Your picks didn’t go through. They are still selected; please try again in a moment.';
    }
  }
  songList.addEventListener('change', syncCount);
  form.addEventListener('submit', vote);
  retry.addEventListener('click', refresh);
  refresh();
  return () => {
    controller.abort();
    songList.removeEventListener('change', syncCount);
    form.removeEventListener('submit', vote);
    retry.removeEventListener('click', refresh);
  };
}

const requestErrors = {
  song_or_text_required: 'Choose a song or write its name.',
  artist_or_text_required: 'Choose an artist or write their name.',
  text_empty: 'Write a short note, or choose from the list.',
  text_too_long: `Keep the note to ${requestTextLimit} characters.`,
  text_has_link: 'Please remove the link and name the song or artist instead.',
  text_has_contact: 'Please remove the email address or phone number. Requests can’t be answered, so no contact details are needed.',
  text_invalid_characters: 'Please remove the special formatting characters from the note.',
  unknown_track: 'That song isn’t available. Reload the page and try again.',
  unknown_artist: 'That artist isn’t available. Reload the page and try again.',
  rate_limited: 'Too many requests from this connection. Please try again in a few minutes.',
};

export function initRequestForm({doc = document, win = window, fetchImpl = globalThis.fetch} = {}) {
  const root = doc.querySelector('[data-request-page]');
  if (!root) return;
  const form = root.querySelector('[data-request-form]');
  const status = root.querySelector('[data-request-status]');
  const retry = root.querySelector('[data-request-retry]');
  const done = root.querySelector('[data-request-done]');
  const again = root.querySelector('[data-request-again]');
  const message = root.querySelector('[data-request-message]');
  const text = form.querySelector('#request-text');
  const counter = form.querySelector('[data-request-count]');
  const hint = form.querySelector('[data-request-hint]');
  const submit = form.querySelector('[type="submit"]');
  const selects = {song:form.querySelector('#request-track'), artist:form.querySelector('#request-artist')};
  const controller = new AbortController();
  let sending = false;
  root.querySelector('[data-request-fallback]').hidden = true;

  const kind = () => form.querySelector('input[name="type"]:checked').value;
  function syncKind() {
    const current = kind();
    form.querySelectorAll('[data-request-for]').forEach(field => { field.hidden = field.dataset.requestFor !== current; });
    hint.textContent = current === 'song'
      ? `Name the song and artist if it isn’t in the list, or say what you’d like to know. Up to ${requestTextLimit} characters.`
      : `Name the artist if they aren’t in the list, or say what you’d like to know. Up to ${requestTextLimit} characters.`;
  }
  function syncCount() {
    if (!sending) message.textContent = '';
    const length = requestTextLength(text.value);
    counter.textContent = `${length} / ${requestTextLimit}`;
    counter.classList.toggle('is-over', length > requestTextLimit);
  }
  function preselect() {
    const params = new URLSearchParams(win.location.search);
    for (const [type, select] of Object.entries(selects)) {
      const id = params.get(type === 'song' ? 'track' : 'artist');
      if (id && [...select.options].some(option => option.value === id)) {
        form.querySelector(`input[name="type"][value="${type}"]`).checked = true;
        select.value = id;
      }
    }
  }
  function setAvailable(available) {
    form.hidden = !available;
    status.hidden = available;
    retry.hidden = available;
    if (!available) status.textContent = 'Requests can’t be sent right now. Please try again later.';
  }
  async function probe() {
    retry.hidden = true;
    status.hidden = false;
    status.textContent = 'Opening the request form…';
    const response = await callAPI('/api/health', {signal:controller.signal, fetchImpl});
    if (controller.signal.aborted) return;
    setAvailable(response.ok && response.data?.status === 'ok');
  }
  async function send(event) {
    event.preventDefault();
    if (sending) return;
    const type = kind();
    const selected = selects[type].value;
    const note = normalizeRequestText(text.value);
    const problem = !selected && !note ? `${type}_or_text_required` : requestTextProblem(note);
    if (problem) {
      message.textContent = requestErrors[problem];
      (problem.endsWith('_required') && !note ? selects[type] : text).focus();
      return;
    }
    const body = {type, ...(selected ? {[type === 'song' ? 'trackId' : 'artistId']:selected} : {}), ...(note ? {text:note} : {})};
    sending = true; submit.disabled = true;
    message.textContent = 'Sending your request…';
    const response = await callAPI('/api/requests', {method:'POST', body, timeout:writeTimeout, signal:controller.signal, fetchImpl});
    if (controller.signal.aborted) return;
    sending = false; submit.disabled = false;
    if (response.ok) {
      message.textContent = '';
      form.hidden = true;
      done.hidden = false;
      done.querySelector('[data-request-done-title]').focus({preventScroll:true});
    } else {
      message.textContent = requestErrors[response.error] || 'Your request didn’t go through. Your note is still here; please try again in a moment.';
    }
  }
  function reset() {
    form.reset();
    preselect();
    syncKind(); syncCount();
    message.textContent = '';
    done.hidden = true;
    form.hidden = false;
    form.querySelector('input[name="type"]:checked').focus();
  }
  preselect(); syncKind(); syncCount();
  function edited() { syncKind(); if (!sending) message.textContent = ''; }
  form.addEventListener('change', edited);
  form.addEventListener('submit', send);
  text.addEventListener('input', syncCount);
  retry.addEventListener('click', probe);
  again.addEventListener('click', reset);
  probe();
  return () => {
    controller.abort();
    form.removeEventListener('change', edited);
    form.removeEventListener('submit', send);
    text.removeEventListener('input', syncCount);
    retry.removeEventListener('click', probe);
    again.removeEventListener('click', reset);
  };
}
