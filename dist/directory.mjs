import {getArtistDirectory} from './shared.mjs';

// The state lives with the app so a visit to an artist and Back keeps the filter.
export function initArtistDirectory(catalogue, state, doc = document) {
  const root = doc.querySelector('[data-artist-directory]');
  if (!root) return;
  const input = root.querySelector('#artist-query');
  const filters = [...root.querySelectorAll('[data-directory-filter]')];
  const cards = [...root.querySelectorAll('[data-directory-artist]')];
  const count = root.querySelector('#artist-result-count');
  const empty = root.querySelector('#artist-empty');
  const reset = root.querySelector('[data-directory-reset]');

  function render() {
    const ids = new Set(getArtistDirectory(catalogue, state).map(record => record.id));
    cards.forEach(card => { card.hidden = !ids.has(card.dataset.directoryArtist); });
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.directoryFilter === state.category)));
    count.textContent = `${ids.size === cards.length ? ids.size : `${ids.size} of ${cards.length}`} ${cards.length === 1 ? 'artist' : 'artists'} · A–Z`;
    empty.hidden = ids.size > 0;
    reset.hidden = !state.query && state.category === 'all';
  }
  function search() { state.query = input.value; render(); }
  function finishSearch(event) {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    input.blur();
    count.focus({preventScroll:true});
  }
  function click(event) {
    const button = event.target.closest('button');
    if (button?.hasAttribute('data-directory-filter')) {
      state.category = button.dataset.directoryFilter;
      render();
    } else if (button?.hasAttribute('data-directory-reset')) {
      state.query = input.value = '';
      state.category = 'all';
      render();
      input.focus();
    }
  }
  input.value = state.query;
  input.addEventListener('input', search);
  input.addEventListener('keydown', finishSearch);
  root.addEventListener('click', click);
  render();
  return () => {
    input.removeEventListener('input', search);
    input.removeEventListener('keydown', finishSearch);
    root.removeEventListener('click', click);
  };
}
