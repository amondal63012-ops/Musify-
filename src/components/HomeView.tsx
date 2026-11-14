import React, { useEffect, useState, useMemo } from 'react';
import { getCharts, getViralSongs, getArtists } from '../api';
import { Track, Artist, Playlist, SavedAlbum, UserProfile } from '../types';
import { ECHO_COVERS } from './echoCovers';
import SectionHeader from './design/SectionHeader';
import MusicCard from './design/MusicCard';
import AlbumCard from './design/AlbumCard';
import ArtistCard from './design/ArtistCard';
import PlaylistCard from './design/PlaylistCard';
import FeaturedBanner from './design/FeaturedBanner';
import LoadingSkeleton from './design/LoadingSkeleton';

interface HomeViewProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  recentlyPlayed: Track[];
  playlists: Playlist[];
  savedAlbums: SavedAlbum[];
  userProfile: UserProfile;
  onPlayContext: (query: string) => void;
  onPlayTrackDirect: (track: Track, contextPlaylist?: Playlist, contextTrackList?: Track[]) => void;
  onSelectArtist: (artistId: string) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onToggleSaveAlbum: (album: SavedAlbum) => void;
  onViewAllExplore: () => void;
  onViewAllArtists: () => void;
}

interface ChartItem {
  id: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  tracks: Track[];
}

const RECOMMENDED_RADIO_MIXES = [
  {
    id: 'radio-global',
    title: 'Global Hits Radio',
    subtitle: 'Official publisher anthems, pop leaders & live studio sessions',
    coverUrl: ECHO_COVERS.global,
    query: 'Global Top Hits Official',
  },
  {
    id: 'radio-bollywood',
    title: 'Bollywood Essential Radio',
    subtitle: 'Arijit Singh, Pritam, Shreya Ghoshal and modern soundtracks',
    coverUrl: ECHO_COVERS.indie,
    query: 'Bollywood Hindi Superhits',
  },
  {
    id: 'radio-glasswave',
    title: 'Midnight Electronic Radio',
    subtitle: 'Atmospheric electronic mixes & deep late-night instrumentals',
    coverUrl: ECHO_COVERS.glasswave,
    query: 'Electronic Chill Official',
  },
  {
    id: 'radio-nightmix',
    title: 'Timeless Acoustic Radio',
    subtitle: 'Classic vocal tracks, acoustic guitar sessions & evergreens',
    coverUrl: ECHO_COVERS.nightmix,
    query: '90s 2000s Classic Hits',
  },
];

const MOOD_COLLECTIONS = [
  {
    id: 'mood-singalong',
    sectionTitle: 'Sing-along',
    items: [
      {
        id: 'sing-1',
        title: 'Songs to Sing in the Shower',
        subtitle: 'Upbeat chorus favorites & vocal classics',
        coverUrl: ECHO_COVERS.global,
        query: 'Pop Hits Sing Along Official',
      },
      {
        id: 'sing-2',
        title: 'Guilty Pleasures',
        subtitle: 'Iconic throwback hits and chorus anthems',
        coverUrl: ECHO_COVERS.indie,
        query: 'Best Pop Throwback Hits',
      },
      {
        id: 'sing-3',
        title: 'Crowd Favorites',
        subtitle: 'High-energy stadium vocal choruses',
        coverUrl: ECHO_COVERS.glasswave,
        query: 'Trending Vocal Hits Official',
      },
    ],
  },
  {
    id: 'mood-chill',
    sectionTitle: 'Chill',
    items: [
      {
        id: 'chill-1',
        title: 'Soft Pop & Lo-Fi',
        subtitle: 'Warm ambient acoustic tracks for unwinding',
        coverUrl: ECHO_COVERS.nightmix,
        query: 'Chill Acoustic Lo-Fi Official',
      },
      {
        id: 'chill-2',
        title: 'Chill Hits',
        subtitle: 'Laid-back tempo singles and late-night mixes',
        coverUrl: ECHO_COVERS.glasswave,
        query: 'Chill Hits Official',
      },
      {
        id: 'chill-3',
        title: 'Acoustic Mornings',
        subtitle: 'Unplugged studio recordings & gentle piano',
        coverUrl: ECHO_COVERS.indie,
        query: 'Indie Acoustic Hits Official',
      },
    ],
  },
];

export default function HomeView({
  currentTrack,
  isPlaying,
  recentlyPlayed,
  playlists,
  savedAlbums,
  userProfile,
  onPlayContext,
  onPlayTrackDirect,
  onSelectArtist,
  onSelectPlaylist,
  onToggleSaveAlbum,
  onViewAllExplore,
  onViewAllArtists,
}: HomeViewProps) {
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [viralSongs, setViralSongs] = useState<Track[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'music' | 'artists' | 'albums'>('all');

  useEffect(() => {
    let active = true;
    Promise.all([
      getCharts().catch(() => []),
      getViralSongs().catch(() => []),
      getArtists().catch(() => []),
    ]).then(([c, v, a]) => {
      if (!active) return;
      if (Array.isArray(c)) setCharts(c);
      if (Array.isArray(v)) setViralSongs(v);
      if (Array.isArray(a)) setArtists(a);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const savedAlbumIds = useMemo(() => new Set(savedAlbums.map((a) => a.id)), [savedAlbums]);

  const featuredTrack = currentTrack || viralSongs[0] || recentlyPlayed[0] || null;

  const recentFeed = useMemo(() => {
    if (recentlyPlayed.length > 0) return recentlyPlayed.slice(0, 10);
    return viralSongs.slice(0, 8);
  }, [recentlyPlayed, viralSongs]);

  const recommendedRadio = charts.length > 0 ? charts : RECOMMENDED_RADIO_MIXES;
  const trendingSongs = viralSongs.slice(0, 10);
  const newReleases = viralSongs.slice(4, 14).length > 0 ? viralSongs.slice(4, 14) : viralSongs.slice(0, 8);

  const recommendedAlbums = useMemo<SavedAlbum[]>(() => {
    const map = new Map<string, SavedAlbum>();
    for (const track of viralSongs) {
      const albumTitle = track.album && track.album !== 'Single' ? track.album : track.title;
      const id = `${albumTitle}__${track.artist}`.toLowerCase();
      if (!map.has(id)) {
        map.set(id, {
          id,
          title: albumTitle,
          artist: track.artist,
          coverUrl: track.coverUrl || ECHO_COVERS.nightmix,
          tracks: [track],
        });
      } else {
        const existing = map.get(id)!;
        if (!existing.tracks.some((t) => t.id === track.id)) {
          existing.tracks.push(track);
        }
      }
    }
    return Array.from(map.values()).slice(0, 10);
  }, [viralSongs]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-3 pb-44 space-y-7 select-none animate-in fade-in duration-200">
      {/* Compact Monochrome Greeting & Quick Category Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-[#A3A3A3]">
            {getGreeting()}, {userProfile.name}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Home
          </h1>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'music', label: 'Music' },
              { id: 'artists', label: 'Artists' },
              { id: 'albums', label: 'Albums' },
            ] as const
          ).map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveFilter(chip.id)}
              className={`px-3.5 min-h-[34px] rounded-full text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                activeFilter === chip.id
                  ? 'bg-white text-black'
                  : 'bg-[#191919] text-[#A3A3A3] hover:text-white hover:bg-[#222222]'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Featured Release Spotlight */}
      {isLoading ? (
        <LoadingSkeleton variant="hero" />
      ) : (
        featuredTrack &&
        (activeFilter === 'all' || activeFilter === 'music') && (
          <FeaturedBanner
            track={featuredTrack}
            kicker={currentTrack ? 'Continue Listening' : 'Featured Release'}
            description="320kbps official publisher audio with background lock-screen playback"
            isPlaying={Boolean(currentTrack?.id === featuredTrack.id && isPlaying)}
            onPlay={() => onPlayTrackDirect(featuredTrack, undefined, viralSongs.length > 0 ? viralSongs : [featuredTrack])}
            onShuffle={() => {
              if (viralSongs.length > 0) {
                const idx = Math.floor(Math.random() * viralSongs.length);
                onPlayTrackDirect(viralSongs[idx], undefined, viralSongs);
              }
            }}
          />
        )
      )}

      {/* Recommended radio (Screenshot 3 Section 1) */}
      {(activeFilter === 'all' || activeFilter === 'music') && (
        <section>
          <SectionHeader
            title="Recommended radio"
            actionLabel="Explore"
            onAction={onViewAllExplore}
          />
          <div className="flex overflow-x-auto gap-3.5 pb-1 scrollbar-none">
            {recommendedRadio.map((item, idx) => (
              <div key={`${item.id}-rr-${idx}`} className="w-[144px] sm:w-[168px] shrink-0">
                <MusicCard
                  title={item.title}
                  subtitle={item.subtitle || 'Curated official audio'}
                  coverUrl={item.coverUrl}
                  onClick={() => {
                    if ('tracks' in item && Array.isArray(item.tracks) && item.tracks.length > 0) {
                      onPlayTrackDirect(item.tracks[0], undefined, item.tracks);
                    } else if ('query' in item) {
                      onPlayContext(item.query);
                    } else {
                      onPlayContext(item.title);
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Best of artists / Trending (Screenshot 3 Section 2) */}
      {(activeFilter === 'all' || activeFilter === 'music') && (
        <section>
          <SectionHeader
            title="Best of artists"
            actionLabel="See all"
            onAction={onViewAllExplore}
          />
          {isLoading ? (
            <LoadingSkeleton variant="cards" count={5} />
          ) : (
            <div className="flex overflow-x-auto gap-3.5 pb-1 scrollbar-none">
              {trendingSongs.map((track, idx) => (
                <div key={`${track.id}-tr-${idx}`} className="w-[144px] sm:w-[168px] shrink-0">
                  <MusicCard
                    title={track.title}
                    subtitle={track.artist}
                    coverUrl={track.coverUrl}
                    isActive={currentTrack?.id === track.id}
                    isPlaying={isPlaying}
                    onClick={() => onPlayTrackDirect(track, undefined, viralSongs)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Your favorite artists — Circular Full-Color Portraits (Screenshot 3 Section 3) */}
      {(activeFilter === 'all' || activeFilter === 'artists') && (
        <section>
          <SectionHeader
            title="Your favorite artists"
            actionLabel="All Artists"
            onAction={onViewAllArtists}
          />
          {isLoading ? (
            <LoadingSkeleton variant="artists" count={5} />
          ) : (
            <div className="flex overflow-x-auto gap-4 pb-1 scrollbar-none">
              {artists.map((artist, idx) => (
                <div key={`${artist.id}-ha-${idx}`} className="w-[132px] sm:w-[152px] shrink-0">
                  <ArtistCard
                    artist={artist}
                    onClick={() => onSelectArtist(artist.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Based on your recent listening (Screenshot 3 Section 4) */}
      {(activeFilter === 'all' || activeFilter === 'music') && recentFeed.length > 0 && (
        <section>
          <SectionHeader title="Based on your recent listening" />
          <div className="flex overflow-x-auto gap-3.5 pb-1 scrollbar-none">
            {recentFeed.map((track, idx) => (
              <div key={`${track.id}-rec-${idx}`} className="w-[144px] sm:w-[168px] shrink-0">
                <MusicCard
                  title={track.title}
                  subtitle={track.artist}
                  coverUrl={track.coverUrl}
                  isActive={currentTrack?.id === track.id}
                  isPlaying={isPlaying}
                  onClick={() => onPlayTrackDirect(track, undefined, recentFeed)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Editorial Mood Shelves: Sing-along & Chill (Screenshot 3 Section 5 & 6) */}
      {(activeFilter === 'all' || activeFilter === 'music') &&
        MOOD_COLLECTIONS.map((group) => (
          <section key={group.id}>
            <SectionHeader title={group.sectionTitle} />
            <div className="flex overflow-x-auto gap-3.5 pb-1 scrollbar-none">
              {group.items.map((item) => (
                <div key={item.id} className="w-[144px] sm:w-[168px] shrink-0">
                  <MusicCard
                    title={item.title}
                    subtitle={item.subtitle}
                    coverUrl={item.coverUrl}
                    onClick={() => onPlayContext(item.query)}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}

      {/* New Releases */}
      {(activeFilter === 'all' || activeFilter === 'music') && newReleases.length > 0 && (
        <section>
          <SectionHeader
            title="New releases"
            actionLabel="Explore"
            onAction={onViewAllExplore}
          />
          <div className="flex overflow-x-auto gap-3.5 pb-1 scrollbar-none">
            {newReleases.map((track, idx) => (
              <div key={`${track.id}-nr-${idx}`} className="w-[144px] sm:w-[168px] shrink-0">
                <MusicCard
                  title={track.title}
                  subtitle={track.artist}
                  coverUrl={track.coverUrl}
                  isActive={currentTrack?.id === track.id}
                  isPlaying={isPlaying}
                  onClick={() => onPlayTrackDirect(track, undefined, newReleases)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommended Albums */}
      {(activeFilter === 'all' || activeFilter === 'albums') && recommendedAlbums.length > 0 && (
        <section>
          <SectionHeader title="Recommended albums" />
          <div className="flex overflow-x-auto gap-3.5 pb-1 scrollbar-none">
            {recommendedAlbums.map((album) => (
              <div key={album.id} className="w-[144px] sm:w-[168px] shrink-0">
                <AlbumCard
                  title={album.title}
                  artist={album.artist}
                  coverUrl={album.coverUrl}
                  yearOrMeta={`${album.tracks.length} ${album.tracks.length === 1 ? 'track' : 'tracks'}`}
                  isSaved={savedAlbumIds.has(album.id)}
                  onPlay={() => onPlayTrackDirect(album.tracks[0], undefined, album.tracks)}
                  onToggleSave={() => onToggleSaveAlbum(album)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Your Playlists */}
      {activeFilter === 'all' && playlists.length > 0 && (
        <section>
          <SectionHeader title="Your playlists" />
          <div className="flex overflow-x-auto gap-3.5 pb-1 scrollbar-none">
            {playlists.map((playlist) => (
              <div key={playlist.id} className="w-[144px] sm:w-[168px] shrink-0">
                <PlaylistCard
                  playlist={playlist}
                  onClick={() => onSelectPlaylist(playlist)}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
