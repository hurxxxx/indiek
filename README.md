# indiek

**Music from Korea, worth sharing.**

An independent music magazine introducing Korean musicians to listeners around the world. New artists and songs join a selection that follows personal taste across genres, labels and levels of fame.

[Visit indiek.com](https://indiek.com)

## Features

- Reported song stories and listening features, with source notes and an open invitation for contributor pitches.
- A searchable A–Z artist directory, with band/solo filters, introductions, listening notes and release information in English.
- Short listening guides, related recommendations, an RSS feed and page-specific sharing cards.
- Official YouTube videos and live performances, with Apple Music release links.
- One shared YouTube player: a centered listening window on desktop and a bottom dock on mobile, moving beside the page in short landscape views. Mobile playback starts without a popup; use YouTube’s fullscreen control for a larger view. Internal navigation, including Back and Forward, keeps playback running. Selecting another song uses the same player; closing it, reloading or leaving ends playback.
- Listening guides, artist and song search, and tracks saved in your browser with direct playback from Saved. Saved and search use independently scrolling lists with fixed controls. Saved remembers your place, highlights the current track and closes when a song is selected. Play all starts at the beginning of the first saved track and enables Auto-next. Previous/Next and Auto-next stay within reach. Auto-next follows the displayed order and stops after the last song. If the browser blocks playback, press play in the video.
- Responsive pages with keyboard navigation and reduced-motion support.

Built with HTML, CSS and JavaScript. Pages are generated as static files; no application server or database is required. “Agree & play” combines YouTube consent, connection and the first playback request. Later selections use “Play” during the same page session; if the browser blocks playback, use the video’s play button. Reloading resets this choice. Optional Matomo statistics use first-party cookies after explicit consent to measure visits, returning browsers and listening interactions. A compact cookie banner covers both cookies and statistics, with Cookie settings in the footer to change the choice; local previews are excluded.

Home opens with the latest [Story](https://indiek.com/stories/), followed by a rotating artist feature, the full listening list, recent additions and short guide introductions. [Artists](https://indiek.com/artists/) holds the complete catalogue; [Guides](https://indiek.com/notes/first-listens/) offers themed ways to explore it. Each story, artist and guide has its own shareable, directly loadable URL. Small JavaScript navigation keeps the shared player alive between these static pages, with no routing framework. Directory searches and filters stay in place during internal navigation.

## Getting started

Requires Node.js 22+ and Python 3 with Pillow (including WebP support). There are no npm dependencies. Install Pillow in a Python virtual environment with `python3 -m pip install Pillow` if it is not already available.

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
| `npm run promotion -- status` | Inspect the optional social publisher without posting |
| `npm run editorial -- status` | Inspect magazine scheduling and the current issue |

## Contributing

Content lives in `content/`, templates and browser code in `site/`, and build tools in `scripts/`. Edit these sources and include the rebuilt `dist/` files with your changes.

Magazine articles live in `content/stories/`, with bylines in `content/authors.json`. One article supplies its Stories page, home feature, search entry, RSS item, sitemap entry and sharing card. Drafts stay private. Published text must have matching factual and editorial reviews; editing the title, body, sources or metadata invalidates that approval. The [editorial skill](skills/indiek-editorial/SKILL.md) covers research and editing, while `editorial/topics.json` holds future angles. Article data records what has actually been published.

Curated guides use 3–5 catalogue tracks with an editorial note for each. Guides marked `draft` are excluded from public pages and browser data. Add a real `editorial.published` date when a page is released to include it in RSS and the latest section; preparation dates are not publication dates.

Run `npm run build && npm run check`, then check the affected pages on desktop and mobile. Follow the [repository guidelines](AGENTS.md) when adding artists or songs so related sections stay in sync. Magazine scheduling and hosting details are in the [deployment guide](deploy/README.md).

The optional publisher in `scripts/promotion/` gives a new published story priority in the daily social slot, otherwise researching current news about artists in the live catalogue. An explicitly requested immediate story share can use the same writing, review and publishing workflow without changing the schedule. It uses the official Threads API, with an Instagram version when a relevant image has documented reuse rights. It runs separately from the website and follows the shared [social writing guide](promotion/voice.md). Scheduling, authorization and recovery are covered in the [deployment guide](deploy/README.md#sns-자동-게시). Actual attempts are recorded in the [promotion log](docs/promotion.md).

## Credits and contact

Music, photographs and release artwork belong to their respective rights holders. Content sources and image-rights records are maintained in `content/`; source credit is not permission to reuse an asset. Font licences are included in `dist/assets/`.

For corrections, questions or image removal requests, contact [gw@lumejs.com](mailto:gw@lumejs.com).
