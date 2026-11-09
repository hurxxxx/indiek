import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {Store} from '../promotion/core.mjs';

const LOG='docs/promotion.md';
const START='<!-- automatic-promotion:start -->',END='<!-- automatic-promotion:end -->';

// Manual records outside the generated SNS section, ignoring blank-line differences at its edges.
export function manualRecords(text) {
  const start=text.indexOf(START),end=text.indexOf(END);
  const outside=start<0||end<start?text:text.slice(0,start)+'\n'+text.slice(end+END.length);
  return outside.split('\n').map(line=>line.trimEnd()).filter(Boolean).join('\n');
}

// The SNS runner rewrites only the automatic section of docs/promotion.md from server state, so a
// committed record update would otherwise block every fast-forward. Restore the committed copy,
// fast-forward, then regenerate the section from the same state. Manual edits made on the server
// and any other local change still stop the merge.
export function syncServerCheckout(root,remote,{git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}),regenerate=()=>new Store(root).log()}={}) {
  git('fetch',remote,'main');
  const restored=Boolean(git('status','--porcelain','--',LOG).trim());
  if(restored) {
    if(manualRecords(git('show',`HEAD:${LOG}`))!==manualRecords(readFileSync(path.join(root,LOG),'utf8')))throw new Error(`${LOG} has server edits outside the automatic section; reconcile them before publishing.`);
    git('checkout','--',LOG);
  }
  try { git('merge','--ff-only',`${remote}/main`); }
  finally { if(restored)regenerate(); }
  return {restored};
}
