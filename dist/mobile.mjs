// Short, wide viewports include phones held sideways, even above 760px wide.
export const mobilePlayerQuery = '(max-width: 760px), (max-width: 1024px) and (max-height: 540px)';

export function visibleViewport(win) {
  const viewport = win.visualViewport;
  // Leave pinch zoom to the browser; only adapt to the unzoomed visible area.
  const useVisual = viewport && Math.abs(viewport.scale - 1) < 0.01;
  const width = useVisual ? viewport.width : win.innerWidth;
  const height = useVisual ? viewport.height : win.innerHeight;
  return {
    width, height,
    top: useVisual ? viewport.offsetTop : 0,
    left: useVisual ? viewport.offsetLeft : 0,
    side: width >= 600 && height <= 500 && width > height,
    sideWidth: Math.min(360, Math.floor(width * 0.42)),
    keyboard: Boolean(useVisual && win.innerHeight - height > 100),
  };
}

export function initMobileViewport(mobile, {win = window, doc = document} = {}) {
  let frame;
  function refresh() {
    const view = visibleViewport(win);
    const root = doc.documentElement;
    root.classList.toggle('mobile-player-layout', mobile.matches);
    root.classList.toggle('mobile-player-side', mobile.matches && view.side);
    root.classList.toggle('keyboard-open', mobile.matches && view.keyboard);
    for (const key of ['width', 'height', 'top', 'left']) {
      root.style.setProperty(`--view-${key}`, `${view[key]}px`);
    }
    root.style.setProperty('--view-bottom', `${Math.max(0,win.innerHeight-view.top-view.height)}px`);
    root.style.setProperty('--mobile-side-width', `${view.sideWidth}px`);
  }
  function schedule() {
    win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(refresh);
  }
  win.addEventListener('resize', schedule);
  win.visualViewport?.addEventListener('resize', schedule);
  win.visualViewport?.addEventListener('scroll', schedule);
  mobile.addEventListener('change', refresh);
  refresh();
}
