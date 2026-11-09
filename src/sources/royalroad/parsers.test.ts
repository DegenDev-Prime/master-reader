import { describe, expect, it } from 'vitest';

import { loadTextFixture } from '@/test-utils/fixtures';

import { parseAuthorPage, parseChapterContent, parseFiction, parseListing } from './parsers';

const listing = () => loadTextFixture('listing.html', 'royalroad');
const book = () => loadTextFixture('book.html', 'royalroad');
const author = () => loadTextFixture('author.html', 'royalroad');
const chapter = () => loadTextFixture('chapter.html', 'royalroad');

describe('parseListing', () => {
  it('maps fiction cards', () => {
    const result = parseListing(listing(), 1);
    expect(result.stories).toHaveLength(2);
    expect(result.stories[0].id).toBe('21220');
    expect(result.stories[0].title).toBe('Mother of Learning');
    expect(result.stories[0].authorName).toBe('Nobody103');
    expect(result.stories[0].authorId).toBe('15870');
    expect(result.stories[0].rating).toBe(4.85);
    expect(result.stories[0].coverUrl).toBe(
      'https://www.royalroadcdn.com/public/covers-large/21220-mother-of-learning.jpg',
    );
    expect(result.stories[0].tags).toEqual(['Fantasy', 'Time Loop']);
  });

  it('detects a following page', () => {
    expect(parseListing(listing(), 1).hasNext).toBe(true);
    expect(parseListing(listing(), 2).hasNext).toBe(false);
  });

  it('maps the 2026 card layout (class order swapped, star rating, hidden description)', () => {
    // Structure from real captures of royalroad.com listing pages (2026):
    // the class token may sit after others, rating lives on the star span,
    // and the description is `#description-<id>` holding profile links that
    // are not authors.
    const html = `
      <html><body>
      <div class="row fiction-list-item">
        <figure class="col-sm-2 col-md-3 col-lg-2 text-center"><a href="/fiction/21220/mother-of-learning"><img data-type="cover" alt="Mother of Learning" src="https://www.royalroadcdn.com/public/covers-full/21220-mother-of-learning.jpg?time=1637247458"></a></figure>
        <div class="col-sm-10 col-md-8 col-lg-9 col-xs-12 search-content">
          <h2 class="fiction-title"><a href="/fiction/21220/mother-of-learning" class="font-red-sunglo bold">Mother of Learning</a></h2>
          <div class="margin-bottom-10">
            <span class="label label-default label-sm bg-blue-hoki">COMPLETED</span>
            <span class="tags">
              <input type="checkbox" id="showTags-21220" data-fiction-id="21220">
              <a class="label label-default label-sm bg-blue-dark fiction-tag" href="/fictions/search?tagsAdd=loop">Time Loop</a>
              <a class="label label-default label-sm bg-blue-dark fiction-tag" href="/fictions/search?tagsAdd=fantasy">Fantasy</a>
            </span>
          </div>
          <div class="row stats">
            <div class="col-sm-6 uppercase bold font-blue-dark" aria-label="Rating: 4.83 out of 5">
              <i class="fa fa-star"></i>
              <span class="font-red-sunglo star star-21220-overall-30a28c1d" title="4.83" aria-hidden="true"><style>.star-21220-overall-30a28c1d:after{ width: 97.0556% }</style></span>
            </div>
          </div>
          <div id="description-21220" class="margin-top-10 col-xs-12" style="display: none;">
            <p>Zorian is a teenage mage living in a world of magic.</p>
            <p>Cover by <a href="/profile/177664/fictions">a cover artist</a>.</p>
          </div>
        </div>
      </div>
      <a href="/fictions/search?page=2">Next</a>
      </body></html>`;
    const result = parseListing(html, 1);
    expect(result.hasNext).toBe(true);
    expect(result.stories).toHaveLength(1);
    const [story] = result.stories;
    expect(story.id).toBe('21220');
    expect(story.title).toBe('Mother of Learning');
    expect(story.rating).toBe(4.83);
    expect(story.authorName).toBeNull();
    expect(story.authorId).toBeNull();
    expect(story.coverUrl).toBe(
      'https://www.royalroadcdn.com/public/covers-full/21220-mother-of-learning.jpg?time=1637247458',
    );
    expect(story.tags).toEqual(['Time Loop', 'Fantasy']);
    expect(story.description).toContain('teenage mage');
  });
});

describe('parseFiction', () => {
  it('maps metadata and chapters references', () => {
    const details = parseFiction('21220', book());
    expect(details.title).toBe('Mother of Learning');
    expect(details.authorName).toBe('Nobody103');
    expect(details.authorId).toBe('15870');
    expect(details.rating).toBe(4.85);
    expect(details.votes).toBe(12345);
    expect(details.description).toContain('teenage mage');
    expect(details.tags).toEqual(['Fantasy', 'Time Loop']);
    expect(details.url).toBe('https://www.royalroad.com/fiction/21220');
  });
});

describe('parseAuthorPage', () => {
  it('maps the profile fields and the card-based fiction list', () => {
    const result = parseAuthorPage('15870', author(), 1);
    expect(result.author).toMatchObject({
      sourceId: 'royalroad',
      id: '15870',
      name: 'Nobody103',
      url: 'https://www.royalroad.com/profile/15870',
      avatarUrl: 'https://www.royalroadcdn.com/public/avatars/15870-nobody103.jpg',
      followers: 12345,
      worksCount: 2,
    });
    expect(result.author.bio).toContain('Writing time loops');
    expect(result.stories.items).toHaveLength(2);
    expect(result.stories.items[0]).toMatchObject({
      id: '21220',
      title: 'Mother of Learning',
      authorId: '15870',
      authorName: 'Nobody103',
    });
    expect(result.stories.hasNext).toBe(true);
    expect(parseAuthorPage('15870', author(), 2).stories.hasNext).toBe(false);
  });

  it('falls back to fiction anchors when the profile has no cards', () => {
    const html = `
      <html><head><title>Nobody103 | Royal Road</title></head><body>
      <h1>Nobody103</h1>
      <div class="profile-bio"><p>Writing time loops.</p></div>
      <ul>
        <li><a href="/fiction/21220/mother-of-learning">Mother of Learning</a></li>
        <li><a href="/fiction/21220/mother-of-learning">Mother of Learning</a></li>
        <li><a href="/fiction/31337/the-void">The Void</a></li>
      </ul>
      </body></html>`;
    const result = parseAuthorPage('15870', html, 1);
    expect(result.author.name).toBe('Nobody103');
    expect(result.stories.items.map((story) => story.id)).toEqual(['21220', '31337']);
    expect(result.stories.items[0].authorId).toBe('15870');
    expect(result.stories.items[0].url).toBe(
      'https://www.royalroad.com/fiction/21220/mother-of-learning',
    );
    expect(result.stories.hasNext).toBe(false);
  });
});

describe('parseChapterContent', () => {
  it('extracts the body from the chapter-content block', () => {
    const parsed = parseChapterContent(chapter());
    expect(parsed.title).toBe('Chapter 1: Good Morning, Brother');
    expect(parsed.content).toContain('Zorian woke');
    expect(parsed.wordCount).toBeGreaterThan(8);
  });
});
