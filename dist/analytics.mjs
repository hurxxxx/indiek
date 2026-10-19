export const analyticsStorageKey = 'indiek-analytics-choice-v2';
export const legacyAnalyticsStorageKey = 'indiek-analytics-choice-v1';
const choiceLifetime = 180 * 24 * 60 * 60 * 1000;
export const visitorCookieLifetime = 35 * 24 * 60 * 60;
const cookiePrefix = '_ik_pk_';

export function readAnalyticsChoice(value, now = Date.now()) {
  try {
    const choice = JSON.parse(value);
    return ['allowed', 'declined'].includes(choice.status) && choice.expires > now ? choice.status : null;
  } catch { return null; }
}

export function analyticsCommands(config, page) {
  return [
    ['requireConsent'], ['disableBrowserFeatureDetection'], ['disableCampaignParameters'],
    ['setDoNotTrack', true], ['setCookieNamePrefix', cookiePrefix], ['setCookiePath', '/'],
    ['setCookieSameSite', 'Lax'], ['setSecureCookie', true],
    ['setVisitorCookieTimeout', visitorCookieLifetime], ['setReferralCookieTimeout', visitorCookieLifetime],
    ['setTrackerUrl', `${config.url}/matomo.php`], ['setSiteId', config.siteId],
    ['setConsentGiven'], ...pageViewCommands(page),
  ];
}

export function pageViewCommands(page) {
  let referrer = '';
  try { referrer = new URL(page.referrer).origin + '/'; } catch { /* No referring page. */ }
  return [
    ['setCustomUrl', page.origin + page.pathname], ['setReferrerUrl', referrer],
    ['setDocumentTitle', page.title], ['trackPageView'],
  ];
}

export function acquisitionSource(search) {
  const value = new URLSearchParams(search).get('from');
  return ['threads', 'instagram'].includes(value) ? value : null;
}

export function initAnalytics(config, siteOrigin, win = window, doc = document) {
  const notice = doc.querySelector('#analytics-notice');
  if (!config?.enabled || !notice) return;
  const allow = doc.querySelector('[data-analytics-allow]');
  const decline = doc.querySelector('[data-analytics-decline]');
  const status = doc.querySelector('#analytics-status');
  const isBlocked = () => win.navigator.doNotTrack === '1' || win.navigator.globalPrivacyControl === true;
  const trackIds = new Set(config.trackIds || []);
  const contentPaths = new Set(config.contentPaths || []);
  // Keep only the two explicitly supported source names. Never retain the raw query.
  const source = acquisitionSource(win.location.search);
  const landingPath = win.location.pathname;
  let acquired = false;
  let choice = null, expires = 0, active = false, scriptLoaded = false, returnFocus;
  function readChoice() {
    try {
      const value = win.localStorage.getItem(analyticsStorageKey);
      choice = readAnalyticsChoice(value);
      expires = choice ? JSON.parse(value).expires : 0;
      if (!choice) {
        const legacy = win.localStorage.getItem(legacyAnalyticsStorageKey);
        // An old refusal remains a refusal. Cookieless permission is not cookie permission.
        if (readAnalyticsChoice(legacy) === 'declined') {
          choice = 'declined'; expires = JSON.parse(legacy).expires;
        }
      }
    } catch { /* Storage unavailable: keep the explicit in-memory choice. */ }
  }
  readChoice();
  function removeCookies() {
    for (const cookie of (doc.cookie || '').split(';')) {
      const name = cookie.trim().split('=')[0];
      if (name.startsWith(cookiePrefix)) doc.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
    }
  }
  function stop() {
    if (Array.isArray(win._paq)) {
      // Withdrawal can precede the async script response. Do not flush old events on load.
      win._paq.splice(0, win._paq.length, ['requireConsent'], ['setCookieNamePrefix', cookiePrefix], ['setCookiePath', '/']);
    }
    if (win._paq) {
      win._paq.push(['forgetConsentGiven']);
      win._paq.push(['deleteCookies']);
    }
    active = false;
    removeCookies();
  }
  function canTrack() {
    if (expires && expires <= Date.now()) { choice = null; stop(); describe(); notice.hidden = isBlocked(); }
    if (isBlocked()) { if (active) stop(); return false; }
    return active && choice === 'allowed' && win.location.origin === siteOrigin;
  }
  function start() {
    if (active || choice !== 'allowed' || isBlocked() || win.location.origin !== siteOrigin) return;
    const queue = win._paq = win._paq || [];
    for (const command of analyticsCommands(config, {
      origin: win.location.origin, pathname: win.location.pathname,
      referrer: doc.referrer, title: doc.title,
    })) queue.push(command);
    active = true;
    if (source && !acquired && contentPaths.has(landingPath)) {
      queue.push(['trackEvent', 'Acquisition', source, landingPath]); acquired = true;
    }
    if (!scriptLoaded) {
      const script = doc.createElement('script');
      script.async = true;
      script.src = `${config.url}/matomo.js`;
      // A blocked script is not reported as a measured visit. A new consent action may retry.
      script.onerror = () => { stop(); scriptLoaded = false; script.remove?.(); };
      doc.head.append(script);
      scriptLoaded = true;
    }
  }
  function describe() {
    status.textContent = isBlocked() ? 'Your browser’s privacy preference keeps analytics off.'
      : choice === 'allowed' ? 'Analytics is allowed. You can turn it off and remove its cookies at any time.'
      : choice === 'declined' ? 'Analytics is off.' : 'The choice is yours. The site works either way.';
    allow.disabled = isBlocked();
  }
  function choose(value) {
    choice = value; expires = Date.now() + choiceLifetime;
    try { win.localStorage.setItem(analyticsStorageKey, JSON.stringify({status: value, expires})); } catch { /* Session only. */ }
    if (value === 'allowed') start(); else stop();
    describe(); notice.hidden = true;
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
    else if (notice.contains(doc.activeElement)) doc.querySelector('[data-analytics-settings]')?.focus({preventScroll:true});
  }
  allow.addEventListener('click', () => choose('allowed'));
  decline.addEventListener('click', () => choose('declined'));
  const refreshControls = () => doc.querySelectorAll('[data-analytics-settings]').forEach(button => button.hidden = false);
  refreshControls();
  doc.addEventListener('click', event => {
    const button = event.target.closest('[data-analytics-settings]');
    if (!button) return;
    returnFocus = button;
    canTrack(); describe(); notice.hidden = false; decline.focus();
  });
  win.addEventListener('storage', event => {
    if (![analyticsStorageKey, legacyAnalyticsStorageKey, null].includes(event.key)) return;
    readChoice();
    if (choice === 'allowed') start(); else stop();
    describe(); notice.hidden = Boolean(choice || isBlocked());
  });
  describe(); notice.hidden = Boolean(choice || isBlocked());
  if (choice !== 'allowed' || isBlocked()) removeCookies();
  start();
  return {
    refreshControls,
    trackPageView(referrer) {
      if (!canTrack()) return;
      for (const command of pageViewCommands({origin:win.location.origin, pathname:win.location.pathname, title:doc.title, referrer})) win._paq.push(command);
    },
    trackEvent(action, id) {
      if (!canTrack()) return;
      if (['play_start', 'save_add'].includes(action) && trackIds.has(id)) win._paq.push(['trackEvent', 'Music', action, id]);
      else if (action === 'share' && contentPaths.has(id)) win._paq.push(['trackEvent', 'Content', action, id]);
    },
  };
}
