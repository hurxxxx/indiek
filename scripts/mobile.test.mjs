import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleViewport} from '../site/mobile.mjs';

test('portrait screens reserve the visible area without switching to a side player',()=>{
  for(const [width,height] of [[320,568],[360,640],[390,844]]){
    const view=visibleViewport({innerWidth:width,innerHeight:height});
    assert.equal(view.width,width);assert.equal(view.height,height);
    assert.equal(view.side,false);assert.equal(view.keyboard,false);
  }
});
test('short landscape screens leave room for both readable content and the visible video',()=>{
  for(const width of [667,844,932]){
    const view=visibleViewport({innerWidth:width,innerHeight:390});
    assert.equal(view.side,true);
    assert.ok(view.sideWidth>=200);
    assert.ok(view.width-view.sideWidth>=300);
  }
});
test('keyboard and browser viewport offsets constrain controls to the visible area',()=>{
  const view=visibleViewport({innerWidth:390,innerHeight:844,visualViewport:{width:390,height:410,offsetTop:24,offsetLeft:0,scale:1}});
  assert.equal(view.keyboard,true);assert.equal(view.height,410);
  assert.equal(view.top,24);assert.equal(view.side,false);
});
test('pinch zoom does not reflow the media into the smaller zoomed viewport',()=>{
  const view=visibleViewport({innerWidth:390,innerHeight:844,visualViewport:{width:195,height:422,offsetTop:120,offsetLeft:50,scale:2}});
  assert.equal(view.width,390);assert.equal(view.height,844);
  assert.equal(view.top,0);assert.equal(view.left,0);assert.equal(view.keyboard,false);
});
