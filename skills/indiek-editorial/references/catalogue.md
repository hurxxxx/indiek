# Catalogue entries

Rules for artist and song entries in `content/catalogue.json`, written by hand or by the catalogue pipeline (`npm run catalogue`). The [editing criteria](editing.md) still apply, including [lyric commentary](editing.md#lyric-commentary). The repository's `AGENTS.md` remains the authority for site structure.

## Voice

Write as a music lover passing on a song they like: plain, specific and warm. The first introduction is short. For each song, put a concrete story or feature first and leave detailed history and release information for later. Do not tell readers in what order to listen or what to feel, and do not repeat abstract recommendations ("a must-listen", "hidden gem", "transcends language"). Write only background you verified. Never invent the operator's or anyone's listening experience, memories, attendance or reactions; never describe how a recording sounds unless an attributed source says so. Do not create friendliness with forced slang, typos or extra explanation.

## Fields

- `artistIntro`: one or two sentences on what this artist does that is specific to them (writing subjects, line-up, role in a scene). No career list.
- `biography`: one or two sentences of checked career facts (debut, line-up, notable releases), each traceable to `artistSource` or another cited source.
- `note`: one short line about the song, under about 70 characters, such as "On letting go and getting through the day."
- `description`: one to three sentences: what the song is about or a documented choice behind it (who wrote it, what it answers, why it was made). No adjectives standing in for facts.
- `listeningNote` ("A little background"): sourced context such as the release, an artist statement or a drama the song was written for. Attribute statements. Its sources go in `extraSources` (or `lyricNotes.backgroundSources`).
- `credits`: from an official credit source (label release page, Melon, Genie, Bugs or the album booklet), in the form "Lyrics by …; music by …; arranged by …." Romanise names as the artist does in English, with Hangul in parentheses when no official romanisation exists. If credits cannot be confirmed, leave them out and report the gap.
- `lyricNotes` (grade A only): `heading`, one to three `themes`, two or three English `paragraphs`, the lyric `source` page and attributed `backgroundSources`. Follow the lyric commentary criteria. No full lyrics or full translations; quote at most a short phrase when it helps understanding, and do not use `excerpt` unless a brief quotation is essential.

Use the official English title and release name as shown on Apple Music (US storefront) and the Korean title in Hangul. Explain a difference between the English and Korean titles only when it affects understanding.

## Recordings and links

- Use an official YouTube video: the artist's, label's, distributor's or broadcaster's own channel, or the YouTube "Topic" audio. Prefer an official live performance when one exists; otherwise a music video, lyric video or Topic audio. `videoType` must match what the video actually is (`live`, `music-video`, `lyric-video`, `audio`).
- The pipeline confirms that the video actually plays inside an embedded player. A video that refuses embedding or fails to play is replaced, never kept because an oEmbed response exists.
- Release information links to the English Apple Music page (`https://music.apple.com/us/…`), with `sourceName` "<Artist> — <Release> on Apple Music".
- Release artwork comes from Apple Music and is recorded in `content/image-rights.json` with its source; credit is not permission to reuse.

## Grades

- **B:** credits, sourced background, the verified official recording, a short introduction and the English Apple Music link.
- **A:** everything in B plus lyric commentary.

Song pages are indexed only when credits, Apple Music, sourced background and lyric notes are all present. Never fill a gap with placeholder text so that a page qualifies.

## Sources

Every factual clause needs an opened original: label or agency pages, official platform credits (Melon, Genie, Bugs, Apple Music), broadcaster pages and interviews by identifiable publishers. Search snippets are leads, not evidence. Record the URL, label and language of each source, and keep the research dossier with the review in `editorial/catalogue/ledger.json`.
