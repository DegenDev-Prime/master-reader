import { z } from 'zod';

/**
 * Loose schemas for Literotica's unofficial API. Field shapes vary between the
 * v1/v2/v3 endpoints and drift over time, so these validate *structure* only and
 * tolerate missing/extra fields. Normalisation happens in `parsers.ts`.
 */

const idValue = z.union([z.string(), z.number()]);
const numeric = z.union([z.number(), z.string()]);
const boolValue = z.union([z.boolean(), z.string(), z.number()]);

const categoryInfoSchema = z
  .looseObject({
    name: z.string().optional(),
    pageUrl: z.string().optional(),
    type: z.string().optional(),
  })
  .nullish();

export const seriesItemSchema = z.looseObject({
  id: idValue,
  title: z.string(),
  url: z.string().nullish(),
  category: idValue.nullish(),
  category_info: categoryInfoSchema,
});

export const seriesSchema = z.looseObject({
  meta: z.looseObject({ id: idValue, title: z.string(), url: z.string().nullish() }).nullish(),
  items: z.array(seriesItemSchema).nullish(),
});

export const authorSchema = z.looseObject({
  id: idValue.optional(),
  user_id: idValue.optional(),
  userid: idValue.optional(),
  username: z.string().optional(),
  name: z.string().optional(),
  display_name: z.string().optional(),
  avatar: z.string().nullish(),
});

/** v1: `1/submissions`, `1/top`, `1/user-submissions`, `1/user-favorites`. */
export const v1StorySchema = z.looseObject({
  id: idValue,
  name: z.string(),
  description: z.string().nullish(),
  category: z.looseObject({ id: idValue, name: z.string() }).nullish(),
  lang: idValue.nullish(),
  timestamp_published: numeric.nullish(),
  rate: numeric.nullish(),
  view_count: numeric.nullish(),
  url: z.string().nullish(),
  is_hot: boolValue.nullish(),
  is_new: boolValue.nullish(),
  writers_pick: boolValue.nullish(),
  contest_winner: boolValue.nullish(),
  enable_comments: boolValue.nullish(),
  allow_vote: boolValue.nullish(),
  user: authorSchema.nullish(),
});

export const v1ListResponseSchema = z.looseObject({
  success: z.boolean().optional(),
  total: numeric.nullish(),
  submissions: z.array(v1StorySchema).nullish(),
});

/** v2: `2/submissions/pages`. */
export const v2PageSchema = z.looseObject({
  submission_id: idValue,
  name: z.string(),
  url: z.string().nullish(),
  allow_vote: boolValue.nullish(),
  series_id: idValue.nullish(),
  lang: idValue.nullish(),
  content: z.string().nullish(),
  tags: z.array(z.looseObject({ name: z.string(), submission_count: numeric.nullish() })).nullish(),
});

export const v2PagesResponseSchema = z.looseObject({
  success: z.boolean().optional(),
  total: numeric.nullish(),
  pages: z.array(v2PageSchema).nullish(),
});

/** v3 search shape: `3/search/stories` (`data` + `meta`). */
export const v3StorySchema = z.looseObject({
  id: idValue,
  title: z.string(),
  description: z.string().nullish(),
  category_info: categoryInfoSchema,
  category: idValue.nullish(),
  language: idValue.nullish(),
  date_approve: z.union([z.string(), z.number()]).nullish(),
  rate_all: numeric.nullish(),
  view_count: numeric.nullish(),
  url: z.string().nullish(),
  is_hot: boolValue.nullish(),
  is_new: boolValue.nullish(),
  writers_pick: boolValue.nullish(),
  contest_winner: boolValue.nullish(),
  enable_comments: boolValue.nullish(),
  allow_vote: boolValue.nullish(),
  author: authorSchema.nullish(),
  /** Empty array on listings without a series; object on series submissions. */
  series: z.union([seriesSchema, z.array(seriesItemSchema)]).nullish(),
});

export const v3SearchResponseSchema = z.looseObject({
  data: z.array(v3StorySchema).nullish(),
  meta: z.looseObject({ total: numeric.nullish(), submissions_count: numeric.nullish() }).nullish(),
});

/** v3 full story: `3/stories/{id}` (`submission` + full `pageText`). */
export const v3StoryResponseSchema = z.looseObject({
  meta: z.looseObject({ pages_count: numeric.nullish() }).nullish(),
  submission: v3StorySchema,
  pageText: z.string().nullish(),
});

/** v3 tag portal: `3/tagsportal/stories`, `3/tagsportal/by-name`, `3/tagsportal/top`. */
export const v3TagPortalResponseSchema = z.looseObject({
  submissions: z.array(v3StorySchema).nullish(),
  meta: z.looseObject({ total: numeric.nullish(), submissions_count: numeric.nullish() }).nullish(),
});

export const tagSchema = z.looseObject({
  id: idValue,
  tag: z.string().optional(),
  name: z.string().optional(),
  tag_name: z.string().optional(),
});

export const tagListSchema = z.array(tagSchema);

/** v3 `3/constants`. */
export const constantsSchema = z.looseObject({
  languages: z
    .record(
      z.string(),
      z.looseObject({
        id: idValue,
        shortname: z.string().optional(),
        longname: z.string().optional(),
        domain: z.string().nullish(),
      }),
    )
    .nullish(),
  categories: z
    .record(
      z.string(),
      z.looseObject({
        id: idValue,
        name: z.string().optional(),
        tagline: z.string().optional(),
      }),
    )
    .nullish(),
});

export type V1Story = z.infer<typeof v1StorySchema>;
export type V2Page = z.infer<typeof v2PageSchema>;
export type V3Story = z.infer<typeof v3StorySchema>;
export type V3StoryResponse = z.infer<typeof v3StoryResponseSchema>;
export type V3Series = z.infer<typeof seriesSchema>;
export type V3SeriesItem = z.infer<typeof seriesItemSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type Constants = z.infer<typeof constantsSchema>;
