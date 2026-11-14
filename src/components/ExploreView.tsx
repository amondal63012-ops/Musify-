import React, { useEffect, useState, useMemo } from 'react';
import { Play, Flame } from 'lucide-react';
import { getCharts, getViralSongs, getArtists } from '../api';
import { Track, Artist, Playlist, SavedAlbum } from '../types';
import { ECHO_COVERS } from './echoCovers';
import SectionHeader from './design/SectionHeader';
import MusicCard from './design/MusicCard';
import AlbumCard from './design/AlbumCard';
import ArtistCard from './design/ArtistCard';
import SongRow from './design/SongRow';
import FeaturedBanner from './design/FeaturedBanner';
import LoadingSkeleton from './design/LoadingSkeleton';

interface ExploreViewProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  likedIds: Set<string>;
  offlineIds: Set<string>;
  savingOfflineId: string | null;
  savedAlbums: SavedAlbum[];
  onPlayTrack: (track: Track, contextPlaylist?: Playlist, contextTrackList?: Track[]) => void;
  onPlayContext: (query: string) => void;
  onSelectArtist: (artistId: string) => void;
  onToggleLike: (track: Track) => void;
  onToggleSaveOffline: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onToggleSaveAlbum: (album: SavedAlbum) => void;
  onViewAllArtists: () => void;
}

interface ChartCollection {
  id: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  tracks: Track[];
}

const EDITORIAL_COLLECTIONS = [
  {
    id: 'ed-top-hits',
    title: 'Aura Essential 50',
    subtitle: 'Handpicked official publisher flagship tracks',
    coverUrl: ECHO_COVERS.global,
    query: 'Global Top Hits Official',
  },
  {
    id: 'ed-acoustic',
    title: 'After Hours Acoustic',
    subtitle: 'Intimate studio sessions and stripped vocal cuts',
    coverUrl: ECHO_COVERS.indie,
    query: 'Indie Acoustic Hits Official',
  },
  {
    id: 'ed-electronic',
    title: 'Nocturnal Pulse',
    subtitle: 'Deep basslines, ambient synths & late-night grooves',
    coverUrl: ECHO_COVERS.glasswave,
    query: 'Electronic Dance Official',
  },
  {
    id: 'ed-throwbacks',
    title: 'Golden Era Classics',
    subtitle: 'Iconic singles & evergreen soundtrack recordings',
    coverUrl: ECHO_COVERS.nightmix,
    query: '90s 2000s Classic Hits',
  },
];

export default function ExploreView({
  currentTrack,
  isPlaying,
  likedIds,
  offlineIds,
  savingOfflineId,
  savedAlbums,
  onPlayTrack,
  onPlayContext,
  onSelectArtist,
  onToggleLike,
  onToggleSaveOffline,
  onAddToQueue,
  onToggleSaveAlbum,
  onViewAllArtists,
}: ExploreViewProps) {
  const [charts, setCharts] = useState<ChartCollection[]>([]);
  const [viralSongs, setViralSongs] = useState<Track[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      getCharts().catch(() => []),
      getViralSongs().catch(() => []),
      getArtists().catch(() => []),
    ]).then(([c, v, a]) => {
      if (!active) return;
      setCharts(Array.isArray(c) ? c : []);
      setViralSongs(Array.isArray(v) ? v : []);
      setArtists(Array.isArray(a) ? a : []);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const savedAlbumIds = useMemo(() => new Set(savedAlbums.map((a) => a.id)), [savedAlbums]);

  const albums = useMemo<SavedAlbum[]>(() => {
    const map = new Map<string, SavedAlbum>();
    for (const t of viralSongs) {
      const title = t.album && t.album !== 'Single' ? t.album : t.title;
      const id = `${title}__${t.artist}`.toLowerCase();
      if (!map.has(id)) {
        map.set(id, {
          id,
          title,
          artist: t.artist,
          coverUrl: t.coverUrl || ECHO_COVERS.nightmix,
          tracks: [t],
        });
      }
    }
    return Array.from(map.values()).slice(0, 10);
  }, [viralSongs]);

  const featuredRelease = viralSongs[0] || null;
  const newReleases = viralSongs.slice(1, 9);

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-44 space-y-10 select-none animate-in fade-in duration-200">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-[#A3A3A3] mb-1">Editorial Discovery</p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Explore
          </h1>
        </div>
        <p className="text-xs text-[#737373]">Charts, new releases &amp; curated collections</p>
      </div>

      {/* Featured Releases Editorial Block */}
      {isLoading ? (
        <LoadingSkeleton variant="hero" />
      ) : (
        featuredRelease && (
          <FeaturedBanner
            track={featuredRelease}
            kicker="Featured Release"
            description="Selected highlight from official global charts"
            isPlaying={Boolean(currentTrack?.id === featuredRelease.id && isPlaying)}
            onPlay={() => onPlayTrack(featuredRelease, undefined, viralSongs)}
            onShuffle={() => {
              if (viralSongs.length > 0) {
                const idx = Math.floor(Math.random() * viralSongs.length);
                onPlayTrack(viralSongs[idx], undefined, viralSongs);
              }
            }}
          />
        )
      )}

      {/* Top Charts (Mixed-Size Editorial Cards) */}
      <section>
        <SectionHeader title="Top Charts" subtitle="Updated daily from live global rankings" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {(charts.length > 0 ? charts : EDITORIAL_COLLECTIONS).slice(0, 4).map((chart, idx) => (
            <div
              key={`${chart.id}-${idx}`}
              onClick={() => {
                if ('tracks' in chart && Array.isArray(chart.tracks) && chart.tracks.length > 0) {
                  onPlayTrack(chart.tracks[0], undefined, chart.tracks);
                } else if ('query' in chart) {
                  onPlayContext(chart.query);
                } else {
                  onPlayContext(chart.title);
                }
              }}
              className="aura-card rounded-2xl p-3.5 cursor-pointer group flex flex-col justify-between"
            >
              <div className="relative aspect-[16/10] sm:aspect-square rounded-xl overflow-hidden mb-3 bg-[#111111]">
                <img
                  src={chart.coverUrl || ECHO_COVERS.global}
                  alt={chart.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = ECHO_COVERS.global;
                  }}
                  className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
                />
                <div className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-white text-black shadow-xl flex items-center justify-center opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
              </div>
              <div>
                <h4 className="font-bold text-sm text-white truncate">{chart.title}</h4>
                <p className="text-xs text-[#A3A3A3] line-clamp-1 mt-0.5">
                  {chart.subtitle || 'Chart Mix'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trending Music List */}
      <section>
        <SectionHeader
          title="Trending Music"
          subtitle="Instant playback across official audio streams"
          rightSlot={<Flame className="w-4 h-4 text-[#A3A3A3]" />}
        />
        {isLoading ? (
          <LoadingSkeleton variant="rows" count={6} />
        ) : (
          <div className="space-y-2">
            {viralSongs.slice(0, 8).map((track, index) => (
              <SongRow
                key={`${track.id}-exp-${index}`}
                track={track}
                index={index}
                isActive={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                isLiked={likedIds.has(track.id)}
                isOfflineSaved={offlineIds.has(track.id)}
                isSavingOffline={savingOfflineId === track.id}
                onPlay={() => onPlayTrack(track, undefined, viralSongs)}
                onToggleLike={() => onToggleLike(track)}
                onToggleSaveOffline={() => onToggleSaveOffline(track)}
                onAddToQueue={() => onAddToQueue(track)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Popular Albums */}
      {albums.length > 0 && (
        <section>
          <SectionHeader title="Popular Albums" subtitle="Save records directly to your library" />
          <div className="flex overflow-x-auto gap-3.5 pb-2 scrollbar-none">
            {albums.map((album) => (
              <div key={album.id} className="w-[158px] sm:w-[178px] shrink-0">
                <AlbumCard
                  title={album.title}
                  artist={album.artist}
                  coverUrl={album.coverUrl}
                  isSaved={savedAlbumIds.has(album.id)}
                  onPlay={() => onPlayTrack(album.tracks[0], undefined, album.tracks)}
                  onToggleSave={() => onToggleSaveAlbum(album)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* New Releases */}
      {newReleases.length > 0 && (
        <section>
          <SectionHeader title="New Releases" subtitle="Recent official drops" />
          <div className="flex overflow-x-auto gap-3.5 pb-2 scrollbar-none">
            {newReleases.map((track, idx) => (
              <div key={`${track.id}-enr-${idx}`} className="w-[154px] sm:w-[172px] shrink-0">
                <MusicCard
                  title={track.title}
                  subtitle={track.artist}
                  coverUrl={track.coverUrl}
                  isActive={currentTrack?.id === track.id}
                  isPlaying={isPlaying}
                  onClick={() => onPlayTrack(track, undefined, newReleases)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommended Artists */}
      {artists.length > 0 && (
        <section>
          <SectionHeader
            title="Recommended Artists"
            subtitle="Artists shaping the charts"
            actionLabel="View Directory"
            onAction={onViewAllArtists}
          />
          <div className="flex overflow-x-auto gap-3.5 pb-2 scrollbar-none">
            {artists.map((artist, idx) => (
              <div key={`${artist.id}-ea-${idx}`} className="w-[144px] sm:w-[162px] shrink-0">
                <ArtistCard artist={artist} showGenre onClick={() => onSelectArtist(artist.id)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Curated Music Collections */}
      <section>
        <SectionHeader title="Curated Collections" subtitle="Editorial mood & genre playlists" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {EDITORIAL_COLLECTIONS.map((col) => (
            <div
              key={col.id}
              onClick={() => onPlayContext(col.query)}
              className="aura-card rounded-2xl p-3.5 flex items-center gap-4 cursor-pointer group"
            >
              <img
                src={col.coverUrl}
                alt={col.title}
                referrerPolicy="no-referrer"
                className="w-20 h-20 rounded-xl object-cover shrink-0 bg-[#111111]"
              />
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm sm:text-base text-white truncate">{col.title}</h4>
                <p className="text-xs text-[#A3A3A3] line-clamp-2 mt-1">{col.subtitle}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shrink-0 opacity-85 group-hover:opacity-100 transition">
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
