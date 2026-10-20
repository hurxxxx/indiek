#!/usr/bin/env python3
"""Install outside the repository as the forced command for the publishing key."""
import fcntl
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request

ROOT = '/projects/indiek'
def run(*args, cwd=ROOT):
    return subprocess.check_output(args, cwd=cwd, stderr=subprocess.STDOUT, timeout=300, text=True).strip()
def main():
    with open('/var/lock/indiek-editorial.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        request = json.loads(sys.stdin.readline(1024))
        sha = request.get('sha', '')
        if set(request) != {'sha'} or not re.fullmatch('[a-f0-9]{40}', sha):
            raise ValueError('Expected one commit SHA')
        if run('git', 'status', '--porcelain'):
            raise ValueError('Production checkout is not clean')
        previous = run('git', 'rev-parse', 'HEAD')
        run('git', 'fetch', 'origin', 'main')
        if sha != run('git', 'rev-parse', 'origin/main'):
            raise ValueError('Only current origin/main may be deployed')
        run('git', 'merge-base', '--is-ancestor', previous, sha)
        if previous == sha:
            print(json.dumps({'status': 'already-deployed', 'sha': sha}))
            return
        files = run('git', 'diff', '--name-only', previous, sha).splitlines()
        if not files or any(not (f.startswith('dist/') or re.fullmatch(r'content/stories/[a-z0-9-]+\.json', f)) for f in files):
            raise ValueError('Automatic deployment is restricted to article content and generated dist')
        modes = run('git', 'ls-tree', '-r', sha, '--', 'dist', 'content/stories').splitlines()
        if any(line.startswith(('120000', '160000')) for line in modes):
            raise ValueError('Symlinks and submodules are not allowed')
        work = tempfile.mkdtemp(prefix='indiek-publish-')
        os.rmdir(work)
        try:
            run('git', 'worktree', 'add', '--detach', work, sha)
            run('npm', 'run', 'check', cwd=work)
        finally:
            run('git', 'worktree', 'remove', '--force', work)
        try:
            run('git', 'merge', '--ff-only', sha)
            with urllib.request.urlopen('https://indiek.com/promotion-catalogue.json', timeout=20) as response:
                if response.status != 200:
                    raise ValueError('Public manifest unavailable')
                public = json.load(response)
            with open(os.path.join(ROOT, 'dist/promotion-catalogue.json')) as file:
                if public != json.load(file):
                    raise ValueError('Public manifest differs from deployed build')
        except Exception:
            if run('git', 'rev-parse', 'HEAD') == sha and not run('git', 'status', '--porcelain'):
                run('git', 'reset', '--hard', previous)
            raise
        print(json.dumps({'status': 'deployed', 'sha': sha, 'previous': previous}))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
