import './index.css';

import { context } from '@devvit/web/client';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

export const Splash = () => {
  const [result, setResult] = useState<string>('Nog niet gezocht');

  async function testSearch() {
    try {
      setResult('Zoeken...');
      const response = await fetch('/api/search-artist?artist=techno&subreddits=Techno');
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(`Frontend error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (
    <div className="flex relative flex-col justify-center items-center min-h-screen gap-4 bg-white dark:bg-gray-900 p-4">
      <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
        LOFI Reddit Artist Scraper
      </h1>

      <p className="text-base text-center text-gray-600 dark:text-gray-300">
        Hey {context.username ?? 'user'} 👋
      </p>

      <button
        className="flex items-center justify-center bg-[#d93900] dark:bg-orange-600 text-white w-auto h-10 rounded-full cursor-pointer transition-colors px-4 hover:bg-[#c23300] dark:hover:bg-orange-700"
        onClick={testSearch}
      >
        Test Reddit Scraper
      </button>

      <pre className="max-w-[90vw] max-h-[400px] overflow-auto text-xs bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-4 rounded">
        {result}
      </pre>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);