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
    if (Array.isArray(data)) {
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

export const getCanvasVideo = async (title: string, artist: string): Promise<string | null> => {
  try {
    const data = await tryFetchBackendJson<{ videoId?: string | null }>(
      `/api/canvas?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`
    );
    return data?.videoId || null;
  } catch {
    return null;
  }
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
