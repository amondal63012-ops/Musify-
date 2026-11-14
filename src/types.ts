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

export interface SavedAlbum {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  tracks: Track[];
  savedAt?: number;
}

export interface UserProfile {
  name: string;
  handle: string;
  email: string;
  bio: string;
  avatarStyle: 'initials' | 'vinyl' | 'wave';
}

export interface AppSettings {
  audioQuality: '320k' | '160k' | '96k';
  autoplay: boolean;
  gaplessPlayback: boolean;
  pureBlackSurface: boolean;
  reducedMotion: boolean;
  releaseNotifications: boolean;
  chartNotifications: boolean;
  pauseHistory: boolean;
}

export type RepeatMode = 'off' | 'all' | 'one';

export type AppView =
  | 'home'
  | 'explore'
  | 'viral'
  | 'charts'
  | 'search'
  | 'library'
  | 'playlist'
  | 'artists'
  | 'artist'
  | 'queue'
  | 'profile'
  | 'settings';
