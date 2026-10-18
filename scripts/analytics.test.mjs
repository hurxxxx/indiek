import test from 'node:test';
import assert from 'node:assert/strict';
import {analyticsStorageKey, readAnalyticsChoice, analyticsCommands, initAnalytics} from '../site/analytics.mjs';

const config={enabled:true,url:'https://matomo.lumejs.com',siteId:4};
function browser({origin='https://indiek.com',choice=null,privacy=false,storageFails=false}={}) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) {
      const el=new EventTarget();
      Object.assign(el,{hidden:true,isConnected:true,focus(){},contains(){return false;},click(){this.dispatchEvent(new Event('click'));}});
      elements.set(id,el);
    }
    return elements.get(id);
  };
  let stored=choice;
  const scripts=[];
  const win=new EventTarget();
  Object.assign(win,{
    location:{origin,pathname:'/artists/ydbb/'},navigator:{globalPrivacyControl:privacy},
    localStorage:{getItem(){if(storageFails)throw new Error();return stored;},setItem(key,value){if(storageFails)throw new Error();assert.equal(key,analyticsStorageKey);stored=value;}},
  });
  const doc={querySelector:element,querySelectorAll:()=>[element('[data-analytics-settings]')],createElement:()=>({}),head:{append:script=>scripts.push(script)},title:'YdBB — ONCE | indiek',referrer:'https://example.com/private?token=hidden'};
  initAnalytics(config,'https://indiek.com',win,doc);
  return {win,scripts,element,stored:()=>stored};
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
  for(const name of ['requireConsent','disableCookies','disableBrowserFeatureDetection','setConsentGiven']) assert.ok(commands.indexOf(name)<commands.indexOf('trackPageView'));
  assert.equal(commands.filter(name=>name==='trackPageView').length,1);
  b.element('[data-analytics-decline]').click();
  assert.deepEqual(b.win._paq.at(-1),['forgetConsentGiven']);
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
