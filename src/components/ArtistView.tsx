import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Heart,
  Sparkles,
  ChevronLeft,
  Radio,
  MoreHorizontal,
  Download,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import { Artist, Track, Playlist } from '../types';
import { getArtistDetails } from '../api';
import { canSaveTrackOffline } from '../lib/offlineVault';

interface ArtistViewProps {
  artistId: string;
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, contextPlaylist?: Playlist, contextTrackList?: Track[]) => void;
  onBack: () => void;
  onAddTrackToLiked?: (track: Track) => void;
  offlineIds?: Set<string>;
  savingOfflineId?: string | null;
  onToggleSaveOffline?: (track: Track) => void;
}

export default function ArtistView({
  artistId,
  currentTrack,
  isPlaying,
  onPlayTrack,
  onBack,
  onAddTrackToLiked,
  offlineIds,
  savingOfflineId,
  onToggleSaveOffline,
}: ArtistViewProps) {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [sheetTrack, setSheetTrack] = useState<Track | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    const loadArtist = async () => {
      const data = await getArtistDetails(artistId);
      if (!isCancelled && data) {
        setArtist(data);
      }
      if (!isCancelled) setIsLoading(false);
    };

    loadArtist();
    return () => {
      isCancelled = true;
    };
  }, [artistId]);

  const formatDuration = (ms: number) => {
    if (!ms || isNaN(ms)) return '0:00';
    const mins = Math.floor(ms / 60000);
    const secs = ((ms % 60000) / 1000).toFixed(0);
    return `${mins}:${Number(secs) < 10 ? '0' : ''}${secs}`;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-40">
        <div className="w-12 h-12 border-4 border-[#F43F5E] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="p-8 text-center text-white">
        <p className="text-white/60">Artist details not available.</p>
        <button
          onClick={onBack}
          className="mt-4 px-5 py-2.5 bg-[#F43F5E] text-white rounded-full font-bold text-xs cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  const tracks = artist.popularTracks || [];
  const isArtistPlaying = Boolean(isPlaying && currentTrack && tracks.some((t) => t.id === currentTrack.id));

  return (
    <div className="pb-36 select-none relative animate-in fade-in duration-300 bg-[#131418]">
      {/* Back Button Bar */}
      <div className="sticky top-0 z-30 px-4 py-3 pt-safe bg-gradient-to-b from-black/75 to-transparent flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white active:scale-95 transition cursor-pointer"
          aria-label="Go back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="text-sm font-bold text-white/90 truncate">{artist.name}</span>
      </div>

      {/* Full-Bleed Dramatic Artist Banner matching PLAYLIST Screen 2 */}
      <div className="relative h-72 sm:h-84 md:h-96 w-full -mt-16 overflow-hidden">
        <img
          src={artist.bannerUrl || artist.avatarUrl}
          alt={artist.name}
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80';
          }}
          className="w-full h-full object-cover object-center filter brightness-[0.78] contrast-[1.08]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#131418] via-[#131418]/35 to-transparent" />

        <div className="absolute bottom-5 left-5 right-5 sm:left-8 sm:right-8 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="bg-[#38BDF8] text-black text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow">
              <Sparkles className="w-3 h-3 fill-current" />
              Verified Artist
            </span>
            {artist.genre && <span className="text-xs text-white/80 font-medium">{artist.genre}</span>}
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight drop-shadow-md">
            {artist.name}
          </h1>

          <p className="text-xs sm:text-sm font-semibold text-white/75">{artist.monthlyListeners}</p>
        </div>
      </div>

      {/* Action Bar with Magenta/Rose Circular Play FAB */}
      <div className="px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsFollowing(!isFollowing)}
            className={`px-5 py-2 rounded-full text-xs font-bold border transition cursor-pointer ${
              isFollowing
                ? 'border-[#FACC15] text-[#FACC15] bg-[#FACC15]/10'
                : 'border-white/25 text-white hover:border-white bg-[#1D1F27]'
            }`}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs text-white/65 bg-[#1D1F27] px-3.5 py-1.5 rounded-full border border-white/[0.06]">
            <Radio className="w-3.5 h-3.5 text-[#FACC15]" />
            <span>320kbps Official Audio</span>
          </div>
        </div>

        {tracks.length > 0 && (
          <button
            onClick={() => onPlayTrack(tracks[0], undefined, tracks)}
            className="w-14 h-14 bg-[#F43F5E] hover:bg-[#FB7185] hover:scale-105 active:scale-95 rounded-full flex items-center justify-center text-white shadow-xl shadow-rose-500/35 transition cursor-pointer"
            aria-label={isArtistPlaying ? 'Pause artist' : 'Play artist'}
          >
            {isArtistPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
          </button>
        )}
      </div>

      {/* Popular Tracks Section (Dark rounded #1D1F27 rows matching screenshot) */}
      <div className="px-4 sm:px-8 mt-2">
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Popular ({tracks.length})</h2>
          <span className="text-[11px] text-[#FACC15] font-semibold">Background Audio Active</span>
        </div>

        {tracks.length === 0 ? (
          <p className="text-sm text-white/55 py-4">No tracks found for this artist.</p>
        ) : (
          <div className="space-y-2">
            {tracks.map((track, index) => {
              const isActive = currentTrack?.id === track.id;
              const isSaved = offlineIds?.has(track.id);
              const isSaving = savingOfflineId === track.id;

              return (
                <div
                  key={`${track.id}-${index}`}
                  onClick={() => onPlayTrack(track, undefined, tracks)}
                  className={`group flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl transition cursor-pointer border ${
                    isActive
                      ? 'bg-[#252833] border-[#F43F5E]/40'
                      : 'bg-[#1D1F27] hover:bg-[#252833] border-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                    <span className="w-5 text-center text-xs font-bold text-white/40 group-hover:hidden tabular-nums">
                      {index + 1}
                    </span>
                    <div className="w-5 hidden group-hover:flex items-center justify-center text-white">
                      {isActive && isPlaying ? (
                        <Pause className="w-4 h-4 text-[#FACC15] fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current" />
                      )}
                    </div>

                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-lg object-cover shadow flex-shrink-0"
                    />

                    <div className="overflow-hidden flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold truncate ${isActive ? 'text-[#FACC15]' : 'text-white'}`}>
                          {track.title}
                        </span>
                      </div>
                      <span className="text-xs text-white/55 truncate block mt-0.5">
                        {track.album || artist.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-white/55 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {onToggleSaveOffline && canSaveTrackOffline(track) && track.source !== 'local' && (
                      <button
                        onClick={() => onToggleSaveOffline(track)}
                        disabled={isSaving}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer ${
                          isSaved ? 'text-[#FACC15]' : 'text-white/50 hover:text-white'
                        }`}
                        aria-label="Save track offline"
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[#FACC15]" />
                        ) : isSaved ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => onAddTrackToLiked?.(track)}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-[#F43F5E] transition cursor-pointer"
                      aria-label="Like song"
                    >
                      <Heart className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-right tabular-nums hidden sm:inline">{formatDuration(track.duration)}</span>
                    <button
                      onClick={() => setSheetTrack(track)}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer"
                      aria-label="Track options"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* About Section */}
      {artist.bio && (
        <div className="px-4 sm:px-8 mt-8">
          <h2 className="text-lg font-bold text-white mb-3 tracking-tight">About</h2>
          <div className="p-5 rounded-2xl bg-[#1D1F27] border border-white/[0.06] shadow-xl">
            <p className="text-sm text-white/80 leading-relaxed font-normal">{artist.bio}</p>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/55">
              <span>{artist.monthlyListeners}</span>
              <span className="text-[#FACC15] font-semibold">{artist.genre}</span>
            </div>
          </div>
        </div>
      )}

      {/* Track Action Sheet Modal */}
      {sheetTrack && (
        <div
          onClick={() => setSheetTrack(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#181A22] rounded-t-3xl sm:rounded-3xl border-t sm:border border-white/10 p-6 pb-8 shadow-2xl"
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5 sm:hidden" />

            <div className="flex flex-col items-center text-center mb-6">
              <img
                src={sheetTrack.coverUrl}
                alt={sheetTrack.title}
                referrerPolicy="no-referrer"
                className="w-32 h-32 rounded-2xl object-cover shadow-2xl border border-white/10 mb-4"
              />
              <h3 className="text-lg font-extrabold text-white truncate max-w-full">{sheetTrack.title}</h3>
              <p className="text-xs text-white/60 mt-1 truncate max-w-full">{sheetTrack.artist}</p>
            </div>

            <div className="space-y-1.5">
              <button
                onClick={() => {
                  onPlayTrack(sheetTrack, undefined, tracks);
                  setSheetTrack(null);
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-[#1D1F27] hover:bg-[#252833] text-sm font-semibold text-white transition cursor-pointer"
              >
                <Play className="w-4 h-4 text-[#F43F5E] fill-current" />
                <span>Play Now</span>
              </button>
              <button
                onClick={() => {
                  onAddTrackToLiked?.(sheetTrack);
                  setSheetTrack(null);
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-[#1D1F27] hover:bg-[#252833] text-sm font-semibold text-white transition cursor-pointer"
              >
                <Heart className="w-4 h-4 text-[#F43F5E]" />
                <span>Like Song</span>
              </button>
              {onToggleSaveOffline && canSaveTrackOffline(sheetTrack) && sheetTrack.source !== 'local' && (
                <button
                  onClick={() => {
                    onToggleSaveOffline(sheetTrack);
                    setSheetTrack(null);
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-[#1D1F27] hover:bg-[#252833] text-sm font-semibold text-white transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#FACC15]" />
                  <span>{offlineIds?.has(sheetTrack.id) ? 'Remove Offline Copy' : 'Save Offline'}</span>
                </button>
              )}
              <button
                onClick={() => setSheetTrack(null)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold text-white/60 hover:text-white mt-2 cursor-pointer"
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
