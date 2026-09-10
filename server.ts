import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import ytSearch from 'yt-search';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to search YouTube
  app.get('/api/search', async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }

      const r = await ytSearch(query + ' audio');
      
      const tracks = r.videos.slice(0, 20).map(video => ({
        id: video.videoId,
        title: video.title,
        artist: video.author.name,
        album: 'YouTube',
        coverUrl: video.thumbnail,
        duration: video.seconds * 1000, // format to ms for compatibility
      }));

      res.json(tracks);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // API Route to get lyrics via LRCLIB
  app.post('/api/lyrics', async (req, res) => {
    try {
      const { title, artist } = req.body;
      if (!title || !artist) {
        return res.status(400).json({ error: 'Title and artist are required' });
      }

      const cleanTitle = title.replace(/\(.*\)|\[.*\]|(Official.*)|(Lyric.*)|(Music Video)/gi, '').trim();
      let syncedLyrics: string | null = null;
      let plainLyrics: string | null = null;

      let retries = 3;
      while (retries > 0) {
        try {
          const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(artist + ' ' + cleanTitle)}`);
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData && searchData.length > 0) {
               const syncedMatch = searchData.find((d: any) => d.syncedLyrics);
               if (syncedMatch) {
                 syncedLyrics = syncedMatch.syncedLyrics;
                 plainLyrics = syncedMatch.plainLyrics;
               } else {
                 plainLyrics = searchData[0].plainLyrics;
               }
            }
            break; // Success, stop retrying
          } else {
             console.warn(`LRCLIB returned ${searchRes.status}, retrying...`);
          }
        } catch(e) {
          console.error("LRCLIB error", e);
        }
        retries--;
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      res.json({ syncedLyrics, plainLyrics });
    } catch (error) {
      console.error('Lyrics error:', error);
      res.json({ syncedLyrics: null, plainLyrics: null });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
