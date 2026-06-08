import './index.css';

import { context } from '@devvit/web/client';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

type RedditPostResult = {
  artist: string;
  subreddit: string;
  title: string;
  body?: string;
  score?: number;
  numberOfComments?: number;
  createdAt?: string | number;
  url?: string;
  id?: string;
};

type SearchArtistResponse = {
  artist: string;
  subreddits: string[];
  count: number;
  results: RedditPostResult[];
  status?: string;
  message?: string;
};

export const Splash = () => {
  const [artist, setArtist] = useState<string>('KI/KI');
  const [subreddits, setSubreddits] = useState<string>(
    'Techno, ProperTechno, electronicmusic, aves, Amsterdam_rave, Berghain_Community'
  );

  const [result, setResult] = useState<SearchArtistResponse | null>(null);
  const [rawJson, setRawJson] = useState<string>('Nog niet gezocht');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function searchArtist() {
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setRawJson('Zoeken...');

      const cleanedArtist = artist.trim();
      const cleanedSubreddits = subreddits.trim();

      if (!cleanedArtist) {
        throw new Error('Vul eerst een artiestnaam in.');
      }

      if (!cleanedSubreddits) {
        throw new Error('Vul minstens één subreddit in.');
      }

      const params = new URLSearchParams({
        artist: cleanedArtist,
        subreddits: cleanedSubreddits,
      });

      const response = await fetch(`/api/search-artist?${params.toString()}`);

      const responseText = await response.text();

      let data: SearchArtistResponse;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Backend gaf geen geldige JSON terug. Status: ${response.status}. Response: ${responseText.slice(
            0,
            500
          )}`
        );
      }

      if (!response.ok) {
        throw new Error(data.message ?? `Backend error: ${response.status}`);
      }

      setResult(data);
      setRawJson(JSON.stringify(data, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      setRawJson(`Frontend error: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(createdAt?: string | number) {
    if (!createdAt) {
      return 'unknown date';
    }

    const date =
      typeof createdAt === 'number'
        ? new Date(createdAt)
        : new Date(createdAt);

    if (Number.isNaN(date.getTime())) {
      return String(createdAt);
    }

    return date.toLocaleString();
  }

  return (
    <div className="flex relative flex-col items-center min-h-screen gap-5 bg-white dark:bg-gray-900 p-4">
      <div className="w-full max-w-3xl flex flex-col items-center gap-2 mt-8">
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
          LOFI Reddit Artist Scraper
        </h1>

        <p className="text-base text-center text-gray-600 dark:text-gray-300">
          Hey {context.username ?? 'user'}
        </p>

        <p className="text-sm text-center text-gray-600 dark:text-gray-300 max-w-2xl">
          Gebruik dit als extra community-buzz check voor artiesten die al door
          jullie momentum score naar boven komen.
        </p>
      </div>

      <div className="w-full max-w-3xl flex flex-col gap-4 bg-gray-100 dark:bg-gray-800 p-4 rounded-xl">
        <label className="flex flex-col gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          Artiestnaam
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
            value={artist}
            onChange={(event) => setArtist(event.target.value)}
            placeholder="Bijvoorbeeld: KI/KI"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          Subreddits, gescheiden met komma&apos;s
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white min-h-24"
            value={subreddits}
            onChange={(event) => setSubreddits(event.target.value)}
            placeholder="Bijvoorbeeld: Techno, ProperTechno, electronicmusic, aves"
          />
        </label>

        <button
          className="flex items-center justify-center bg-[#d93900] dark:bg-orange-600 text-white h-11 rounded-full cursor-pointer transition-colors px-5 hover:bg-[#c23300] dark:hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={searchArtist}
          disabled={loading}
        >
          {loading ? 'Zoeken...' : 'Search Reddit buzz'}
        </button>
      </div>

      {error && (
        <div className="w-full max-w-3xl bg-red-100 text-red-800 p-4 rounded-xl text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="w-full max-w-3xl flex flex-col gap-4">
          <div className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-4 rounded-xl">
            <h2 className="text-lg font-bold">
              Resultaten voor: {result.artist}
            </h2>

            <p className="text-sm mt-1">
              Gezocht in: {result.subreddits.map((s) => `r/${s}`).join(', ')}
            </p>

            <p className="text-sm mt-1">
              Aantal gevonden posts: {result.count}
            </p>
          </div>

          {result.results.length === 0 && (
            <div className="bg-yellow-100 text-yellow-900 p-4 rounded-xl text-sm">
              Geen recente matching posts gevonden. Dit betekent niet meteen dat
              de artiest geen momentum heeft. Deze scraper kijkt nu alleen naar
              recente posts in de gekozen subreddits.
            </div>
          )}

          {result.results.length > 0 && (
            <div className="flex flex-col gap-3">
              {result.results.map((post, index) => (
                <div
                  key={`${post.subreddit}-${post.id ?? index}`}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
                >
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    r/{post.subreddit} · score {post.score ?? 0} · comments{' '}
                    {post.numberOfComments ?? 0} · {formatDate(post.createdAt)}
                  </div>

                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    {post.title}
                  </h3>

                  {post.body && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-4">
                      {post.body}
                    </p>
                  )}

                  {post.url && (
                    <a
                      className="inline-block text-sm text-blue-600 dark:text-blue-400 underline mt-3"
                      href={post.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Reddit post
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <details className="w-full max-w-3xl bg-gray-100 dark:bg-gray-800 rounded-xl p-4">
        <summary className="cursor-pointer font-medium text-gray-900 dark:text-gray-100">
          Raw JSON output
        </summary>

        <pre className="max-w-full max-h-[400px] overflow-auto text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 rounded mt-3">
          {rawJson}
        </pre>
      </details>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);