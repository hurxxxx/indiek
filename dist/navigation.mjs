import {mobilePlayerQuery} from './mobile.mjs';

// Keep the document (and its YouTube iframe) alive while replacing static page content.
export function internalPageURL(link, current, event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  if (link.hasAttribute('download') || link.hasAttribute('data-native-navigation') || (link.target && link.target !== '_self')) return null;
  const url = new URL(link.href, current);
  if (url.origin !== new URL(current).origin || !['http:', 'https:'].includes(url.protocol)) return null;
  // Generated pages use directory URLs. Assets and other downloads keep native behavior.
  return url.pathname.endsWith('/') ? url : null;
}

// The mobile dock reserves its own space; keep reading positions when changing scroll surfaces.
export function createPageScroll({win = window, doc = document} = {}) {
  const page = doc.querySelector('#page-content');
  const mobile = win.matchMedia(mobilePlayerQuery);
  let compact = false, docked = false;
  const position = () => docked ? [page.scrollLeft, page.scrollTop] : [win.scrollX, win.scrollY];
  function to([left, top]) {
    (docked ? page : win).scrollTo({left, top, behavior:'instant'});
  }
  function sync() {
    const next = compact && mobile.matches;
    if (next === docked) return;
    const saved = position();
    docked = next;
    doc.documentElement.classList.toggle('has-mobile-player', docked);
    to(saved);
  }
  mobile.addEventListener('change', sync);
  return {
    position, to,
    setCompact(value) { compact = value; sync(); },
    onScroll(listener) {
      win.addEventListener('scroll', listener, {passive:true});
      page.addEventListener('scroll', listener, {passive:true});
    },
  };
}

export function initNavigation({beforeSwap, afterSwap, onNavigate, onError, closeDialog = () => document.querySelector('#content-dialog')?.close(), scroll = createPageScroll()}) {
  let renderedURL = new URL(location.href), pending, sequence = 0;
  const positions = new Map();
  let entry = history.state?.indiekEntry || 0;
  let nextEntry = entry;
  history.replaceState({...history.state, indiekEntry: entry}, '', location.href);
  history.scrollRestoration = 'manual';
  const savePosition = () => positions.set(entry, scroll.position());
  scroll.onScroll(savePosition);

  function focusPage(url, position) {
    let target;
    try { target = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch { /* Invalid fragment. */ }
    target ||= document.querySelector('#main');
    target.setAttribute('tabindex', '-1');
    target.focus({preventScroll:true});
    if (position) scroll.to(position);
    else if (url.hash && target.id !== 'main') target.scrollIntoView({behavior:'instant'});
    else scroll.to([0,0]);
    savePosition();
  }

  async function navigate(url, {pop = false, position} = {}) {
    const request = ++sequence;
    pending?.abort();
    const controller = pending = new AbortController();
    const previous = renderedURL;
    const samePage = url.pathname === previous.pathname && url.search === previous.search;
    document.querySelector('#main').setAttribute('aria-busy', 'true');
    try {
      let incoming;
      if (!samePage) {
        const response = await fetch(url.pathname + url.search, {signal:controller.signal});
        if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Page unavailable');
        incoming = new DOMParser().parseFromString(await response.text(), 'text/html');
        if (!incoming.querySelector('main#main') || !incoming.querySelector('#persistent-player')) throw new Error('Not a journal page');
      }
      if (request !== sequence) return;
      closeDialog();
      if (!pop && url.href !== location.href) {
        savePosition();
        entry = ++nextEntry;
        history.pushState({indiekEntry:entry}, '', url.href);
      }
      if (incoming) {
        beforeSwap();
        document.querySelector('#main').replaceWith(incoming.querySelector('#main'));
        document.body.className = incoming.body.className;
        document.title = incoming.title;
        for (const selector of ['meta[name="description"]', 'link[rel="canonical"]', 'meta[property^="og:"]', 'meta[name^="twitter:"]', 'script[type="application/ld+json"]']) {
          document.head.querySelectorAll(selector).forEach(node => node.remove());
          incoming.head.querySelectorAll(selector).forEach(node => document.head.append(node.cloneNode(true)));
        }
        afterSwap();
      }
      renderedURL = new URL(url);
      focusPage(url, position);
      if (!samePage) onNavigate(previous.href);
    } catch (error) {
      if (error.name !== 'AbortError' && request === sequence) {
        // Keep the player running even when a page cannot be fetched.
        if (pop) history.replaceState({...history.state, indiekEntry:entry}, '', previous.href);
        onError();
      }
    } finally {
      if (request === sequence) document.querySelector('#main').removeAttribute('aria-busy');
    }
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const url = internalPageURL(link, location.href, event);
    if (!url) return;
    event.preventDefault();
    navigate(url);
  });
  window.addEventListener('popstate', event => {
    entry = event.state?.indiekEntry ?? ++nextEntry;
    nextEntry = Math.max(nextEntry, entry);
    navigate(new URL(location.href), {pop:true, position:positions.get(entry)});
  });
  // Native hash changes (for example the browser address bar) still have their own entry.
  window.addEventListener('hashchange', () => {
    if (location.pathname === renderedURL.pathname && location.search === renderedURL.search) renderedURL = new URL(location.href);
  });
}
