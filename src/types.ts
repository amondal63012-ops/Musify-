export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  previewUrl: string;
  streamUrl?: string;
  duration: number;
  label?: string;
  source?: 'jiosaavn' | 'audius' | 'soundcloud' | 'gaana' | 'deezer' | 'jamendo' | 'archive' | 'local';
  isViral?: boolean;
  viralRank?: number;
  isOfflineSaved?: boolean;
  addedAt?: number;
}

export interface Artist {
  id: string;
  name: string;
  avatarUrl: string;
  bannerUrl?: string;
  monthlyListeners: string;
  genre: string;
  bio?: string;
  verified?: boolean;
  popularTracks?: Track[];
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  tracks: Track[];
  isLikedSongs?: boolean;
}

export type RepeatMode = 'off' | 'all' | 'one';
