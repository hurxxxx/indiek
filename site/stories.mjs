export const storyPath = story => `/stories/${story.slug}/`;
export const storyText = story => story.blocks.filter(b => b.text).map(b => b.text).join('\n\n');
export const storyMinutes = story => Math.max(1, Math.ceil(storyText(story).split(/\s+/).length / 220));
export function publicStories(stories, now = new Date()) {
  return stories.filter(s => s.status === 'published' && Date.parse(s.published + 'T00:00:00+09:00') <= now.getTime())
    .sort((a,b) => b.published.localeCompare(a.published) || a.id.localeCompare(b.id));
}
export function storyIndex(stories) {
  return stories.map(s => ({id:s.id,slug:s.slug,title:s.title,description:s.description,category:s.category,published:s.published,artistIds:s.artistIds,keywords:s.keywords,path:storyPath(s)}));
}
export function searchStories(stories, query) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return stories.filter(s => terms.every(t => [s.title,s.description,s.category,...s.keywords].join(' ').toLocaleLowerCase().includes(t)));
}
