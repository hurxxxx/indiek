# indiek deployment

- Public URL: `https://indiek.com`; `www.indiek.com` redirects to the apex.
- Checkout: `/projects/indiek`, branch `main`, remote `https://github.com/hurxxxx/indiek.git`.
- Web root: `/projects/indiek/dist`. Nginx serves static files; no Node process, backend port, Docker container or PM2 service is required.
- Nginx configuration: `/etc/nginx/sites-available/indiek.com`, linked from `sites-enabled`.
- The existing server configures TLS and HTTP/2 on shared IPv4/IPv6 port 443 listeners. This site's `listen` directives inherit those socket options. On a different server, explicitly configure TLS/HTTP2 listeners before using this file.
- Certificate: `/etc/letsencrypt/live/indiek.com/`, covering both names. Certbot uses the webroot `/var/www/letsencrypt` and the existing `certbot.timer`.
- Certificate renewal deploy hook: validate and reload Nginx. Private keys stay in `/etc/letsencrypt`, outside the checkout and web root.
- Routine access logging is disabled for these virtual hosts. Error logging uses `/var/log/nginx/indiek.error.log`, covered by the server's existing Nginx log rotation.

## Update

Run the build and checks in the local checkout before committing and pushing. On the server, update only this checkout:

```sh
cd /projects/indiek
git status --short
git pull --ff-only origin main
npm run check
```

The built `dist/` is committed, so a source-only change must be built before pushing. Node 18 or later and Python 3 are sufficient for build/check; no npm dependencies are required. Image regeneration is a separate local step that requires Pillow.

Nginx does not need a reload for content-only updates. To apply a reviewed webserver change, copy `deploy/nginx.conf` to the site's configuration, run `nginx -t`, and reload only if validation succeeds. Preserve other virtual hosts. Before replacing a live configuration, keep a dated backup outside `sites-enabled`.

## Verification and recovery

Check the homepage, artist deep links, `/shared.mjs` content type, sharing image, `/sitemap.xml`, and HTTP/www redirects. A browser check should cover search and an explicitly loaded YouTube player, because CSP and module MIME types can affect functionality even when HTML returns 200.

Record the previous commit before an update. If rollback is needed, verify the worktree is clean and check out that known commit without changing unrelated services. Restore the site's saved Nginx configuration if the configuration changed, validate, and reload. Keep SSH connection details in the local-only `SERVER_ACCESS.md`.
