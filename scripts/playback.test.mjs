import test from 'node:test';
import assert from 'node:assert/strict';
import {internalPageURL, createPageScroll} from '../site/navigation.mjs';
import {createPlayer, loadYouTubeAPI} from '../site/player.mjs';

const current='https://indiek.com/artists/ydbb/';
const link=(href,attributes={})=>({href,...attributes,hasAttribute:key=>Object.hasOwn(attributes,key)});
test('only ordinary internal page links use continuous navigation',()=>{
  for(const href of ['/#records','/artists/kim-sawol/','/privacy-and-terms/#analytics']) {
    assert.equal(internalPageURL(link(href),current,{button:0}).href,new URL(href,current).href);
  }
  for(const anchor of [link('https://youtube.com/watch?v=123'),link('mailto:gw@lumejs.com'),link('/assets/cover.jpg'),link('/',{target:'_blank'}),link('/',{download:''})]) {
    assert.equal(internalPageURL(anchor,current,{button:0}),null);
  }
  for(const event of [{button:1},{button:0,metaKey:true},{button:0,ctrlKey:true},{button:0,defaultPrevented:true}]) {
    assert.equal(internalPageURL(link('/'),current,event),null);
  }
});

test('mobile docking preserves reading position across expand, close and viewport changes',()=>{
  let onResize;
  const classes=new Set();
  const mobile={matches:true,addEventListener(type,fn){onResize=fn;}};
  const page={scrollLeft:0,scrollTop:0,scrollTo({left,top}){this.scrollLeft=left;this.scrollTop=top;},addEventListener(){}};
  const win={scrollX:0,scrollY:640,matchMedia:()=>mobile,scrollTo({left,top}){this.scrollX=left;this.scrollY=top;},addEventListener(){}};
  const doc={querySelector:()=>page,documentElement:{classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}}}};
  const scroll=createPageScroll({win,doc});
  scroll.setCompact(true);
  assert.ok(classes.has('has-mobile-player'));assert.deepEqual(scroll.position(),[0,640]);
  scroll.to([0,960]);scroll.setCompact(false);
  assert.equal(win.scrollY,960);assert.equal(classes.size,0);
  scroll.setCompact(true);scroll.to([0,1280]);mobile.matches=false;onResize();
  assert.equal(win.scrollY,1280);assert.equal(classes.size,0);
  mobile.matches=true;onResize();assert.deepEqual(scroll.position(),[0,1280]);
  scroll.to([0,0]);scroll.setCompact(false);assert.equal(win.scrollY,0);
});

const first={id:'first',track:'First',artist:'Artist',channel:'Official',videoId:'one'};
const second={...first,id:'second',track:'Second',videoId:'two'};
const third={...first,id:'third',track:'Third',videoId:'three'};
function playerFixture() {
  const stage={children:[],replaceChildren(...nodes){this.children=nodes;},querySelector(){return this.children[0];}};
  const label={};
  const root={hidden:true,querySelector:selector=>selector==='[data-player-stage]'?stage:label};
  const created=[], instances=[], calls=[], starts=[];
  const doc={createElement(tag){assert.equal(tag,'iframe');const frame={focus(){}};created.push(frame);return frame;}};
  let resolveAPI, rejectAPI, requests=0;
  const api=new Promise((resolve,reject)=>{resolveAPI=resolve;rejectAPI=reject;});
  class Player {
    constructor(frame,{events}) { this.events=events;this.videoId=new URL(frame.src).pathname.split('/').at(-1);instances.push(this); }
    getVideoUrl(){return `https://www.youtube.com/watch?v=${this.videoId}`;}
    loadVideoById(id,start){this.videoId=id;calls.push(['play',id]);starts.push(start);}
    cueVideoById(id){this.videoId=id;calls.push(['cue',id]);}
    playVideo(){calls.push(['play',this.videoId]);}
    destroy(){calls.push(['destroy']);}
    emit(name,data){this.events[name]({target:this,data});}
  }
  const player=createPlayer(root,{doc,win:{location:{origin:'http://127.0.0.1:4173'},setTimeout(){return 1;},clearTimeout(){}},loadAPI:()=>{requests++;return api;}});
  return {player,stage,root,created,label,calls,starts,instances,requests:()=>requests,
    async ready(){resolveAPI({Player});await api;instances.at(-1)?.emit('onReady');},
    async fail(){rejectAPI(new Error('offline'));await api.catch(()=>{});await Promise.resolve();},
  };
}
test('no YouTube connection before load; one iframe survives song changes and same-song selection',async()=>{
  const b=playerFixture();b.player.setQueue([first,second]);
  assert.equal(b.requests(),0);assert.equal(b.created.length,0);
  b.player.load(first);await b.ready();
  const frame=b.stage.children[0],url=new URL(frame.src);
  assert.equal(url.origin,'https://www.youtube-nocookie.com');
  assert.equal(url.searchParams.get('enablejsapi'),'1');
  assert.equal(url.searchParams.get('origin'),'http://127.0.0.1:4173');
  assert.ok(frame.allow.includes('autoplay'));assert.ok(frame.allowFullscreen);
  assert.deepEqual(b.calls,[]); // Explicitly cueing a video must not start it.
  b.player.load({...first});assert.deepEqual(b.calls,[]);
  b.player.load(second,{autoplay:true});
  assert.deepEqual(b.calls,[['play','two']]);
  assert.equal(b.stage.children[0],frame);assert.equal(b.created.length,1);
  assert.equal(b.label.textContent,'Second · Artist');
});
test('a play action starts the first video and resumes the same song without replacing its iframe',async()=>{
  const b=playerFixture();b.player.load(first,{autoplay:true});
  const frame=b.stage.children[0];
  assert.equal(new URL(frame.src).searchParams.get('autoplay'),'1');
  await b.ready();assert.deepEqual(b.calls,[['play','one']]);
  const api=b.instances[0];api.emit('onStateChange',1);
  b.player.load(first,{autoplay:true});assert.equal(b.calls.length,1);
  api.emit('onStateChange',2);b.player.load(first,{autoplay:true});
  assert.deepEqual(b.calls,[['play','one'],['play','one']]);
  assert.equal(b.stage.children[0],frame);assert.equal(b.created.length,1);
});
test('saved order advances once per completed song, skips external-only entries and stops at the end',async()=>{
  const b=playerFixture();b.player.setQueue([first,{...first,id:'external',externalOnly:true},second,third]);
  b.player.load(first);await b.ready();const api=b.instances[0];
  api.emit('onStateChange',1);api.emit('onStateChange',0);api.emit('onStateChange',0);
  assert.equal(b.player.current.id,'second');assert.deepEqual(b.calls,[['play','two']]);
  api.emit('onStateChange',1);api.emit('onStateChange',0);
  assert.equal(b.player.current.id,'third');
  api.emit('onStateChange',1);api.emit('onStateChange',0);
  assert.equal(b.player.current.id,'third');assert.equal(b.player.state,'ended');
  assert.equal(b.calls.length,2);assert.equal(b.player.next,null);
  b.player.load(third,{autoplay:true});
  assert.deepEqual(b.calls.at(-1),['play','three']); // Explicitly selecting the finished song starts it again.
});
test('Play all restarts the first saved song at zero, enables auto-next and keeps the iframe',async()=>{
  const b=playerFixture();b.player.setQueue([first,second]);
  b.player.playAll();await b.ready();
  const frame=b.stage.children[0],api=b.instances[0];
  assert.equal(b.player.current.id,'first');assert.equal(b.player.autoNext,true);
  api.emit('onStateChange',1);b.player.setAutoNext(false);b.player.playAll();
  assert.equal(b.starts.at(-1),0);assert.equal(b.player.autoNext,true);
  assert.equal(b.stage.children[0],frame);assert.equal(b.created.length,1);
  api.emit('onStateChange',0);assert.equal(b.player.current.id,'first'); // Ignore the old ended event while restarting.
  api.emit('onStateChange',1);api.emit('onStateChange',0);
  assert.equal(b.player.current.id,'second');
  b.player.playAll();assert.equal(b.player.current.id,'first');
});
test('Play all with an empty queue does not connect or interrupt an existing song',async()=>{
  const b=playerFixture();b.player.playAll();assert.equal(b.requests(),0);
  b.player.load(first,{autoplay:true});await b.ready();
  const calls=b.calls.length;b.player.playAll();
  assert.equal(b.player.current.id,'first');assert.equal(b.calls.length,calls);
});
test('manual selection, previous/next and the auto-next switch respect the current queue',async()=>{
  const b=playerFixture();b.player.setQueue([first,second,third]);b.player.load(first);await b.ready();
  const api=b.instances[0];b.player.load(third,{autoplay:true});b.player.previousTrack();
  assert.equal(b.player.current.id,'second');
  b.player.setAutoNext(false);api.emit('onStateChange',1);api.emit('onStateChange',0);
  assert.equal(b.player.current.id,'second');
  b.player.nextTrack();assert.equal(b.player.current.id,'third');
  b.player.nextTrack();assert.equal(b.player.current.id,'third');
  b.player.setAutoNext(true);b.player.setQueue([first]);
  api.emit('onStateChange',1);api.emit('onStateChange',0);
  assert.equal(b.player.current.id,'third'); // Removed/current unsaved songs finish without jumping.
});
test('saved changes affect the next song without interrupting the current iframe',async()=>{
  const b=playerFixture();b.player.setQueue([first,second,third]);b.player.load(first);await b.ready();
  const frame=b.stage.children[0];b.player.setQueue([first,third]);
  assert.equal(b.stage.children[0],frame);assert.deepEqual(b.calls,[]);
  b.instances[0].emit('onStateChange',1);b.instances[0].emit('onStateChange',0);
  assert.equal(b.player.current.id,'third');
});
test('blocked playback and errors stop advancement; a later user play can continue',async()=>{
  const b=playerFixture();b.player.setQueue([first,second]);b.player.load(first);await b.ready();
  const api=b.instances[0];api.emit('onAutoplayBlocked');
  assert.equal(b.player.state,'blocked');assert.deepEqual(b.calls,[]);
  api.emit('onStateChange',1);api.emit('onError',150);api.emit('onStateChange',0);
  assert.equal(b.player.state,'error');assert.equal(b.player.current.id,'first');
  api.emit('onStateChange',1);api.emit('onStateChange',0);
  assert.equal(b.player.current.id,'second');
});
test('close destroys the player and ignores later callbacks, including a delayed API load',async()=>{
  const b=playerFixture();b.player.load(first);await b.ready();const api=b.instances[0];
  b.player.close();api.emit('onStateChange',1);api.emit('onError',100);
  assert.equal(b.root.hidden,true);assert.equal(b.stage.children.length,0);assert.equal(b.player.current,null);assert.equal(b.player.state,'idle');
  assert.deepEqual(b.calls,[['destroy']]);
  const pending=playerFixture();pending.player.load(first);pending.player.close();await pending.ready();
  assert.equal(pending.instances.length,0);assert.equal(pending.stage.children.length,0);
});
test('a newer selection wins while the API is loading, and API failure preserves manual playback',async()=>{
  const b=playerFixture();b.player.load(first);b.player.load(second);await b.ready();
  assert.equal(b.instances.length,1);assert.equal(b.player.current.id,'second');
  b.player.load({...third,externalOnly:true});assert.equal(b.player.current.id,'second');
  const failed=playerFixture();failed.player.load(first);await failed.fail();
  assert.equal(failed.player.state,'unavailable');assert.equal(failed.stage.children.length,1);
});
test('official API loader is shared and can retry after a blocked script',async()=>{
  const scripts=[];
  const win={setTimeout(){return 1;},clearTimeout(){}};
  const doc={createElement(){return {remove(){}};},head:{append(script){scripts.push(script);}}};
  const a=loadYouTubeAPI({win,doc});assert.equal(loadYouTubeAPI({win,doc}),a);
  assert.equal(scripts.length,1);assert.equal(scripts[0].src,'https://www.youtube.com/iframe_api');
  scripts[0].onerror();await assert.rejects(a);
  const b=loadYouTubeAPI({win,doc});assert.equal(scripts.length,2);
  win.YT={Player(){}};win.onYouTubeIframeAPIReady();assert.equal(await b,win.YT);
});
