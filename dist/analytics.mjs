export const analyticsStorageKey = 'indiek-analytics-choice-v1';
const choiceLifetime = 180 * 24 * 60 * 60 * 1000;

export function readAnalyticsChoice(value, now = Date.now()) {
  try {
    const choice = JSON.parse(value);
    return ['allowed', 'declined'].includes(choice.status) && choice.expires > now ? choice.status : null;
  } catch { return null; }
}

export function analyticsCommands(config, page) {
  let referrer = '';
  try { referrer = new URL(page.referrer).origin + '/'; } catch { /* No referring page. */ }
  return [
    ['requireConsent'], ['disableCookies'], ['disableBrowserFeatureDetection'],
    ['disableCampaignParameters'], ['setDoNotTrack', true],
    ['setTrackerUrl', `${config.url}/matomo.php`], ['setSiteId', config.siteId],
    ['setCustomUrl', page.origin + page.pathname], ['setReferrerUrl', referrer],
    ['setDocumentTitle', page.title], ['setConsentGiven'], ['trackPageView'],
  ];
}

export function initAnalytics(config, siteOrigin, win = window, doc = document) {
  const notice = doc.querySelector('#analytics-notice');
  if (!config?.enabled || !notice) return;
  const settings = [...doc.querySelectorAll('[data-analytics-settings]')];
  const allow = doc.querySelector('[data-analytics-allow]');
  const decline = doc.querySelector('[data-analytics-decline]');
  const status = doc.querySelector('#analytics-status');
  const blocked = win.navigator.doNotTrack === '1' || win.navigator.globalPrivacyControl === true;
  let choice = null, active = false, scriptLoaded = false, returnFocus;
  try { choice = readAnalyticsChoice(win.localStorage.getItem(analyticsStorageKey)); } catch { /* Session only. */ }

  function start() {
    // Previews never send visits to the production property.
    if (active || choice !== 'allowed' || blocked || win.location.origin !== siteOrigin) return;
    const queue = win._paq = win._paq || [];
    for (const command of analyticsCommands(config, {
      origin: win.location.origin, pathname: win.location.pathname,
      referrer: doc.referrer, title: doc.title,
    })) queue.push(command);
    active = true;
    if (!scriptLoaded) {
      const script = doc.createElement('script');
      script.async = true;
      script.src = `${config.url}/matomo.js`;
      doc.head.append(script);
      scriptLoaded = true;
    }
  }
  function stop() {
    if (active) win._paq.push(['forgetConsentGiven']);
    active = false;
  }
  function describe() {
    status.textContent = blocked ? 'Your browser’s privacy preference keeps analytics off.'
      : choice === 'allowed' ? 'Analytics is allowed. You can turn it off at any time.'
      : choice === 'declined' ? 'Analytics is off.' : 'The choice is yours. The site works either way.';
    allow.disabled = blocked;
  }
  function choose(value) {
    choice = value;
    try { win.localStorage.setItem(analyticsStorageKey, JSON.stringify({status: value, expires: Date.now() + choiceLifetime})); } catch { /* Session only. */ }
    if (value === 'allowed') start(); else stop();
    describe();
    notice.hidden = true;
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
    else if (notice.contains(doc.activeElement)) settings[0]?.focus({preventScroll:true});
  }
  allow.addEventListener('click', () => choose('allowed'));
  decline.addEventListener('click', () => choose('declined'));
  settings.forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => {
      returnFocus = button;
      describe(); notice.hidden = false; decline.focus();
    });
  });
  win.addEventListener('storage', event => {
    if (event.key !== analyticsStorageKey && event.key !== null) return;
    choice = readAnalyticsChoice(event.newValue);
    if (choice === 'allowed') start(); else stop();
    describe(); notice.hidden = !(!choice && !blocked);
  });
  describe(); notice.hidden = Boolean(choice || blocked);
  start();
}
