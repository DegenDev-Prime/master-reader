# Creator-archive sources: Pawchive and Kemono

Research for adding `pawchive` and `kemono` as reader sources. Both are public
archives of creator posts (Patreon, Pixiv Fanbox, Discord, Gumroad, …) and both
expose a documented JSON API. They are _not_ novel sites, but their data model
maps cleanly onto the reader's model: a creator is a story, a post is a chapter.

## API shape (verified live)

### Pawchive — `https://pawchive.pw/api/v1`

`pawchive.st` redirects to `pawchive.pw`.

| Endpoint                                        | Result                                                 |
| ----------------------------------------------- | ------------------------------------------------------ |
| `GET /creators`                                 | All 97k creators. ~15 MB uncompressed, 2.8 MB gzipped. |
| `GET /posts?o=<offset>&q=<query>`               | 50 recent posts. `o` is the offset, `q` filters.       |
| `GET /{service}/user/{creatorId}`               | 50 posts of one creator.                               |
| `GET /{service}/user/{creatorId}/post/{postId}` | One post, with full `content` HTML.                    |
| `GET /{service}/user/{creatorId}/profile`       | Creator profile.                                       |
| `GET /{service}/user/{creatorId}/tags`          | Creator tags with post counts.                         |

### Kemono — `https://kemono.cr/api/v1`

| Endpoint                                | Result                                         |
| --------------------------------------- | ---------------------------------------------- |
| `GET /posts`                            | `{ count, true_count, posts[] }`. 50 per page. |
| `GET /creators.txt`                     | 404 on the current deployment.                 |
| `GET /{service}/user/{creatorId}/posts` | 404 on the current deployment.                 |

Kemono's documented routes (`/creators.txt`, `/{service}/user/{id}`) are not
served by the current deployment, so only the recent-posts route is usable.
`/posts` returns a wrapper object; Pawchive returns a bare array.

### Required request header

Both APIs serve `403` to requests that look like a browser's default JSON
fetch. The trick — documented in the API's own error text and used by the
community clients — is to send `Accept: text/css`. Responses then come back as
`text/css` with a JSON body.

```
Accept: text/css
```

## Media hosts

| Kind      | Pawchive                                          | Kemono                         |
| --------- | ------------------------------------------------- | ------------------------------ |
| Thumbnail | `https://img.pawchive.pw/thumbnail/data{path}`    | `https://kemono.cr/data{path}` |
| Original  | `https://file.pawchive.pw/data{path}`             | `https://kemono.cr/data{path}` |
| Avatar    | `https://pawchive.pw/icons/{service}/{creatorId}` | —                              |

`file.pawchive.pw` answers `403` to a plain request; the thumbnail host and the
avatar route work. `data.kemono.net` does not resolve; `kemono.cr/data` does.

## Data shape

Creator:

```json
{
  "id": "30500811",
  "name": "BOKABA",
  "public_id": "BOKABA",
  "service": "patreon",
  "indexed": 1785423600,
  "updated": 1792274400,
  "favorited": 2739,
  "ever_imported": true
}
```

Post:

```json
{
  "id": "172633714",
  "user": "30500811",
  "service": "patreon",
  "title": " Nishikigi Chisato + Benefits",
  "content": "<p>…</p>",
  "published": "2026-10-17T15:26:22",
  "file": { "name": "Chisato_U(001).jpg", "path": "/b2/88/….jpg" },
  "attachments": [{ "name": "…", "path": "/…" }]
}
```

## Mapping onto the reader

- **Creator → story.** `id` is the creator id, `name` the title, `service` the
  platform badge, `favorited` the rating, `updated` the recency signal.
- **Post → chapter.** `id` is the chapter id, `title` the chapter title, the
  post's `content` HTML is the chapter body, and `file`/`attachments` become
  the images the block renderer already understands.
- **Listing** uses `GET /posts`, newest first, which is already a chapter-shaped
  feed. `GET /creators` is the discovery list but is 15 MB, so it is only
  fetched lazily and cached.

## Constraints

- `POST /{service}/user/{creatorId}/post/{postId}/flag` and the favourites
  routes need a session. The app never authenticates, so only the public
  routes are used.
- Both sites rate-limit: repeated hits answer `429`. The HTTP client already
  retries with backoff, which covers the burst a chapter list causes.
- Content is adult in many cases. The app's existing 18+ age gate covers this,
  and the sources are opt-in like every other source.
