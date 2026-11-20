import { resolveApiUrl, tryFetchBackendJson } from './lib/apiConfig';
import { CanvasResolution } from './types';
import {
  DIRECT_FEATURED_ARTISTS,
  directGetArtistDetails,
  directGetCharts,
  directGetViralSongs,
  directResolveFallback,
  directSearchArtists,
  directSearchTracks,
} from './lib/directMusicProvider';

const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';

const SWR_FRESH_MS = 1000 * 60 * 10; // 10 minutes
const SWR_STALE_MS = 1000 * 60 * 60 * 24; // 24 hours fallback cache

interface SwrEntry<T> {
  ts: number;
  data: T;
}

const memoryFeedCache = new Map<string, SwrEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

function readSwrCache<T>(key: string): SwrEntry<T> | null {
  const mem = memoryFeedCache.get(key);
  if (mem) return mem as SwrEntry<T>;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SwrEntry<T>;
    if (!parsed || typeof parsed.ts !== 'number' || !parsed.data) return null;
    if (Date.now() - parsed.ts > SWR_STALE_MS) return null;
    memoryFeedCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeSwrCache<T>(key: string, data: T): void {
  const entry: SwrEntry<T> = { ts: Date.now(), data };
  memoryFeedCache.set(key, entry);
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore storage quota issues cleanly
  }
}

function dedupeInFlight<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) return existing as Promise<T>;
  const req = fetcher().finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, req);
  return req;
}

function normalizeTrackList(data: any[]): any[] {
  return data
    .filter((item: any) => Boolean(item?.streamUrl))
    .map((item: any) => {
      const resolvedStream = resolveApiUrl(item.streamUrl || '');
      const resolvedPreview = resolveApiUrl(item.streamUrl || item.previewUrl || '');
      return {
        id: item.id,
        title: item.title,
        artist: item.artist || 'Unknown Artist',
        album: item.album || 'Single',
        coverUrl: item.coverUrl || DEFAULT_COVER,
        previewUrl: resolvedPreview,
        streamUrl: resolvedStream,
        duration: item.duration || 0,
        label: item.label || '',
        source: item.source || 'jiosaavn',
      };
    });
}

export const searchTracks = async (term: string): Promise<any[]> => {
  const trimmed = term.trim();
  const isDefaultSeed = trimmed === 'Global Top Hits Official';
  const cacheKey = isDefaultSeed ? 'aura_swr_default_tracks_v1' : `search:${trimmed.toLowerCase()}`;

  if (isDefaultSeed) {
    const cached = readSwrCache<any[]>(cacheKey);
    if (cached && cached.data.length > 0) {
      if (Date.now() - cached.ts > SWR_FRESH_MS) {
        dedupeInFlight(cacheKey, async () => {
          const data = await tryFetchBackendJson<any[]>(`/api/search?q=${encodeURIComponent(term)}`);
          const list = Array.isArray(data) && data.length > 0 ? data : await directSearchTracks(term);
          const normalized = normalizeTrackList(list);
          if (normalized.length > 0) writeSwrCache(cacheKey, normalized);
          return normalized;
        }).catch(() => {});
      }
      return cached.data;
    }
  }

  return dedupeInFlight(cacheKey, async () => {
    try {
      const data = await tryFetchBackendJson<any[]>(`/api/search?q=${encodeURIComponent(term)}`);
      if (Array.isArray(data) && data.length > 0) {
        const normalized = normalizeTrackList(data);
        if (isDefaultSeed && normalized.length > 0) writeSwrCache(cacheKey, normalized);
        return normalized;
      }
      const direct = await directSearchTracks(term);
      const normalized = normalizeTrackList(direct);
      if (isDefaultSeed && normalized.length > 0) writeSwrCache(cacheKey, normalized);
      return normalized;
    } catch (error) {
      console.error('Error fetching tracks:', error);
      return [];
    }
  });
};

export const getCharts = async (): Promise<any[]> => {
  const cacheKey = 'aura_swr_charts_v1';
  const fetchFresh = () =>
    dedupeInFlight(cacheKey, async () => {
      try {
        const data = await tryFetchBackendJson<any[]>('/api/charts');
        const charts = Array.isArray(data) ? data : await directGetCharts();
        if (!Array.isArray(charts)) return [];
        const normalized = charts.map((chart: any) => ({
          ...chart,
          coverUrl: chart.coverUrl || DEFAULT_COVER,
          tracks: Array.isArray(chart.tracks) ? normalizeTrackList(chart.tracks) : [],
        }));
        if (normalized.length > 0) writeSwrCache(cacheKey, normalized);
        return normalized;
      } catch (error) {
        console.error('Error fetching charts:', error);
        return [];
      }
    });

  const cached = readSwrCache<any[]>(cacheKey);
  if (cached && cached.data.length > 0) {
    if (Date.now() - cached.ts > SWR_FRESH_MS) {
      fetchFresh().catch(() => {});
    }
    return cached.data;
  }

  return fetchFresh();
};

export interface CanvasMedia {
  videoUrl: string | null;
  videoId: string | null;
  fallbackVideoIds?: string[];
  provider?: 'apple-mv' | 'youtube-canvas' | null;
  title?: string | null;
  artist?: string | null;
  thumbnail?: string | null;
  quality?: CanvasResolution;
}

const canvasClientCache = new Map<string, CanvasMedia | null>();

function normalizeCanvasClientText(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\((?:feat\.?|ft\.?|featuring|with|from|official|music\s+video|video\s+song|hd|4k|8k|uhd|explicit|clean|single\s+version|album\s+version|radio\s+edit|visualizer)[^)]*\)/gi, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(?:feat\.?|ft\.?|featuring)\b.*$/i, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

async function directItunesCanvasFallback(title: string, artist: string): Promise<CanvasMedia | null> {
  const normTarget = normalizeCanvasClientText(title);
  const artistEntities = (artist || '')
    .split(/[,&/+×]|(?:\s+(?:feat\.?|ft\.?|featuring|with|vs\.?|x)\s+)/i)
    .map((s) => normalizeCanvasClientText(s))
    .filter(Boolean);
  if (!normTarget || artistEntities.length === 0) return null;

  try {
    const cleanTitle = title.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim() || title;
    const term = `${cleanTitle} ${artistEntities[0]}`.trim();
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=musicVideo&entity=musicVideo&limit=10`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    for (const item of results) {
      const previewUrl = typeof item?.previewUrl === 'string' ? item.previewUrl.trim() : '';
      if (!previewUrl || !/^https?:\/\//i.test(previewUrl)) continue;
      const candTitleNorm = normalizeCanvasClientText(item.trackName || '');
      const candArtistNorm = normalizeCanvasClientText(item.artistName || '');
      if (candTitleNorm !== normTarget) continue;
      const candArtists = (item.artistName || '')
        .split(/[,&/+×]|(?:\s+(?:feat\.?|ft\.?|featuring|with|vs\.?|x)\s+)/i)
        .map((s: string) => normalizeCanvasClientText(s))
        .filter(Boolean);
      const artistMatched = artistEntities.some(
        (ta) => candArtistNorm === ta || candArtists.includes(ta)
      );
      if (!artistMatched) continue;
      return {
        videoUrl: previewUrl.replace(/^http:\/\//i, 'https://'),
        videoId: null,
        fallbackVideoIds: [],
        provider: 'apple-mv',
        title: item.trackName || title,
        artist: item.artistName || artist,
        thumbnail: typeof item.artworkUrl100 === 'string' ? item.artworkUrl100.replace(/100x100bb/i, '600x600bb') : null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export const getCanvasMedia = async (
  title: string,
  artist: string,
  quality: CanvasResolution = 'auto',
  prefer: 'auto' | 'youtube' = 'auto'
): Promise<CanvasMedia | null> => {
  if (!title) return null;
  const cacheTier = prefer === 'youtube' ? 'yt' : 'auto';
  const cacheKey = `${normalizeCanvasClientText(title)}:::${normalizeCanvasClientText(artist)}:::${cacheTier}`;
  if (canvasClientCache.has(cacheKey)) {
    return canvasClientCache.get(cacheKey) ?? null;
  }

  return dedupeInFlight(`canvas:${cacheKey}`, async () => {
    try {
      const data = await tryFetchBackendJson<CanvasMedia>(
        `/api/canvas?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist || '')}&quality=${encodeURIComponent(quality)}&prefer=${prefer}`
      );
      let resolved: CanvasMedia | null = null;
      if (data && (data.videoUrl || data.videoId)) {
        resolved = {
          videoUrl: data.videoUrl || null,
          videoId: data.videoId || null,
          fallbackVideoIds: Array.isArray(data.fallbackVideoIds) ? data.fallbackVideoIds : [],
          provider: data.provider || (data.videoUrl ? 'apple-mv' : 'youtube-canvas'),
          title: data.title || null,
          artist: data.artist || null,
          thumbnail: data.thumbnail || null,
          quality,
        };
      } else if (data === null && prefer !== 'youtube') {
        resolved = await directItunesCanvasFallback(title, artist);
      }

      if (canvasClientCache.size > 150) {
        const oldestKey = canvasClientCache.keys().next().value;
        if (oldestKey) canvasClientCache.delete(oldestKey);
      }
      canvasClientCache.set(cacheKey, resolved);
      return resolved;
    } catch {
      return null;
    }
  });
};

export const getCanvasVideo = async (title: string, artist: string): Promise<string | null> => {
  const media = await getCanvasMedia(title, artist);
  return media?.videoId || media?.videoUrl || null;
};

export const getViralSongs = async (): Promise<any[]> => {
  const cacheKey = 'aura_swr_viral_v1';
  const fetchFresh = () =>
    dedupeInFlight(cacheKey, async () => {
      try {
        const data = await tryFetchBackendJson<any[]>('/api/viral');
        const viral = Array.isArray(data) ? data : await directGetViralSongs();
        const normalized = Array.isArray(viral) ? normalizeTrackList(viral) : [];
        if (normalized.length > 0) writeSwrCache(cacheKey, normalized);
        return normalized;
      } catch (error) {
        console.error('Error fetching viral songs:', error);
        return [];
      }
    });

  const cached = readSwrCache<any[]>(cacheKey);
  if (cached && cached.data.length > 0) {
    if (Date.now() - cached.ts > SWR_FRESH_MS) {
      fetchFresh().catch(() => {});
    }
    return cached.data;
  }

  return fetchFresh();
};

export const getArtists = async (): Promise<any[]> => {
  const cacheKey = 'aura_swr_artists_v1';
  const fetchFresh = () =>
    dedupeInFlight(cacheKey, async () => {
      try {
        const data = await tryFetchBackendJson<any[]>('/api/artists');
        const artists = Array.isArray(data) ? data : DIRECT_FEATURED_ARTISTS;
        if (Array.isArray(artists) && artists.length > 0) writeSwrCache(cacheKey, artists);
        return artists;
      } catch (error) {
        console.error('Error fetching artists:', error);
        return DIRECT_FEATURED_ARTISTS;
      }
    });

  const cached = readSwrCache<any[]>(cacheKey);
  if (cached && cached.data.length > 0) {
    if (Date.now() - cached.ts > SWR_FRESH_MS) {
      fetchFresh().catch(() => {});
    }
    return cached.data;
  }

  return fetchFresh();
};

export const searchArtists = async (query: string): Promise<any[]> => {
  try {
    const data = await tryFetchBackendJson<any[]>(`/api/artists/search?q=${encodeURIComponent(query)}`);
    if (Array.isArray(data)) return data;
    return await directSearchArtists(query);
  } catch (error) {
    console.error('Error searching artists:', error);
    return [];
  }
};

export const getArtistDetails = async (id: string): Promise<any | null> => {
  try {
    const data = await tryFetchBackendJson<any>(`/api/artist/${encodeURIComponent(id)}`);
    const artistData = data ?? (await directGetArtistDetails(id));
    if (artistData && Array.isArray(artistData.popularTracks)) {
      artistData.popularTracks = normalizeTrackList(artistData.popularTracks);
    }
    return artistData;
  } catch (error) {
    console.error('Error fetching artist details:', error);
    return null;
  }
};

export const resolveTrackFallback = async (title: string, artist: string): Promise<any | null> => {
  try {
    const params = new URLSearchParams({ title, artist });
    const data = await tryFetchBackendJson<any>(`/api/track/fallback?${params.toString()}`);
    if (data?.streamUrl) {
      return {
        ...data,
        streamUrl: resolveApiUrl(data.streamUrl),
        previewUrl: data.previewUrl ? resolveApiUrl(data.previewUrl) : resolveApiUrl(data.streamUrl),
      };
    }
    return await directResolveFallback(title, artist);
  } catch {
    return null;
  }
};
