// Runs the Rust API tests (api/) as part of `npm run check` when cargo is on PATH.
// Without cargo, or with INDIEK_SKIP_API_TESTS=1, it reports the skip and succeeds, so the
// site checks on servers without a Rust toolchain keep working unchanged.
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (process.env.INDIEK_SKIP_API_TESTS === '1') {
  console.log('API tests skipped (INDIEK_SKIP_API_TESTS=1).');
  process.exit(0);
}
const probe = spawnSync('cargo', ['--version'], {encoding: 'utf8'});
if (probe.error || probe.status !== 0) {
  console.log('API tests skipped: cargo is not on PATH.');
  process.exit(0);
}
const result = spawnSync('cargo', ['test', '--locked', '--quiet', '--manifest-path', path.join(root, 'api/Cargo.toml')], {stdio: 'inherit'});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
