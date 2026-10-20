import { describe, expect, it } from 'vitest';

import { loadTextFixture } from '@/test-utils/fixtures';

import {
  isCloudflareChallenge,
  parseChapterContent,
  parseChapterList,
  parseFiction,
  parseListing,
} from './parsers';

const listing = () => loadTextFixture('listing.html', 'royalroad');
const book = () => loadTextFixture('book.html', 'royalroad');
const chapter = () => loadTextFixture('chapter.html', 'royalroad');

describe('isCloudflareChallenge', () => {
  it('detects a real Cloudflare interstitial', () => {
    expect(isCloudflareChallenge(loadTextFixture('challenge.html', 'royalroad'))).toBe(true);
  });

  it('does not flag a normal page', () => {
    expect(isCloudflareChallenge(listing())).toBe(false);
  });
});

describe('parseListing', () => {
  it('maps fiction cards', () => {
    const result = parseListing(listing(), 1);
    expect(result.stories).toHaveLength(2);
    expect(result.stories[0].id).toBe('21220');
    expect(result.stories[0].title).toBe('Mother of Learning');
    expect(result.stories[0].authorName).toBe('Nobody103');
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
    expect(details.rating).toBe(4.85);
    expect(details.votes).toBe(12345);
    expect(details.description).toContain('teenage mage');
    expect(details.tags).toEqual(['Fantasy', 'Time Loop']);
  });
});

describe('parseChapterList', () => {
  it('maps and sorts chapters', () => {
    const chapters = parseChapterList(book(), '21220');
    expect(chapters.map((entry) => entry.number)).toEqual([1, 2]);
    expect(chapters[0].path).toBe('/fiction/21220/mother-of-learning/chapter/1');
    expect(chapters[0].title).toBe('Chapter 1: Good Morning, Brother');
  });

  it('parses the 2026 chapter hrefs with slug tails and dedupes the row anchors', () => {
    // Chapter rows on the 2026 fiction page carry two anchors per chapter (name
    // and date cells) and hrefs ending in a chapter-slug segment.
    const chapters = parseChapterList(
      `
      <table id="chapters" data-chapters="2"><tbody>
        <tr class="chapter-row" data-url="/fiction/21220/mother-of-learning/chapter/301778/1-good-morning-brother" data-volume-id="null">
          <td><a href="/fiction/21220/mother-of-learning/chapter/301778/1-good-morning-brother">
            1. Good Morning Brother
          </a></td>
          <td class="text-right"><a href="/fiction/21220/mother-of-learning/chapter/301778/1-good-morning-brother" data-content="0"><time title="Sunday, October 28, 2018">Sunday, October 28, 2018</time></a></td>
        </tr>
        <tr class="chapter-row" data-url="/fiction/21220/mother-of-learning/chapter/301781/2-lifes-little-problems" data-volume-id="null">
          <td><a href="/fiction/21220/mother-of-learning/chapter/301781/2-lifes-little-problems">
            2. Life&#x27;s Little Problems
          </a></td>
          <td class="text-right"><a href="/fiction/21220/mother-of-learning/chapter/301781/2-lifes-little-problems" data-content="0"><time title="Wednesday, October 31, 2018">Wednesday, October 31, 2018</time></a></td>
        </tr>
      </tbody></table>`,
      '21220',
    );

    expect(chapters).toHaveLength(2);
    expect(chapters.map((entry) => entry.number)).toEqual([301778, 301781]);
    expect(chapters[0].path).toBe(
      '/fiction/21220/mother-of-learning/chapter/301778/1-good-morning-brother',
    );
    expect(chapters[0].title).toBe('1. Good Morning Brother');
    expect(chapters[1].path).toBe(
      '/fiction/21220/mother-of-learning/chapter/301781/2-lifes-little-problems',
    );
    expect(chapters[1].title).toBe("2. Life's Little Problems");
  });

  it('parses chapter hrefs without a fiction slug segment', () => {
    const chapters = parseChapterList(
      '<a href="/fiction/21220/chapter/301778">1. Good Morning Brother</a>',
      '21220',
    );
    expect(chapters).toHaveLength(1);
    expect(chapters[0].path).toBe('/fiction/21220/chapter/301778');
  });

  it('ignores links to other fictions and non-chapter anchors', () => {
    const chapters = parseChapterList(
      '<a href="/fiction/9999/other/chapter/77/list">other</a><a href="/fiction/21220">self</a>',
      '21220',
    );
    expect(chapters).toHaveLength(0);
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
