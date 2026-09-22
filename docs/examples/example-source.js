// Example Master Reader extension.
//
// Install it from Settings -> Sources -> Extensions by pasting this code or
// hosting it at an http(s) URL. It demonstrates the whole extension contract
// against a fictional JSON API.

registerSource({
  id: 'com.example.example',
  name: 'Example Source',
  version: '1.0.0',
  lang: 'en',
  baseUrl: 'https://example.com',
  capabilities: ['popular', 'latest', 'search', 'tags'],
  description: 'A minimal reference extension.',

  async getPopular(request) {
    const page = (request && request.page) || 1;
    const response = await host.request({
      url: 'https://example.com/api/stories',
      query: { page, sort: 'popular' },
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);

    const data = JSON.parse(response.text);
    return {
      page,
      hasNext: data.items.length > 0,
      total: data.total,
      items: data.items.map(mapStory),
    };
  },

  async getLatest(request) {
    const page = (request && request.page) || 1;
    const response = await host.request({
      url: 'https://example.com/api/stories',
      query: { page, sort: 'newest' },
    });
    const data = JSON.parse(response.text);
    return { page, hasNext: data.items.length > 0, items: data.items.map(mapStory) };
  },

  async search(filters, request) {
    const page = (request && request.page) || 1;
    const response = await host.request({
      url: 'https://example.com/api/search',
      query: { q: (filters && filters.query) || '', page },
    });
    const data = JSON.parse(response.text);
    return { page, hasNext: false, items: data.items.map(mapStory) };
  },

  async getStory(id, options) {
    const response = await host.request({ url: 'https://example.com/api/story/' + id });
    if (!response.ok) throw new Error('HTTP ' + response.status);

    const data = JSON.parse(response.text);
    const story = mapStory(data);
    if (options && options.includeContent === false) return story;
    return {
      ...story,
      seriesId: data.seriesId || null,
      pages: (data.pages || []).map(function (content, index) {
        return { index: index, title: null, content: content };
      }),
    };
  },

  async getTags() {
    const response = await host.request({ url: 'https://example.com/api/tags' });
    return JSON.parse(response.text).tags;
  },
});

function mapStory(item) {
  return {
    id: String(item.id),
    title: item.title,
    authorName: item.author || null,
    description: item.summary || null,
    coverUrl: item.cover || null,
    rating: item.rating || null,
    views: item.views || null,
    wordCount: item.words || null,
    publishedAt: item.publishedAt || null,
    tags: item.tags || [],
    flags: { isNew: Boolean(item.isNew), isHot: Boolean(item.isHot) },
  };
}
