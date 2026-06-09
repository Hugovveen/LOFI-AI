import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  DecrementResponse,
  IncrementResponse,
  InitResponse,
} from '../../shared/api';

type ErrorResponse = {
  status: 'error';
  message: string;
};

export const api = new Hono();

api.get('/init', async (c) => {
  const { postId } = context;

  if (!postId) {
    console.error('API Init Error: postId not found in devvit context');
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required but missing from context',
      },
      400
    );
  }

  try {
    const [count, username] = await Promise.all([
      redis.get('count'),
      reddit.getCurrentUsername(),
    ]);

    return c.json<InitResponse>({
      type: 'init',
      postId: postId,
      count: count ? parseInt(count) : 0,
      username: username ?? 'anonymous',
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    let errorMessage = 'Unknown error during initialization';
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`;
    }
    return c.json<ErrorResponse>(
      { status: 'error', message: errorMessage },
      400
    );
  }
});

api.post('/increment', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', 1);
  return c.json<IncrementResponse>({
    count,
    postId,
    type: 'increment',
  });
});

api.post('/decrement', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', -1);
  return c.json<DecrementResponse>({
    count,
    postId,
    type: 'decrement',
  });
});

type RedditSearchResult = {
  artist: string;
  subreddit: string;
  type: 'post' | 'comment';
  matchReason:
    | 'post_text_matched'
    | 'comment_text_matched'
    | 'comment_under_matched_post';
  isDirectArtistMention: boolean;
  shouldAnalyzeSentiment: boolean;
  evidenceStrength: 'direct' | 'context';
  matchedAlias?: string;
  matchedField?: 'title' | 'body' | 'comment' | 'context';
  textSnippet: string;
  title: string;
  body: string;
  score?: number;
  numberOfComments?: number;
  createdAt?: string | number;
  url?: string;
  id?: string;
  postId?: string;
  commentId?: string;
};

type RedditLlmInputItem = {
  artist: string;
  subreddit: string;
  source: 'reddit';
  type: 'post' | 'comment';
  matchReason:
    | 'post_text_matched'
    | 'comment_text_matched'
    | 'comment_under_matched_post';
  evidenceStrength: 'direct' | 'context';
  matchedAlias?: string;
  matchedField?: 'title' | 'body' | 'comment' | 'context';
  text: string;
  redditScore?: number;
  redditCommentCount?: number;
  createdAt?: string | number;
  url?: string;
  postId?: string;
  commentId?: string;
};

function normalizeCompact(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]/g, '');
}

function normalizeWords(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&amp;/g, '&')
    .replace(/[_\-./]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getArtistAliases(artist: string): string[] {
  const words = normalizeWords(artist);
  const compact = normalizeCompact(artist);

  const aliases = new Set<string>();

  aliases.add(words);
  aliases.add(compact);

  aliases.add(words.replace(/\s+/g, ''));

  // Extra varianten voor namen zoals KI/KI, Ki/Ki, D.Dan.
  aliases.add(artist.toLowerCase().replace(/\//g, ' '));
  aliases.add(artist.toLowerCase().replace(/\./g, ' '));
  aliases.add(artist.toLowerCase().replace(/-/g, ' '));
  aliases.add(artist.toLowerCase().replace(/[./\-\s]/g, ''));

  return Array.from(aliases)
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0);
}

function findMatchedAlias(text: string, artist: string): string | undefined {
  const textWords = normalizeWords(text);
  const textCompact = normalizeCompact(text);

  const aliases = getArtistAliases(artist);

  return aliases.find((alias) => {
    const aliasWords = normalizeWords(alias);
    const aliasCompact = normalizeCompact(alias);

    return textWords.includes(aliasWords) || textCompact.includes(aliasCompact);
  });
}

function detectMatchedField(
  title: string,
  body: string,
  artist: string
): 'title' | 'body' | undefined {
  if (textMentionsArtist(title, artist)) {
    return 'title';
  }

  if (textMentionsArtist(body, artist)) {
    return 'body';
  }

  return undefined;
}

function createSnippet(text: string, artist: string, maxLength = 500): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const aliases = getArtistAliases(artist);
  const lowerCleaned = cleaned.toLowerCase();

  const matchIndex = aliases
    .map((alias) => lowerCleaned.indexOf(alias.toLowerCase()))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (matchIndex === undefined) {
    return `${cleaned.slice(0, maxLength)}...`;
  }

  const start = Math.max(0, matchIndex - 180);
  const end = Math.min(cleaned.length, start + maxLength);

  const prefix = start > 0 ? '...' : '';
  const suffix = end < cleaned.length ? '...' : '';

  return `${prefix}${cleaned.slice(start, end)}${suffix}`;
}

function toDateMs(createdAt?: string | number): number | undefined {
  if (!createdAt) {
    return undefined;
  }

  const date = new Date(createdAt);
  const time = date.getTime();

  return Number.isNaN(time) ? undefined : time;
}

function createLlmInput(results: RedditSearchResult[]): RedditLlmInputItem[] {
  return results
    .filter((result) => result.shouldAnalyzeSentiment)
    .map((result) => ({
      artist: result.artist,
      subreddit: result.subreddit,
      source: 'reddit',
      type: result.type,
      matchReason: result.matchReason,
      evidenceStrength: result.evidenceStrength,
      matchedAlias: result.matchedAlias,
      matchedField: result.matchedField,
      text: result.textSnippet,
      redditScore: result.score,
      redditCommentCount: result.numberOfComments,
      createdAt: result.createdAt,
      url: result.url,
      postId: result.postId,
      commentId: result.commentId,
    }));
}

function textMentionsArtist(text: string, artist: string): boolean {
  const textWords = normalizeWords(text);
  const textCompact = normalizeCompact(text);

  const aliases = getArtistAliases(artist);

  return aliases.some((alias) => {
    const aliasWords = normalizeWords(alias);
    const aliasCompact = normalizeCompact(alias);

    if (!aliasWords && !aliasCompact) {
      return false;
    }

    return textWords.includes(aliasWords) || textCompact.includes(aliasCompact);
  });
}

function ensurePostId(id: string): string {
  if (id.startsWith('t3_')) {
    return id;
  }

  return `t3_${id}`;
}

api.get('/search-artist', async (c) => {
  try {
    const artist = c.req.query('artist') ?? 'KI/KI';

    const subredditsParam =
      c.req.query('subreddits') ??
      'Techno,ProperTechno,electronicmusic,aves,Amsterdam_rave,Berghain_Community';

    const subreddits = subredditsParam
      .split(',')
      .map((s) => s.trim().replace(/^r\//, ''))
      .filter(Boolean);

    const postLimit = Number(c.req.query('postLimit') ?? 30);
    const commentLimit = Number(c.req.query('commentLimit') ?? 10);

    const results: RedditSearchResult[] = [];

    for (const subredditName of subreddits) {
      console.log(`Searching r/${subredditName} for "${artist}"`);

      const posts = await reddit
        .getNewPosts({
          subredditName,
          limit: postLimit,
          pageSize: Math.min(postLimit, 100),
        })
        .all();

      console.log(`Fetched ${posts.length} posts from r/${subredditName}`);

      for (const post of posts as any[]) {
        const title = post.title ?? '';
        const postBody = post.body ?? '';
        const postText = `${title}\n\n${postBody}`;

        const postMatchesArtist = textMentionsArtist(postText, artist);
        const postId = ensurePostId(String(post.id));

        if (postMatchesArtist) {
          const matchedField = detectMatchedField(title, postBody, artist);
          const matchedText =
            matchedField === 'title' ? title : `${title}\n\n${postBody}`;
        
          results.push({
            artist,
            subreddit: subredditName,
            type: 'post',
            matchReason: 'post_text_matched',
            isDirectArtistMention: true,
            shouldAnalyzeSentiment: true,
            evidenceStrength: 'direct',
            matchedAlias: findMatchedAlias(postText, artist),
            matchedField,
            textSnippet: createSnippet(matchedText, artist),
            title,
            body: postBody,
            score: post.score,
            numberOfComments: post.numberOfComments,
            createdAt: post.createdAt,
            url: post.url,
            id: postId,
            postId,
          });
        }

        // Haal comments alleen op als de post zelf de artiest noemt.
        // Dit voorkomt dat we honderden comment requests doen.
        if (postMatchesArtist) {
          let comments: any[] = [];

          try {
            comments = await reddit
              .getComments({
                postId,
                limit: commentLimit,
                pageSize: Math.min(commentLimit, 100),
              })
              .all();

            console.log(
              `Post matched "${artist}". Fetched ${comments.length} comments from post ${postId}`
            );
          } catch (error) {
            console.error(`Failed to fetch comments for matched post ${postId}`, error);
          }

          for (const comment of comments) {
            const commentBody = comment.body ?? '';

            if (!commentBody) {
              continue;
            }

            const commentMatchesArtist = textMentionsArtist(commentBody, artist);

            const matchReason = commentMatchesArtist
              ? 'comment_text_matched'
              : 'comment_under_matched_post';

            const isDirectArtistMention = commentMatchesArtist;
            const evidenceStrength = isDirectArtistMention ? 'direct' : 'context';
            const shouldAnalyzeSentiment = isDirectArtistMention;

            results.push({
              artist,
              subreddit: subredditName,
              type: 'comment',
              matchReason,
              isDirectArtistMention,
              shouldAnalyzeSentiment,
              evidenceStrength,
              matchedAlias: commentMatchesArtist
                ? findMatchedAlias(commentBody, artist)
                : undefined,
              matchedField: commentMatchesArtist ? 'comment' : 'context',
              textSnippet: createSnippet(commentBody, artist),
              title: `Comment on: ${title}`,
              body: commentBody,
              score: comment.score,
              createdAt: comment.createdAt,
              url: post.url,
              id: comment.id,
              postId,
              commentId: comment.id,
            });
          }
}
      }
    }

    const postCount = results.filter((result) => result.type === 'post').length;

    const commentCount = results.filter(
      (result) => result.type === 'comment'
    ).length;

    const directEvidenceCount = results.filter(
      (result) => result.evidenceStrength === 'direct'
    ).length;

    const contextEvidenceCount = results.filter(
      (result) => result.evidenceStrength === 'context'
    ).length;

    const sentimentCandidateCount = results.filter(
      (result) => result.shouldAnalyzeSentiment
    ).length;

    const subredditsWithMatches = Array.from(
      new Set(results.map((result) => result.subreddit))
    );

    const timestamps = results
      .map((result) => toDateMs(result.createdAt))
      .filter((time): time is number => time !== undefined);

    const newestPostDate =
      timestamps.length > 0
        ? new Date(Math.max(...timestamps)).toISOString()
        : null;

    const oldestPostDate =
      timestamps.length > 0
        ? new Date(Math.min(...timestamps)).toISOString()
        : null;

    const searchedTimeWindowDays =
      timestamps.length > 0
        ? Math.round(
            (Math.max(...timestamps) - Math.min(...timestamps)) /
              (1000 * 60 * 60 * 24)
          )
        : null;
    
    const llmInput = createLlmInput(results);

    return c.json({
      artist,
      subreddits,
      postLimit,
      commentLimit,
      count: results.length,
      postCount,
      commentCount,
      directEvidenceCount,
      contextEvidenceCount,
      sentimentCandidateCount,
      subredditsWithMatches,
      newestPostDate,
      oldestPostDate,
      searchedTimeWindowDays,
      aliasesUsed: getArtistAliases(artist),
      llmInput,
      results,
    });
  } catch (error) {
    console.error('search-artist failed:', error);

    return c.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});