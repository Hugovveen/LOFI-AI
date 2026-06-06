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

api.get('/search-artist', async (c) => {
  try {
    const artist = c.req.query('artist') ?? 'KI/KI';
    const subredditsParam = c.req.query('subreddits') ?? 'Techno';
    const subreddits = subredditsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const normalizedArtist = artist.toLowerCase();
    const results = [];

    for (const subredditName of subreddits) {
      console.log(`Searching r/${subredditName} for "${artist}"`);

      const posts = await reddit
        .getNewPosts({
          subredditName,
          limit: 10,
          pageSize: 10,
        })
        .all();

      console.log(`Fetched ${posts.length} posts from r/${subredditName}`);

      for (const post of posts) {
        const title = post.title ?? '';
        const body = post.body ?? '';
        const combinedText = `${title} ${body}`.toLowerCase();

        if (combinedText.includes(normalizedArtist)) {
          results.push({
            artist,
            subreddit: subredditName,
            title,
            body,
            score: post.score,
            numberOfComments: post.numberOfComments,
            createdAt: post.createdAt,
            url: post.url,
            id: post.id,
          });
        }
      }
    }

    return c.json({
      artist,
      subreddits,
      count: results.length,
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

  return c.json({
    artist,
    subreddits,
    count: results.length,
    results,
  });
});