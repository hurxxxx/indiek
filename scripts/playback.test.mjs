import test from 'node:test';
import assert from 'node:assert/strict';
import {internalPageURL} from '../site/navigation.mjs';
import {createPlayer} from '../site/player.mjs';

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

function playerFixture() {
  const stage={children:[],replaceChildren(...nodes){this.children=nodes;},querySelector(){return this.children[0];}};
  const label={};
  const root={hidden:true,querySelector:selector=>selector==='[data-player-stage]'?stage:label};
  const created=[];
  const doc={createElement(tag){assert.equal(tag,'iframe');const frame={focus(){}};created.push(frame);return frame;}};
  return {player:createPlayer(root,{doc}),stage,root,created,label};
}
const first={id:'kim-sawol',track:'Someone',artist:'Kim Sawol',channel:'POCLANOS',videoId:'11mxnvHowTY'};
test('player is deferred, reuses the same loaded song and replaces only on explicit song change',()=>{
  const b=playerFixture();
  assert.equal(b.created.length,0);assert.equal(b.root.hidden,true);
  b.player.load(first);
  const frame=b.stage.children[0];
  assert.match(frame.src,/youtube-nocookie\.com\/embed\/11mxnvHowTY\?playsinline=1$/);
  assert.ok(!frame.src.includes('autoplay=1'));
  assert.equal(b.root.hidden,false);
  b.player.load({...first});
  assert.equal(b.stage.children[0],frame);assert.equal(b.created.length,1);
  b.player.load({...first,id:'other',videoId:'different'});
  assert.equal(b.stage.children.length,1);assert.notEqual(b.stage.children[0],frame);
  assert.equal(b.player.current.id,'other');
  b.player.close();
  assert.equal(b.stage.children.length,0);assert.equal(b.player.current,null);assert.equal(b.root.hidden,true);
});
test('an external-only video never interrupts the embedded song',()=>{
  const b=playerFixture();b.player.load(first);
  b.player.load({...first,id:'external',externalOnly:true});
  assert.equal(b.player.current.id,first.id);assert.equal(b.created.length,1);
});
