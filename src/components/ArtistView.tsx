import React, { useState, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  Heart,
  ChevronLeft,
  Download,
  X,
  Shuffle,
  ListPlus,
  BadgeCheck,
} from 'lucide-react';
import { Artist, Track, Playlist, SavedAlbum } from '../types';
import { getArtistDetails, getArtists } from '../api';
import { canSaveTrackOffline } from '../lib/offlineVault';
import { ECHO_COVERS } from './echoCovers';
import SectionHeader from './design/SectionHeader';
import SongRow from './design/SongRow';
import AlbumCard from './design/AlbumCard';
import ArtistCard from './design/ArtistCard';
import LoadingSkeleton from './design/LoadingSkeleton';

interface ArtistViewProps {
  artistId: string;
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, contextPlaylist?: Playlist, contextTrackList?: Track[]) => void;
  onBack: () => void;
  onAddTrackToLiked?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  offlineIds?: Set<string>;
  savingOfflineId?: string | null;
  onToggleSaveOffline?: (track: Track) => void;
  isFollowed?: boolean;
  onToggleFollow?: (artist: Artist) => void;
  savedAlbums?: SavedAlbum[];
  onToggleSaveAlbum?: (album: SavedAlbum) => void;
  onSelectArtist?: (artistId: string) => void;
}

export default function ArtistView({
  artistId,
  currentTrack,
  isPlaying,
  onPlayTrack,
  onBack,
  onAddTrackToLiked,
  onAddToQueue,
  offlineIds,
  savingOfflineId,
  onToggleSaveOffline,
  isFollowed = false,
  onToggleFollow,
  savedAlbums = [],
  onToggleSaveAlbum,
  onSelectArtist,
}: ArtistViewProps) {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [relatedArtists, setRelatedArtists] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sheetTrack, setSheetTrack] = useState<Track | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    Promise.all([getArtistDetails(artistId), getArtists().catch(() => [])]).then(
      ([data, allArtists]) => {
        if (isCancelled) return;
        if (data) setArtist(data);
        if (Array.isArray(allArtists)) {
          setRelatedArtists(allArtists.filter((a) => a.id !== artistId).slice(0, 8));
        }
        setIsLoading(false);
      }
    );

    return () => {
      isCancelled = true;
    };
  }, [artistId]);

  const tracks = artist?.popularTracks || [];
  const isArtistPlaying = Boolean(isPlaying && currentTrack && tracks.some((t) => t.id === currentTrack.id));
  const savedAlbumIds = useMemo(() => new Set(savedAlbums.map((a) => a.id)), [savedAlbums]);

  const { albums, singles } = useMemo(() => {
    const albumMap = new Map<string, SavedAlbum>();
    const singleTracks: Track[] = [];
    for (const t of tracks) {
      const albumName = t.album?.trim();
      if (!albumName || albumName.toLowerCase() === 'single' || albumName.toLowerCase() === t.title.toLowerCase()) {
        singleTracks.push(t);
      } else {
        const key = `${albumName}__${t.artist}`.toLowerCase();
        if (!albumMap.has(key)) {
          albumMap.set(key, {
            id: key,
            title: albumName,
            artist: artist?.name || t.artist,
            coverUrl: t.coverUrl || ECHO_COVERS.nightmix,
            tracks: [t],
          });
        } else {
          albumMap.get(key)!.tracks.push(t);
        }
      }
    }
    return {
      albums: Array.from(albumMap.values()),
      singles: singleTracks.length > 0 ? singleTracks : tracks.slice(0, 6),
    };
  }, [tracks, artist?.name]);

  if (isLoading) {
    return (
      <div className="p-5 sm:p-8 space-y-6">
        <LoadingSkeleton variant="hero" />
        <LoadingSkeleton variant="rows" count={5} />
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="p-8 text-center text-white">
        <p className="text-[#A3A3A3] text-sm">Artist details are unavailable right now.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 px-5 py-2.5 aura-btn-primary rounded-full font-bold text-xs cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="pb-44 select-none relative animate-in fade-in duration-200 bg-[#080808]">
      {/* Sticky Monochrome Top Bar */}
      <div className="sticky top-0 z-30 px-4 sm:px-6 py-3 pt-safe bg-[#080808]/75 backdrop-blur-xl border-b border-[#303030]/60 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#191919] border border-[#303030] hover:bg-[#222222] flex items-center justify-center text-white active:scale-95 transition cursor-pointer"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-bold text-white truncate">{artist.name}</span>
      </div>

      {/* Full-Bleed Full-Color Artist Banner */}
      <div className="relative h-72 sm:h-84 md:h-96 w-full overflow-hidden bg-[#111111]">
        <img
          src={artist.bannerUrl || artist.avatarUrl || ECHO_COVERS.indie}
          alt={artist.name}
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = ECHO_COVERS.indie;
          }}
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/45 to-transparent" />

        <div className="absolute bottom-5 left-5 right-5 sm:left-8 sm:right-8 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white/85">
            <BadgeCheck className="w-4 h-4 text-white" />
            <span>Verified Artist</span>
            {artist.genre && <span>· {artist.genre}</span>}
          </div>

          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight">
            {artist.name}
          </h1>

          <p className="text-xs sm:text-sm font-medium text-[#A3A3A3]">{artist.monthlyListeners}</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-5 sm:px-8 py-5 flex items-center justify-between gap-4 border-b border-[#303030]">
        <div className="flex items-center gap-2.5">
          {tracks.length > 0 && (
            <button
              type="button"
              onClick={() => onPlayTrack(tracks[0], undefined, tracks)}
              className="aura-btn-primary px-6 min-h-[44px] rounded-full inline-flex items-center gap-2 text-xs sm:text-sm font-bold cursor-pointer"
            >
              {isArtistPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>Play</span>
                </>
              )}
            </button>
          )}

          {tracks.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const idx = Math.floor(Math.random() * tracks.length);
                onPlayTrack(tracks[idx], undefined, tracks);
              }}
              className="aura-btn-secondary w-11 h-11 rounded-full flex items-center justify-center cursor-pointer"
              aria-label="Shuffle artist tracks"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onToggleFollow?.(artist)}
          className={`px-5 min-h-[40px] rounded-full text-xs font-bold transition cursor-pointer ${
            isFollowed ? 'aura-btn-primary' : 'aura-btn-secondary'
          }`}
        >
          {isFollowed ? 'Following' : 'Follow'}
        </button>
      </div>

      <div className="px-4 sm:px-8 pt-6 space-y-10">
        {/* Popular Songs */}
        <section>
          <SectionHeader
            title="Popular Songs"
            subtitle={`${tracks.length} official releases · 320kbps Audio`}
          />
          {tracks.length === 0 ? (
            <p className="text-sm text-[#737373] py-4">No tracks found for this artist.</p>
          ) : (
            <div className="space-y-2">
              {tracks.map((track, index) => (
                <SongRow
                  key={`${track.id}-${index}`}
                  track={track}
                  index={index}
                  isActive={currentTrack?.id === track.id}
                  isPlaying={isPlaying}
                  isOfflineSaved={offlineIds?.has(track.id)}
                  isSavingOffline={savingOfflineId === track.id}
                  onPlay={() => onPlayTrack(track, undefined, tracks)}
                  onToggleLike={onAddTrackToLiked ? () => onAddTrackToLiked(track) : undefined}
                  onToggleSaveOffline={onToggleSaveOffline ? () => onToggleSaveOffline(track) : undefined}
                  onAddToQueue={onAddToQueue ? () => onAddToQueue(track) : undefined}
                  onMoreOptions={() => setSheetTrack(track)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Albums */}
        {albums.length > 0 && (
          <section>
            <SectionHeader title="Albums" subtitle="Full-length studio albums & EPs" />
            <div className="flex overflow-x-auto gap-3.5 pb-2 scrollbar-none">
              {albums.map((album) => (
                <div key={album.id} className="w-[158px] sm:w-[178px] shrink-0">
                  <AlbumCard
                    title={album.title}
                    artist={album.artist}
                    coverUrl={album.coverUrl}
                    yearOrMeta={`${album.tracks.length} ${album.tracks.length === 1 ? 'track' : 'tracks'}`}
                    isSaved={savedAlbumIds.has(album.id)}
                    onPlay={() => onPlayTrack(album.tracks[0], undefined, album.tracks)}
                    onToggleSave={onToggleSaveAlbum ? () => onToggleSaveAlbum(album) : undefined}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Singles */}
        {singles.length > 0 && (
          <section>
            <SectionHeader title="Singles" subtitle="Standalone drops & featured appearances" />
            <div className="flex overflow-x-auto gap-3.5 pb-2 scrollbar-none">
              {singles.map((track, idx) => (
                <div key={`${track.id}-sin-${idx}`} className="w-[154px] sm:w-[172px] shrink-0">
                  <AlbumCard
                    title={track.title}
                    artist={track.artist}
                    coverUrl={track.coverUrl}
                    yearOrMeta="Single"
                    onPlay={() => onPlayTrack(track, undefined, singles)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Related Artists */}
        {relatedArtists.length > 0 && (
          <section>
            <SectionHeader title="Related Artists" subtitle="Listeners also stream" />
            <div className="flex overflow-x-auto gap-3.5 pb-2 scrollbar-none">
              {relatedArtists.map((rel) => (
                <div key={rel.id} className="w-[144px] sm:w-[162px] shrink-0">
                  <ArtistCard
                    artist={rel}
                    onClick={() => onSelectArtist?.(rel.id)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Artist Information */}
        <section>
          <SectionHeader title="Artist Information" />
          <div className="p-5 sm:p-6 rounded-2xl bg-[#191919] border border-[#303030]">
            <p className="text-sm text-[#A3A3A3] leading-relaxed">
              {artist.bio || `${artist.name} is a verified official artist available for streaming and offline vault playback on Aura Music.`}
            </p>
            <div className="mt-4 pt-4 border-t border-[#303030] flex flex-wrap items-center justify-between gap-2 text-xs text-[#A3A3A3]">
              <span>{artist.monthlyListeners}</span>
              <span className="text-white font-semibold">{artist.genre || 'Official Artist'}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Track Options Sheet */}
      {sheetTrack && (
        <div
          onClick={() => setSheetTrack(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md aura-sheet rounded-t-3xl sm:rounded-2xl p-6 pb-8"
          >
            <div className="w-10 h-1 bg-[#303030] rounded-full mx-auto mb-5 sm:hidden" />

            <div className="flex flex-col items-center text-center mb-6">
              <img
                src={sheetTrack.coverUrl || ECHO_COVERS.global}
                alt={sheetTrack.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = ECHO_COVERS.global;
                }}
                className="w-24 h-24 rounded-xl object-cover shadow-2xl border border-[#303030] mb-3.5"
              />
              <h3 className="text-base font-extrabold text-white truncate max-w-full">{sheetTrack.title}</h3>
              <p className="text-xs text-[#A3A3A3] mt-1 truncate max-w-full">{sheetTrack.artist}</p>
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  onPlayTrack(sheetTrack, undefined, tracks);
                  setSheetTrack(null);
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-[#191919] border border-[#303030] hover:bg-[#222222] text-sm font-semibold text-white transition cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play now</span>
              </button>
              {onAddToQueue && (
                <button
                  type="button"
                  onClick={() => {
                    onAddToQueue(sheetTrack);
                    setSheetTrack(null);
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-[#191919] border border-[#303030] hover:bg-[#222222] text-sm font-semibold text-white transition cursor-pointer"
                >
                  <ListPlus className="w-4 h-4" />
                  <span>Add to queue</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onAddTrackToLiked?.(sheetTrack);
                  setSheetTrack(null);
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-[#191919] border border-[#303030] hover:bg-[#222222] text-sm font-semibold text-white transition cursor-pointer"
              >
                <Heart className="w-4 h-4" />
                <span>Like song</span>
              </button>
              {onToggleSaveOffline && canSaveTrackOffline(sheetTrack) && sheetTrack.source !== 'local' && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleSaveOffline(sheetTrack);
                    setSheetTrack(null);
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-[#191919] border border-[#303030] hover:bg-[#222222] text-sm font-semibold text-white transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{offlineIds?.has(sheetTrack.id) ? 'Remove offline copy' : 'Save offline'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSheetTrack(null)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold text-[#A3A3A3] hover:text-white mt-2 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
