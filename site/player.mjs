export function createPlayer(root, {onChange = () => {}, doc = document} = {}) {
  const stage = root.querySelector('[data-player-stage]');
  const label = root.querySelector('[data-current-track]');
  let current = null;
  return {
    get current() { return current; },
    load(record) {
      if (!record || record.externalOnly) return;
      if (current?.id === record.id) {
        stage.querySelector('iframe')?.focus();
        return;
      }
      const frame = doc.createElement('iframe');
      frame.src = `https://www.youtube-nocookie.com/embed/${record.videoId}?playsinline=1`;
      frame.title = `${record.track} by ${record.artist} — ${record.channel}`;
      frame.allow = 'encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      label.textContent = `${record.track} · ${record.artist}`;
      label.href = `/artists/${record.id}/#listen`;
      current = record;
      root.hidden = false;
      // The stage stays in the document; only an explicit song change replaces its iframe.
      stage.replaceChildren(frame);
      onChange();
      frame.focus();
    },
    close() {
      stage.replaceChildren();
      root.hidden = true;
      current = null;
      onChange();
    },
  };
}
