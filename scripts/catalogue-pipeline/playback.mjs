// Real embedded-playback check. An oEmbed answer only proves that a video exists; this loads the
// same youtube-nocookie embed the site uses in headless Chrome, asks it to play (muted) and requires
// the playhead to advance. Embedding refusals (101/150), removals (100) and silent stalls fail.
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const CHROME = [process.env.INDIEK_CHROME,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean);
export const chromePath = () => CHROME.find(file => existsSync(file));
export const ERRORS = {2:'invalid video ID',5:'HTML5 player error',100:'removed or private',101:'embedding disabled by the owner',150:'embedding disabled by the owner',153:'player configuration error'};

// Mirrors site/player.mjs: same host, parameters and referrer policy, served from an http origin.
const page = (id, minimum) => `<!doctype html><meta charset="utf-8"><body><div id="frame"></div><script>
window.result={state:'loading',events:[]};
const frame=document.createElement('iframe');
frame.width=640;frame.height=360;frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.referrerPolicy='strict-origin-when-cross-origin';
frame.src='https://www.youtube-nocookie.com/embed/${id}?'+new URLSearchParams({playsinline:'1',enablejsapi:'1',autoplay:'1',mute:'1',origin:location.origin});
frame.id='player';document.getElementById('frame').append(frame);
window.onYouTubeIframeAPIReady=()=>{new YT.Player('player',{events:{
  onReady:e=>{result.events.push('ready');e.target.mute();e.target.playVideo();},
  onStateChange:e=>{result.events.push('state:'+e.data);if(e.data===1&&!result.waiting){result.waiting=true;const start=e.target.getCurrentTime();setTimeout(()=>{const time=e.target.getCurrentTime();Object.assign(result,{state:time-start>=${minimum}*0.8?'playing':'stalled',start,time,duration:e.target.getDuration(),done:true});},${minimum}*1000+500);}},
  onError:e=>{Object.assign(result,{state:'error',code:e.data,done:true});}}});};
const api=document.createElement('script');api.src='https://www.youtube.com/iframe_api';document.head.append(api);
</script>`;

export async function oembed(videoId, fetcher = fetch) {
  const response = await fetcher(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`, {signal:AbortSignal.timeout(20000)});
  if (!response.ok) return null;
  const data = await response.json();
  return {title:data.title, channel:data.author_name, channelURL:data.author_url};
}

export async function verifyPlayback(videoIds, {timeoutSeconds = 45, minimumSeconds = 3} = {}) {
  const chrome = chromePath();
  if (!chrome) throw Object.assign(new Error('Chrome or Chromium is required for the playback check (set INDIEK_CHROME)'), {infrastructure:true});
  const server = createServer((req, res) => {
    const id = new URL(req.url, 'http://localhost').searchParams.get('v') || '';
    if (!/^[\w-]{11}$/.test(id)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'content-type':'text/html; charset=utf-8'}); res.end(page(id, minimumSeconds));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = mkdtempSync(path.join(tmpdir(), 'indiek-playback-'));
  const browser = spawn(chrome, ['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--autoplay-policy=no-user-gesture-required','--no-first-run','--no-default-browser-check','--mute-audio','about:blank'], {stdio:'ignore'});
  const results = {};
  let socket;
  try {
    let endpoint;
    for (let i = 0; i < 150 && !endpoint; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const file = path.join(profile, 'DevToolsActivePort');
      if (existsSync(file)) { const [port, target] = readFileSync(file, 'utf8').split('\n'); if (target) endpoint = `ws://127.0.0.1:${port}${target}`; }
    }
    if (!endpoint) throw Object.assign(new Error('Chrome did not start for the playback check'), {infrastructure:true});
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let next = 0; const pending = new Map();
    socket.onmessage = message => { const data = JSON.parse(message.data); pending.get(data.id)?.(data); pending.delete(data.id); };
    const send = (method, params = {}, sessionId) => new Promise(resolve => { const id = ++next; pending.set(id, resolve); socket.send(JSON.stringify({id, method, params, sessionId})); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const attempt = async videoId => {
      const {result:{targetId}} = await send('Target.createTarget', {url:`${origin}/?v=${videoId}`});
      const {result:{sessionId}} = await send('Target.attachToTarget', {targetId, flatten:true});
      let result = {state:'timeout'};
      const started = Date.now();
      while (Date.now() - started < timeoutSeconds * 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const evaluated = await send('Runtime.evaluate', {expression:'JSON.stringify(window.result||{})', returnByValue:true}, sessionId);
        const value = JSON.parse(evaluated.result?.result?.value || '{}');
        if (value.done) { result = value; break; }
        result = {...value, state:'timeout'};
      }
      await send('Target.closeTarget', {targetId});
      return result;
    };
    for (const videoId of videoIds) {
      // A cold first load of the player API occasionally stalls; one fresh tab rules that out.
      let result = await attempt(videoId);
      if (result.state === 'timeout') result = await attempt(videoId);
      results[videoId] = {
        videoId, checkedAt:new Date().toISOString(), state:result.state, playing:result.state === 'playing',
        ...(result.code !== undefined ? {code:result.code, error:ERRORS[result.code] || 'player error'} : {}),
        ...(result.duration ? {duration:Math.round(result.duration), advancedSeconds:Math.round((result.time - result.start) * 10) / 10} : {}),
        method:'headless Chrome, youtube-nocookie embed with the site player parameters, muted autoplay',
      };
    }
  } finally {
    socket?.close(); browser.kill(); server.close();
    setTimeout(() => rmSync(profile, {recursive:true, force:true}), 500).unref();
  }
  return results;
}

export const formatDuration = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

// CLI for spot checks: node scripts/catalogue-pipeline/playback.mjs <videoId>…
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(await verifyPlayback(process.argv.slice(2)), null, 2));
}
