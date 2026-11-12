import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const wrapper = new URL('./time-limit.mjs', import.meta.url).pathname;
const run = (seconds, script) => spawnSync(process.execPath, [wrapper, String(seconds), process.execPath, '-e', script], {encoding: 'utf8', timeout: 20000});
const alive = pid => {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
};

test('a command that finishes in time keeps its output and exit code', () => {
  const result = run(10, 'console.log("done"); process.exit(3)');
  assert.equal(result.status, 3);
  assert.equal(result.stdout.trim(), 'done');
});

test('a stuck command fails the check and its whole process tree is stopped, even processes that ignore SIGTERM', () => {
  // Like a stuck test file: a child spinning in a synchronous loop, holding the output pipe,
  // whose SIGTERM handler can never run, under a parent that is spinning too.
  const stuck = 'process.on("SIGTERM",()=>{});require("fs").writeSync(1,"child "+process.pid+"\\n");for(;;){}';
  const script = `const {spawn}=require("child_process");spawn(process.execPath,["-e",${JSON.stringify(stuck)}],{stdio:["ignore","inherit","inherit"]});setTimeout(()=>{require("fs").writeSync(1,"parent "+process.pid+"\\n");for(;;){}},100);`;
  const result = run(0.5, script);
  const pids = [...result.stdout.matchAll(/(?:child|parent) (\d+)/g)].map(match => Number(match[1]));
  try {
    assert.equal(result.error, undefined, 'the time limit returned before the caller had to give up');
    assert.equal(result.status, 124);
    assert.match(result.stderr, /Time limit: .* ran longer than 0\.5s and was stopped/);
    assert.equal(pids.length, 2);
    assert.deepEqual(pids.filter(alive), []);
  } finally {
    for (const pid of pids) if (alive(pid)) process.kill(pid, 'SIGKILL');
  }
});

test('the limit must be a positive number of seconds followed by a command', () => {
  assert.equal(spawnSync(process.execPath, [wrapper, 'soon', 'true']).status, 2);
  assert.equal(spawnSync(process.execPath, [wrapper, '5']).status, 2);
});
