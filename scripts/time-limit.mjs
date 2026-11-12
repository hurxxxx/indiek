// Runs a command with a time limit for `npm run check`. When the limit passes it stops the
// command's whole process group (SIGTERM, then SIGKILL), so a stuck test fails the check
// instead of hanging it or leaving a spinning process behind after a caller's own timeout.
// Usage: node scripts/time-limit.mjs <seconds> <command> [args...]
import {spawn} from 'node:child_process';
import {constants} from 'node:os';

const [limit, name, ...args] = process.argv.slice(2);
const seconds = Number(limit);
if (!(seconds > 0) || !name) {
  console.error('Usage: node scripts/time-limit.mjs <seconds> <command> [args...]');
  process.exit(2);
}

// Its own process group, so one signal reaches the command and everything it started.
const child = spawn(name, args, {stdio: 'inherit', detached: true});
const signalGroup = signal => {
  try { process.kill(-child.pid, signal); return true; } catch { return false; }
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
// A process stuck in a synchronous loop never runs its SIGTERM handler, hence the SIGKILL.
async function stopGroup() {
  for (const [signal, wait] of [['SIGTERM', 2000], ['SIGKILL', 2000]]) {
    if (!signalGroup(signal)) return;
    for (let waited = 0; waited < wait; waited += 100) {
      await pause(100);
      if (!signalGroup(0)) return;
    }
  }
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => signalGroup(signal));
let timedOut = false;
const timer = setTimeout(async () => {
  timedOut = true;
  console.error(`\nTime limit: "${[name, args[0]].filter(Boolean).join(' ')}" ran longer than ${seconds}s and was stopped. A test may be stuck; run the test files one by one to find it.`);
  await stopGroup();
  process.exit(124);
}, seconds * 1000);
child.on('error', error => {
  console.error(error.message);
  process.exit(127);
});
child.on('exit', (code, signal) => {
  if (timedOut) return;
  clearTimeout(timer);
  process.exit(code ?? 128 + (constants.signals[signal] || 0));
});
