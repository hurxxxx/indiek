import test from 'node:test';
import assert from 'node:assert/strict';
import {analyticsStorageKey, legacyAnalyticsStorageKey, visitorCookieLifetime, acquisitionSource, readAnalyticsChoice, analyticsCommands, initAnalytics} from '../site/analytics.mjs';

const config={enabled:true,url:'https://matomo.lumejs.com',siteId:4,trackIds:['ydbb','kim-sawol'],contentPaths:['/','/artists/ydbb/','/artists/kim-sawol/']};
function browser({origin='https://indiek.com',choice=null,legacy=null,privacy=false,storageFails=false,search='' }={}) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) {
      const el=new EventTarget();
      Object.assign(el,{hidden:true,isConnected:true,focus(){},contains(){return false;},click(){this.dispatchEvent(new Event('click'));}});
      elements.set(id,el);
    }
    return elements.get(id);
  };
  const storage=new Map([[analyticsStorageKey,choice],[legacyAnalyticsStorageKey,legacy]]);
  const scripts=[];
  const win=new EventTarget();
  Object.assign(win,{
    location:{origin,pathname:'/artists/ydbb/',search},navigator:{globalPrivacyControl:privacy},
    localStorage:{getItem(key){if(storageFails)throw new Error();return storage.get(key);},setItem(key,value){if(storageFails)throw new Error();assert.equal(key,analyticsStorageKey);storage.set(key,value);}},
  });
  const doc=new EventTarget();
  Object.assign(doc,{querySelector:element,querySelectorAll:()=>[element('[data-analytics-settings]')],createElement:()=>({}),head:{append:script=>scripts.push(script)},title:'YdBB — ONCE | indiek',referrer:'https://example.com/private?token=hidden'});
  const analytics=initAnalytics(config,'https://indiek.com',win,doc);
  return {win,doc,analytics,scripts,element,storage,stored:()=>storage.get(analyticsStorageKey)};
}

test('no tracker is loaded until analytics is allowed; decline stays local',()=>{
  const b=browser();
  assert.equal(b.scripts.length,0); assert.equal(b.win._paq,undefined);
  b.element('[data-analytics-decline]').click();
  assert.equal(b.scripts.length,0); assert.equal(readAnalyticsChoice(b.stored()),'declined');
});
test('allow loads one tracker with privacy settings before the page view; withdrawal stops tracking',()=>{
  const b=browser();
  b.element('[data-analytics-allow]').click(); b.element('[data-analytics-allow]').click();
  assert.equal(b.scripts.length,1);
  assert.equal(b.scripts[0].src,'https://matomo.lumejs.com/matomo.js');
  const commands=b.win._paq.map(command=>command[0]);
  for(const name of ['requireConsent','setCookieNamePrefix','setVisitorCookieTimeout','disableBrowserFeatureDetection','setConsentGiven']) assert.ok(commands.indexOf(name)<commands.indexOf('trackPageView'));
  assert.equal(commands.filter(name=>name==='trackPageView').length,1);
  b.element('[data-analytics-decline]').click();
  assert.deepEqual(b.win._paq.at(-2),['forgetConsentGiven']);
  assert.deepEqual(b.win._paq.at(-1),['deleteCookies']);
  assert.ok(!b.win._paq.some(c=>['trackPageView','trackEvent','setConsentGiven'].includes(c[0])));
});
test('production-only tracking respects saved decline and browser privacy preferences',()=>{
  for(const options of [{origin:'http://127.0.0.1:4173'},{privacy:true}]) {
    const b=browser(options); b.element('[data-analytics-allow]').click(); assert.equal(b.scripts.length,0);
  }
  const declined=JSON.stringify({status:'declined',expires:Date.now()+10000});
  assert.equal(browser({choice:declined}).scripts.length,0);
  const allowed=JSON.stringify({status:'allowed',expires:Date.now()+10000});
  assert.equal(browser({choice:allowed}).scripts.length,1);
});
test('stored choices expire and storage failure does not break the page',()=>{
  for(const value of [null,'{','{}',JSON.stringify({status:'allowed',expires:1})]) assert.equal(readAnalyticsChoice(value),null);
  const b=browser({storageFails:true}); b.element('[data-analytics-allow]').click(); assert.equal(b.scripts.length,1);
});
test('query strings and referring-page paths are excluded from analytics',()=>{
  const commands=analyticsCommands(config,{origin:'https://indiek.com',pathname:'/artists/ydbb/',title:'YdBB',referrer:'https://example.com/private?token=hidden'});
  assert.deepEqual(commands.find(command=>command[0]==='setCustomUrl'),['setCustomUrl','https://indiek.com/artists/ydbb/']);
  assert.deepEqual(commands.find(command=>command[0]==='setReferrerUrl'),['setReferrerUrl','https://example.com/']);
  assert.ok(!JSON.stringify(commands).includes('hidden'));
});
test('internal navigation tracks the new page once, without another script or consent bypass',()=>{
  const b=browser();
  b.analytics.trackPageView('https://indiek.com/');
  assert.equal(b.win._paq,undefined);
  b.element('[data-analytics-allow]').click();
  b.win.location.pathname='/artists/kim-sawol/';b.doc.title='Kim Sawol — Someone | indiek';
  b.analytics.trackPageView('https://indiek.com/artists/ydbb/?secret=value');
  assert.equal(b.scripts.length,1);
  assert.equal(b.win._paq.filter(c=>c[0]==='trackPageView').length,2);
  assert.deepEqual(b.win._paq.at(-4),['setCustomUrl','https://indiek.com/artists/kim-sawol/']);
  assert.deepEqual(b.win._paq.at(-3),['setReferrerUrl','https://indiek.com/']);
  assert.deepEqual(b.win._paq.at(-2),['setDocumentTitle',b.doc.title]);
  b.element('[data-analytics-decline]').click();
  const length=b.win._paq.length;
  b.analytics.trackPageView('https://indiek.com/');
  assert.equal(b.win._paq.length,length);
  const local=browser({origin:'http://127.0.0.1:4173'});
  local.element('[data-analytics-allow]').click();local.analytics.trackPageView('');
  assert.equal(local.win._paq,undefined);
});

test('old cookieless permission requires a new choice; old refusal is respected',()=>{
  const legacy=status=>JSON.stringify({status,expires:Date.now()+10000});
  const allowed=browser({legacy:legacy('allowed')});
  assert.equal(allowed.scripts.length,0);assert.equal(allowed.element('#analytics-notice').hidden,false);
  const declined=browser({legacy:legacy('declined')});
  assert.equal(declined.scripts.length,0);assert.equal(declined.element('#analytics-notice').hidden,true);
  declined.element('[data-analytics-allow]').click();assert.equal(declined.scripts.length,1);
  assert.equal(readAnalyticsChoice(declined.stored()),'allowed');
});
test('only explicit platform names and known content IDs enter event statistics',()=>{
  const b=browser({search:'?from=threads&email=private@example.com&mtm_campaign=secret'});
  b.analytics.trackEvent('play_start','ydbb');assert.equal(b.win._paq,undefined);
  b.element('[data-analytics-allow]').click();
  assert.ok(b.win._paq.some(c=>c[0]==='trackEvent'&&c[1]==='Acquisition'&&c[2]==='threads'));
  for(const [action,id] of [['play_start','ydbb'],['save_add','ydbb'],['share','/artists/ydbb/'],['search','private'],['save_add','private'],['share','/unknown/?email=private']]) b.analytics.trackEvent(action,id);
  assert.equal(b.win._paq.filter(c=>c[0]==='trackEvent').length,4);
  assert.ok(!JSON.stringify(b.win._paq).match(/private|secret/));
  assert.deepEqual(b.win._paq.find(c=>c[0]==='setVisitorCookieTimeout'),['setVisitorCookieTimeout',visitorCookieLifetime]);
  assert.equal(visitorCookieLifetime,35*86400);
  for(const query of ['?from=reddit','?from=threads-malicious','?utm_source=instagram'])assert.equal(acquisitionSource(query),null);
});
test('withdrawal in another tab removes pending events and tracking cookies',()=>{
  const b=browser();b.doc.cookie='_ik_pk_id.4.abc=abc; other=keep';
  b.element('[data-analytics-allow]').click();b.analytics.trackEvent('play_start','ydbb');
  b.storage.set(analyticsStorageKey,JSON.stringify({status:'declined',expires:Date.now()+10000}));
  const event=new Event('storage');Object.assign(event,{key:analyticsStorageKey});b.win.dispatchEvent(event);
  assert.ok(!b.win._paq.some(c=>c[0]==='trackEvent'||c[0]==='trackPageView'));
  assert.match(b.doc.cookie,/_ik_pk_id\.4\.abc=; Max-Age=0/);
  const length=b.win._paq.length;b.analytics.trackEvent('save_add','ydbb');assert.equal(b.win._paq.length,length);
});
test('events stop when a browser privacy preference changes',()=>{
  const b=browser();b.element('[data-analytics-allow]').click();
  b.win.navigator.globalPrivacyControl=true;b.analytics.trackEvent('play_start','ydbb');
  assert.ok(!b.win._paq.some(c=>c[0]==='trackEvent'));
  assert.ok(b.win._paq.some(c=>c[0]==='forgetConsentGiven'));
});
