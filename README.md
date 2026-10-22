# indiek

**Music from Korea, worth sharing.**

An independent music magazine introducing Korean musicians to listeners around the world. New artists and songs join a selection that follows personal taste across genres, labels and levels of fame.

[Visit indiek.com](https://indiek.com)

## Features

- Reported song stories and listening features, with source notes and an open invitation for contributor pitches.
- A searchable A–Z artist directory, with band/solo filters, introductions, listening notes and release information in English.
- Short listening guides, related recommendations and page-specific sharing cards.
- Official YouTube videos and live performances, with Apple Music release links.
- One shared YouTube player: a centered listening window on desktop and a bottom dock on mobile, moving beside the page in short landscape views. Mobile playback starts without a popup; use YouTube’s fullscreen control for a larger view. Internal navigation, including Back and Forward, keeps playback running. Selecting another song uses the same player; closing it, reloading or leaving ends playback.
- Listening guides, artist and song search, and tracks saved in your browser with direct playback from Saved. Saved and search use independently scrolling lists with fixed controls. Saved remembers your place, highlights the current track and closes when a song is selected. Play all starts at the beginning of the first saved track and enables Auto-next. Previous/Next and Auto-next stay within reach. Auto-next follows the displayed order and stops after the last song. If the browser blocks playback, press play in the video.
- Responsive pages with keyboard navigation and reduced-motion support.

Built with HTML, CSS and JavaScript. Pages are generated as static files; no application server or database is required. “Agree & play” combines YouTube consent, connection and the first playback request. Later selections use “Play” during the same page session; if the browser blocks playback, use the video’s play button. Reloading resets this choice. Optional Matomo statistics use first-party cookies after explicit consent to measure visits, returning browsers and listening interactions. A compact cookie banner covers both cookies and statistics, with Cookie settings in the footer to change the choice; local previews are excluded.

Home opens with **New on indiek**, followed by a rotating artist feature, two short artist introductions and the full listening list. The lead [Story](https://indiek.com/stories/) follows the artist section, and themed guides appear as compact links further down. The four update cards mix new artists, songs, stories and guides with substantial additions to existing pages. [Artists](https://indiek.com/artists/) holds the complete catalogue; [Guides](https://indiek.com/notes/first-listens/) offers themed ways to explore it. Each story, artist and guide has its own shareable, directly loadable URL. Small JavaScript navigation keeps the shared player alive between these static pages, with no routing framework. Directory searches and filters stay in place during internal navigation.

## Getting started

Requires Node.js 22+ and Python 3 with Pillow (including WebP support). There are no npm dependencies. Install Pillow in a Python virtual environment with `python3 -m pip install Pillow` if it is not already available.

```sh
git clone https://github.com/hurxxxx/indiek.git
cd indiek
npm run dev
```

Open [localhost:4173](http://127.0.0.1:4173). After editing files, run `npm run build:preview` and refresh the page. If the server is already running, rebuilding is enough.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Build and serve the local preview, including ready home updates |
| `npm run build:preview` | Rebuild the local preview in `dist/` without restarting the server |
| `npm run build` | Generate the publication build in `dist/`; omit unpublished home updates |
| `npm run check` | Check catalogue behavior, pages, links and assets |
| `npm run images` | Generate responsive images; requires Pillow with WebP support |
| `npm run promotion -- status` | Inspect the optional social publisher without posting |
| `npm run editorial -- status` | Inspect magazine scheduling and the current issue |

## Contributing

Content lives in `content/`, templates and browser code in `site/`, and build tools in `scripts/`. Edit these sources and include the rebuilt `dist/` files with your changes.

### Artists and tracks

`content/catalogue.json` uses `schemaVersion: 2`. It is the authoring source; a database or backend stack is not required. `scripts/catalogue.mjs` validates relationships and supplies resolved records to the build, editorial publisher and page checker.

- `artists` holds each artist once: a stable `id`, name and aliases, introduction, biography, sources, page publication dates and `primaryTrackId`. `moreTracks` remains a list of external listening links; `performances` holds full sessions that use the shared player but stay outside Saved and song counts.
- `tracks` holds each introduced song once, with its own stable `id` and `artistId`, title, release, cover, description, recording and guide tags. Multiple songs may refer to one artist. Do not copy artist biography or identity fields into tracks.
- `editorPickTrackId` preserves the legacy track excluded from Saved; it does not control the home recommendation. `featuredArtists.id` references an artist and supplies shared photographs for the directory and artist pages. Home-specific copy and image overrides live in `content/home.json`. Guides reference songs through `trackIds`, with context-specific `trackNotes` and `trackDetails`; `nextArtistId`, `featuredArtistId` and `cardImageArtistId` reference artists.

To add a song to an existing artist, add a track with a new ID and that artist’s `artistId`; supply its recording, release, sources and automatic guide classification. Keep `primaryTrackId` unless deliberately changing the page’s opening selection. A new artist also needs an artist entry pointing to its first track. The build rejects duplicate IDs, missing artists or primary tracks, invalid guide references, unclassified songs and playback ID collisions. Video metadata validation does not establish embeddability; new recordings still require an actual player check.

Each introduced track has `lyricNotes`: a `heading`, `themes`, English `paragraphs` and a lyric `source` (`url`, `label`, `language`). Optional `backgroundSources` use the same source shape for attributed artist context. Commentary is the default: follow the [lyric commentary criteria](skills/indiek-editorial/references/editing.md#lyric-commentary) for a clear, measured explanation grounded in the lyrics. An `excerpt` (`korean`, `english`, `note`) is optional and used only when a brief quotation helps. Translation is a separate, explicitly requested task. Research and exact-draft reviews are linked from [the lyric content guide](docs/lyrical-themes.md). The opening song keeps `#lyrics`; additional songs use `#lyrics-<track-id>`.

An explicitly requested, supplied English adaptation can use `lyricNotes.translation` with a plain-text `label` and `stanzas` array. Newlines preserve verse lines; blank lines separate stanzas. `paragraphs` may be empty when an adaptation is present, so explanatory prose is not mandatory. Keep its supplied-text provenance in the editorial research record and distinguish it from an official translation.

Artists and the hero use one entry per artist. The Listening Room, search and automatic guides include every introduced song; an artist-directory song search returns its artist once. The introductory guide’s follow-on list supplies one primary song for each artist absent from its curated selection. Artist pages render additional songs using the existing track layout, with separate play/save controls and anchors; a repeated release cover appears once per page.

Preserve existing artist IDs, track IDs and the `indiek-saved-v1` storage key. Historical track IDs such as `ydbb` remain song IDs even though they match an artist ID; never reassign an old ID to another song. The opening song uses `/artists/<artist-id>/#listen`, additional songs use `#track-<track-id>`, and full sessions keep their existing anchors. The generated `records` and `editorPick` views in `dist/catalogue.js` are outputs, not a second editing source. `npm run build && npm run check` also tests a multi-song catalogue in an isolated temporary build.

### Home composition

`content/home.json` is the home editing source (`schemaVersion: 1`). The site still builds static HTML; no backend stack is needed. `title` and `description` supply home metadata. The ordered `sections` array controls placement; each entry has a stable `id`, a registered `type`, `enabled` and `copy`. Change copy, reorder entries or set `enabled: false` without editing templates. Counts and content facts come from the catalogue, not hand-maintained copy.

| Section type | Selection and editing |
| --- | --- |
| `masthead` | Brand introduction and short lines in `copy`; `\n` gives a line break. |
| `updates` | Heading and introduction in `copy`; items still follow [Home updates](#home-updates). |
| `story` | `storyId: null` selects the newest public story, or specify a published story ID. Only the visible lead is excluded from updates. |
| `discover` | `features` sets the preferred artist order and home `title`/`deck`; unlisted artists append automatically. Optional image overrides use `image`, `alt`, `kind` and `position`, with existing media metadata and credits. `spotlightArtistIds` selects up to two artists for short side introductions; available lyric notes, full sessions, published stories and further songs supply up to three links, with a song introduction as fallback. `trackOrder` puts selected songs first in the Listening Room, followed by all remaining songs. |
| `directory` | Invitation copy; the link and full artist count are automatic. |
| `pick` | `trackId` selects any catalogue song. Optional `copy.description` is home-only; omitted values use the song description. Release details and save eligibility follow the selected song. This never changes `editorPickTrackId`, song IDs or existing Saved entries. |
| `guides` | `guideOrder` puts selected public guides first; the rest append. `layout: "links"` shows the compact home list; `"cards"` restores illustrated cards. Copy and membership remain with each guide. |
| `closing` | Home closing text and About link label. |

Each current type appears at most once because its design has singleton controls and anchors. Sections may be omitted or disabled; legacy `/#discover`, `/#records`, `/#editors-pick`, `/#notes` and `/#about` then retain useful directory/guide/About links. Hiding the masthead retains an accessible page heading. Hidden configurations are still validated; remove an obsolete reference when deleting its source content.

Hero decks allow only `<em>` emphasis; other copy is plain text, never layout HTML. Hero images take priority, then the lead story, pick and guide cards. A guide whose preferred cover is already used selects an unused cover from its own members, preserving other guides' available preferred covers first. If no member cover remains, its image is omitted; check every card in the preview and add a distinct credited artist photo to free a cover when needed. Story/pick covers already used elsewhere are omitted, regardless of section order. Duplicate hero photos require a different credited image. New artists and songs still enter the full hero/Listening Room automatically; these are not limited to the preferred IDs.

For a new home photo, add the source asset and its entry in `content/image-rights.json`, reference it in the home feature, and run `npm run images` before building. Image preparation includes home-only overrides, including hidden configurations.

For a new visual section, add its validation/resolution/rendering entry in `scripts/home.mjs` and its markup under `site/templates/home/` (or a dedicated renderer), then style it in `site/styles.css`. Layout, responsive behavior and interaction belong to those files; they are not fixed by the JSON format. Reuse catalogue IDs and the common player. Keep the wrapper `site/templates/home.html` independent of section designs. Add coverage for new selection rules and update `scripts/check.py` if a new section adds catalogue output checks.

Run `npm run build && npm run check`, then inspect desktop and mobile. The checks include isolated builds with reordered/hidden sections and changed recommendations; the production configuration is never modified by those tests. `npm run build:preview` also uses this configuration while including ready update announcements.

### Magazine and guides

Magazine articles live in `content/stories/`, with bylines in `content/authors.json`. One article supplies its Stories page, home feature, search entry, sitemap entry and sharing card. Drafts stay private. Published text must have matching factual and editorial reviews; editing the title, body, sources or metadata invalidates that approval. The [editorial skill](skills/indiek-editorial/SKILL.md) covers research and editing, while `editorial/topics.json` holds future angles. Article data records what has actually been published.

Curated guides use 3–5 catalogue tracks with an editorial note for each. Guides marked `draft` are excluded from public pages and browser data. Add a real `editorial.published` date when a page is released to include it in home updates; preparation dates are not publication dates.

### Home updates

Newly published artist pages, stories and guides enter **New on indiek** automatically. For a new song on an existing page, lyric notes, a live session or another substantial addition, add an announcement to `content/updates.json`. This file can also supply more specific wording for a new artist, as with gongwon and Yebit.

Each announcement has a stable `id`, `status`, `kind`, local `path`, `title` and a brief `description` saying what was added. Supported kinds are `artist`, `song`, `lyrics`, `live`, `story`, `guide` and `update`. Link to the relevant page or section, such as `/artists/gongwon/#lyrics`. New videos still belong in the catalogue and use the common player; announcements do not create extra tracks or players.

- `draft` is omitted from every build. Use `ready` for an announcement to review locally; it appears only in `build:preview` and `dev`, without a publication date.
- On actual release, set `status` to `published` and record `published` as `YYYY-MM-DD`. A newly released target page also needs its own first publication date. For additions to older pages whose first publication date is unknown, record the announcement date without inventing an original date. Future dates are excluded, including from previews.
- Published items sort by announcement or first publication date. A manual announcement takes precedence on the same day. Only the newest item for each destination page appears; the lead magazine story is already featured separately. At most four cards appear, with no carousel or permanent pinning.
- Keep first publication dates unchanged. Fixing a typo or changing `updated` does not create an announcement. Add an entry when there is something worth returning to, and describe that change directly.
- Home announcements do not change social publishing schedules.

Before deployment, use `npm run build` to replace the local preview output. `build:preview` is for local review, not deployment.

Run `npm run build && npm run check`, then check the affected pages on desktop and mobile. Follow the [repository guidelines](AGENTS.md) when adding artists or songs so related sections stay in sync. Magazine scheduling and hosting details are in the [deployment guide](deploy/README.md).

The optional publisher in `scripts/promotion/` gives a new published story priority in the daily social slot, otherwise researching current news about artists in the live catalogue. An explicitly requested immediate story share can use the same writing, review and publishing workflow without changing the schedule. It uses the official Threads API, with an Instagram version when a relevant image has documented reuse rights. It runs separately from the website and follows the shared [social writing guide](promotion/voice.md). Scheduling, authorization and recovery are covered in the [deployment guide](deploy/README.md#sns-자동-게시). Actual attempts are recorded in the [promotion log](docs/promotion.md).

## Credits and contact

Music, photographs and release artwork belong to their respective rights holders. Content sources and image-rights records are maintained in `content/`; source credit is not permission to reuse an asset. Font licences are included in `dist/assets/`.

For corrections, questions or image removal requests, contact [gw@lumejs.com](mailto:gw@lumejs.com).
