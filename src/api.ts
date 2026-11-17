import { resolveApiUrl, tryFetchBackendJson } from './lib/apiConfig';
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
  try {
    const data = await tryFetchBackendJson<any[]>(`/api/search?q=${encodeURIComponent(term)}`);
    if (Array.isArray(data) && data.length > 0) {
      return normalizeTrackList(data);
    }
    const direct = await directSearchTracks(term);
    return normalizeTrackList(direct);
  } catch (error) {
    console.error('Error fetching tracks:', error);
    return [];
  }
};

export const getCharts = async (): Promise<any[]> => {
  try {
    const data = await tryFetchBackendJson<any[]>('/api/charts');
    const charts = Array.isArray(data) ? data : await directGetCharts();
    if (!Array.isArray(charts)) return [];
    return charts.map((chart: any) => ({
      ...chart,
      coverUrl: chart.coverUrl || DEFAULT_COVER,
      tracks: Array.isArray(chart.tracks) ? normalizeTrackList(chart.tracks) : [],
    }));
  } catch (error) {
    console.error('Error fetching charts:', error);
    return [];
  }
};

export interface CanvasMedia {
  videoUrl: string | null;
  videoId: string | null;
  provider?: 'apple-mv' | 'youtube-canvas' | null;
  title?: string | null;
  artist?: string | null;
  thumbnail?: string | null;
}

const canvasClientCache = new Map<string, CanvasMedia | null>();

function normalizeCanvasClientText(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\((?:feat\.?|ft\.?|featuring|with|from|official|music\s+video|video\s+song|hd|4k|explicit|clean|single\s+version|album\s+version|radio\s+edit|visualizer)[^)]*\)/gi, ' ')
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

export const getCanvasMedia = async (title: string, artist: string): Promise<CanvasMedia | null> => {
  if (!title) return null;
  const cacheKey = `${normalizeCanvasClientText(title)}:::${normalizeCanvasClientText(artist)}`;
  if (canvasClientCache.has(cacheKey)) {
    return canvasClientCache.get(cacheKey) ?? null;
  }

  try {
    const data = await tryFetchBackendJson<CanvasMedia>(
      `/api/canvas?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist || '')}`
    );
    let resolved: CanvasMedia | null = null;
    if (data && (data.videoUrl || data.videoId)) {
      resolved = {
        videoUrl: data.videoUrl || null,
        videoId: data.videoId || null,
        provider: data.provider || (data.videoUrl ? 'apple-mv' : 'youtube-canvas'),
        title: data.title || null,
        artist: data.artist || null,
        thumbnail: data.thumbnail || null,
      };
    } else if (data === null) {
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
};

export const getCanvasVideo = async (title: string, artist: string): Promise<string | null> => {
  const media = await getCanvasMedia(title, artist);
  return media?.videoId || media?.videoUrl || null;
};

export const getViralSongs = async (): Promise<any[]> => {
  try {
    const data = await tryFetchBackendJson<any[]>('/api/viral');
    const viral = Array.isArray(data) ? data : await directGetViralSongs();
    return Array.isArray(viral) ? normalizeTrackList(viral) : [];
  } catch (error) {
    console.error('Error fetching viral songs:', error);
    return [];
  }
};

export const getArtists = async (): Promise<any[]> => {
  try {
    const data = await tryFetchBackendJson<any[]>('/api/artists');
    return Array.isArray(data) ? data : DIRECT_FEATURED_ARTISTS;
  } catch (error) {
    console.error('Error fetching artists:', error);
    return DIRECT_FEATURED_ARTISTS;
  }
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
