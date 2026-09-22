# Extensions

Master Reader supports **runtime extensions**: JavaScript sources that add content from other
platforms without shipping a new app build. This is the same idea as ArcReader/Aidoku-style
source systems.

Because Hermes (React Native's JS engine) has no `eval`, extensions run inside a **hidden
WebView sandbox**. Network access is bridged back to the app, so requests go through the
cached, rate-limited, offline-aware transport and are never blocked by CORS. The WebView still
provides `DOMParser`, `fetch` and timers, so HTML scraping is straightforward.

## Installing

Settings → Sources → Extensions. You can install from a URL (a `.js` file) or paste code
directly. The host evaluates the extension once, validates its manifest, and stores it. Each
extension can be enabled/disabled or removed.

## Extension API

An extension is a single JavaScript file that calls `registerSource(definition)`:

```js
registerSource({
  id: 'com.example.example', // unique, dotted identifier (required)
  name: 'Example', // display name (required)
  version: '1.0.0', // (required)
  lang: 'en', // (optional, default 'en')
  baseUrl: 'https://example.com', // (required, http(s))
  capabilities: ['popular', 'latest', 'search', 'tags', 'categories'],
  description: 'Optional description',
  nsfw: false,

  async getPopular(request) {}, // request: { page?: number }
  async getLatest(request) {},
  async search(filters, request) {},
  async getStory(id, options) {}, // options: { includeContent?: boolean }
  async getTags() {}, // -> string[]
  async getCategories() {}, // -> { id, name }[]
});
```

Methods return plain JSON. The host stamps `sourceId` onto every story and page, so extensions
only need to provide the fields:

```ts
type PagedResult = { items: Story[]; page: number; hasNext: boolean; total?: number };
type Story = {
  id: string;
  title: string;
  authorId?: string | null;
  authorName?: string | null;
  description?: string | null;
  categoryName?: string | null;
  lang?: string | null;
  url?: string | null;
  coverUrl?: string | null;
  rating?: number | null;
  views?: number | null;
  wordCount?: number | null;
  publishedAt?: number | null; // unix seconds
  tags?: string[];
  flags?: { isNew?: boolean; isHot?: boolean; isWritersPick?: boolean; isContestWinner?: boolean };
};
type StoryPage = { index: number; title?: string | null; content?: string | null };
```

`getStory` returns `Story & { pages?: StoryPage[]; seriesId?: string | null }`.

### Network access

Use the sandbox `host` object instead of `fetch` so requests are cached and offline-aware:

```js
const response = await host.request({
  url: 'https://example.com/api/stories',
  method: 'GET', // GET is cached; others are not
  query: { page: 1, q: 'dragons' }, // appended and URL-encoded
  headers: { 'x-custom': 'value' },
  body: { any: 'json' }, // JSON-encoded for non-GET
});
// response: { ok: boolean, status: number, text: string }
```

`host.log(message)` writes to the app log. Network failures reject the promise; non-2xx
responses resolve with `ok: false` so you can handle them.

## Security

Extensions are third-party code. They cannot use the filesystem, database or OS APIs — only the
WebView environment and the bridged `host.request`. Only install extensions you trust. Master
Reader is not affiliated with any extension author or the sources they access; you are
responsible for complying with the terms of service of any source you add.

## Example

See [examples/example-source.js](./examples/example-source.js).
