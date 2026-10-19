// Load the official API only after the listener has agreed to load YouTube.
const apiRequests = new WeakMap();
export function loadYouTubeAPI({win = window, doc = document} = {}) {
  if (win.YT?.Player) return Promise.resolve(win.YT);
  if (apiRequests.has(win)) return apiRequests.get(win);
  const request = new Promise((resolve, reject) => {
    const previous = win.onYouTubeIframeAPIReady;
    const script = doc.createElement('script');
    const finish = error => {
      win.clearTimeout(timeout);
      if (win.onYouTubeIframeAPIReady === callback) win.onYouTubeIframeAPIReady = previous;
      if (error) { script.remove(); reject(error); }
      else resolve(win.YT);
    };
    const callback = () => { finish(); previous?.(); };
    const timeout = win.setTimeout(() => finish(new Error('YouTube API timed out')), 12000);
    win.onYouTubeIframeAPIReady = callback;
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => finish(new Error('YouTube API unavailable'));
    doc.head.append(script);
  });
  apiRequests.set(win, request);
  request.catch(() => apiRequests.delete(win));
  return request;
}

export function createPlayer(root, {onChange = () => {}, doc = document, win = window, loadAPI = loadYouTubeAPI} = {}) {
  const stage = root.querySelector('[data-player-stage]');
  const label = root.querySelector('[data-current-track]');
  let current = null, frame = null, embedded = null, ready = false, generation = 0;
  let readyTimer;
  let queue = [], autoNext = true, state = 'idle', played = false;
  function neighbor(offset) {
    const index = queue.findIndex(record => record.id === current?.id);
    return index < 0 ? null : queue[index + offset] || null;
  }
  function updateLabel() {
    label.textContent = `${current.track} · ${current.artist}`;
    label.href = `/artists/${current.id}/#listen`;
    frame.title = `${current.track} by ${current.artist} — ${current.channel}`;
  }
  function release() {
    generation++;
    win.clearTimeout(readyTimer);
    ready = false;
    embedded?.destroy();
    embedded = null;
    stage.replaceChildren();
    frame = null;
  }
  function load(record, {autoplay = false} = {}) {
    if (!record || record.externalOnly) return;
    if (current?.id === record.id) {
      if (autoplay && ready && ['ended','paused','blocked','ready'].includes(state)) embedded.playVideo();
      frame?.focus();
      return;
    }
    current = record;
    played = false;
    state = 'loading';
    root.hidden = false;
    if (ready) {
      updateLabel();
      onChange();
      if (autoplay) embedded.loadVideoById(record.videoId);
      else embedded.cueVideoById(record.videoId);
      return;
    }
    release();
    const token = generation;
    frame = doc.createElement('iframe');
    const params = new URLSearchParams({playsinline:'1',enablejsapi:'1',autoplay:autoplay?'1':'0',origin:win.location.origin});
    frame.src = `https://www.youtube-nocookie.com/embed/${record.videoId}?${params}`;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    updateLabel();
    stage.replaceChildren(frame);
    onChange();
    loadAPI({win, doc}).then(YT => {
      if (token !== generation || !current) return;
      readyTimer = win.setTimeout(() => {
        if (token !== generation || ready) return;
        state = 'unavailable';onChange();
      }, 12000);
      embedded = new YT.Player(frame, {events:{
        onReady(event) {
          if (token !== generation) return;
          win.clearTimeout(readyTimer);
          ready = true;
          state = 'ready';
          onChange();
          if (autoplay) event.target.playVideo();
        },
        onStateChange(event) {
          if (token !== generation) return;
          // Ignore an old video's late state notification during a song change.
          let videoId;
          try { videoId = new URL(event.target.getVideoUrl()).searchParams.get('v'); } catch { return; }
          if (videoId !== current?.videoId) return;
          if (event.data === 1) { played = true; state = 'playing'; }
          else if (event.data === 2) state = 'paused';
          else if (event.data === 3) state = 'loading';
          else if (event.data === 5) state = 'ready';
          else if (event.data === 0) {
            if (!played) return;
            played = false;
            state = 'ended';
            const next = neighbor(1);
            if (autoNext && next) { load(next, {autoplay:true}); return; }
          } else return;
          onChange();
        },
        onAutoplayBlocked() {
          if (token !== generation) return;
          state = 'blocked';onChange();
        },
        onError() {
          if (token !== generation) return;
          win.clearTimeout(readyTimer);
          played = false;state = 'error';onChange();
        },
      }});
    }).catch(() => {
      if (token !== generation) return;
      win.clearTimeout(readyTimer);
      state = 'unavailable';onChange();
    });
  }
  return {
    get current() { return current; },
    get state() { return state; },
    get ready() { return ready; },
    get autoNext() { return autoNext; },
    get next() { return neighbor(1); },
    get previous() { return neighbor(-1); },
    setQueue(records) { queue = records.filter(record => !record.externalOnly); onChange(); },
    setAutoNext(value) { autoNext = Boolean(value); onChange(); },
    nextTrack() { if (ready && neighbor(1)) load(neighbor(1), {autoplay:true}); },
    previousTrack() { if (ready && neighbor(-1)) load(neighbor(-1), {autoplay:true}); },
    load,
    close() {
      release();
      root.hidden = true;
      current = null;played = false;state = 'idle';
      onChange();
    },
  };
}
