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
      previewUrl: '', // Replaced by YouTube ID 
      duration: item.duration || 0,
      youtubeId: item.id,
    }));
  } catch (error) {
    console.error('Error fetching tracks:', error);
    return [];
  }
};
