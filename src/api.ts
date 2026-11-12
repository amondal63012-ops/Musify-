export const searchTracks = async (term: string): Promise<any[]> => {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    
    return data.map((item: any) => ({
      id: item.id,
      title: item.title,
      artist: item.artist || 'Unknown Artist',
      album: item.album || 'Single',
      coverUrl: item.coverUrl || 'https://via.placeholder.com/300x300.png?text=No+Cover',
      previewUrl: item.streamUrl || item.previewUrl || '',
      streamUrl: item.streamUrl || '',
      duration: item.duration || 0,
      youtubeId: item.youtubeId,
      source: item.source || (item.streamUrl ? 'jiosaavn' : 'youtube'),
    }));
  } catch (error) {
    console.error('Error fetching tracks:', error);
    return [];
  }
};

export const getCharts = async (): Promise<any[]> => {
  try {
    const res = await fetch('/api/charts');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching charts:', error);
    return [];
  }
};

export const getCanvasVideo = async (title: string, artist: string): Promise<string | null> => {
  try {
    const res = await fetch(`/api/canvas?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`);
    const data = await res.json();
    return data?.videoId || null;
  } catch (error) {
    console.error('Error fetching canvas video:', error);
    return null;
  }
};

export const getViralSongs = async (): Promise<any[]> => {
  try {
    const res = await fetch('/api/viral');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching viral songs:', error);
    return [];
  }
};

export const getArtists = async (): Promise<any[]> => {
  try {
    const res = await fetch('/api/artists');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching artists:', error);
    return [];
  }
};

export const searchArtists = async (query: string): Promise<any[]> => {
  try {
    const res = await fetch(`/api/artists/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error searching artists:', error);
    return [];
  }
};

export const getArtistDetails = async (id: string): Promise<any | null> => {
  try {
    const res = await fetch(`/api/artist/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('Error fetching artist details:', error);
    return null;
  }
};
