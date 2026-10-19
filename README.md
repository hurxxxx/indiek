# indiek

**Music from Korea, worth sharing.**

An independent, non-commercial music journal introducing Korean musicians to listeners around the world. The selection follows personal taste across genres, labels and levels of fame.

[Visit indiek.com](https://indiek.com)

## Features

- Artist introductions, listening notes and release information in English.
- Official YouTube videos and live performances, with Apple Music release links.
- One shared YouTube player in a centered listening window, with saved tracks alongside it (below on mobile). Minimize it to browse, or expand it again without restarting. Fullscreen controls and uninterrupted playback during internal navigation, including Back and Forward. Saved tracks play in the displayed order with Auto-next on, stopping at the last song and skipping YouTube-only links. Previous/Next and Auto-next controls are available; if the browser blocks playback, press play in the video. Selecting another song changes the video in the same player; closing the player, reloading or leaving the site ends playback.
- Listening guides, artist and song search, and tracks saved in your browser with direct playback from Saved. On mobile, minimizing docks the visible video below a separate scrolling area for reading.
- Responsive pages with keyboard navigation and reduced-motion support.

Built with HTML, CSS and JavaScript. Pages are generated as static files; no application server or database is required. “Agree & play” combines YouTube consent, connection and the first playback request. Later selections use “Play” during the same page session; if the browser blocks playback, use the video’s play button. Reloading resets this choice. Optional, cookieless visit statistics use self-hosted Matomo after consent; the choice can be changed from the footer.

## Getting started

Requires Node.js 18+ and Python 3. No npm dependencies to install.

```sh
git clone https://github.com/hurxxxx/indiek.git
cd indiek
npm run dev
```

Open [localhost:4173](http://127.0.0.1:4173). After editing files, rebuild and refresh the page.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Build and serve the local preview |
| `npm run build` | Generate the site in `dist/` |
| `npm run check` | Check catalogue behavior, pages, links and assets |
| `npm run images` | Generate responsive images; requires Pillow with WebP support |

## Contributing

Content lives in `content/`, templates and browser code in `site/`, and build tools in `scripts/`. Edit these sources and include the rebuilt `dist/` files with your changes.

Run `npm run build && npm run check`, then check the affected pages on desktop and mobile. Follow the [repository guidelines](AGENTS.md) when adding artists or songs so related sections stay in sync. Hosting details are in the [deployment guide](deploy/README.md).

## Credits and contact

Music, photographs and release artwork belong to their respective rights holders. Content sources and image-rights records are maintained in `content/`; source credit is not permission to reuse an asset. Font licences are included in `dist/assets/`.

For corrections, questions or image removal requests, contact [gw@lumejs.com](mailto:gw@lumejs.com).
