import React, { useState } from 'react';
import {
  Play,
  Pause,
  Heart,
  MoreHorizontal,
  Search,
  Trash2,
  ChevronLeft,
  Download,
  CheckCircle2,
  Loader2,
  X,
  Plus,
} from 'lucide-react';
import { Track, Playlist } from '../types';
import { canSaveTrackOffline } from '../lib/offlineVault';

interface PlaylistViewProps {
  playlist: Playlist;
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, contextPlaylist?: Playlist) => void;
  onRemoveTrack?: (trackId: string) => void;
  onDeletePlaylist?: () => void;
  onBack?: () => void;
  offlineIds?: Set<string>;
  savingOfflineId?: string | null;
  onToggleSaveOffline?: (track: Track) => void;
  onAddTrackToLiked?: (track: Track) => void;
}

export default function PlaylistView({
  playlist,
  currentTrack,
  isPlaying,
  onPlayTrack,
  onRemoveTrack,
  onDeletePlaylist,
  onBack,
  offlineIds,
  savingOfflineId,
  onToggleSaveOffline,
  onAddTrackToLiked,
}: PlaylistViewProps) {
  const [sheetTrack, setSheetTrack] = useState<Track | null>(null);

  const formatDuration = (ms: number) => {
    if (!ms || isNaN(ms)) return '0:00';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000).toFixed(0);
    return `${mins}:${Number(secs) < 10 ? '0' : ''}${secs}`;
  };

  const totalDuration = playlist.tracks.reduce((acc, t) => acc + t.duration, 0);
  const isPlaylistPlaying = isPlaying && playlist.tracks.some((t) => t.id === currentTrack?.id);

  return (
    <div className="h-full flex flex-col bg-[#131418] overflow-y-auto pb-36 relative">
      {/* Teal-Emerald Hero Header matching PLAYLIST screenshot */}
      <div
        className={`pt-safe px-5 sm:px-8 pt-4 pb-6 ${
          playlist.isLikedSongs
            ? 'bg-gradient-to-b from-[#7E22CE] via-[#4C1D95]/75 to-[#131418]'
            : 'bg-gradient-to-b from-[#0F766E] via-[#0F4C46]/75 to-[#131418]'
        }`}
      >
        {/* Top Back Button Row */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-md flex items-center justify-center text-white transition active:scale-95 cursor-pointer"
            aria-label="Back to library"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          {!playlist.isLikedSongs && onDeletePlaylist && (
            <button
              onClick={onDeletePlaylist}
              className="w-10 h-10 rounded-full bg-black/30 hover:bg-rose-500/30 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer"
              title="Delete Playlist"
              aria-label="Delete Playlist"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Cover + Details: Centered on mobile (matching screenshot), horizontal on md+ */}
        <div className="flex flex-col md:flex-row items-center md:items-end gap-5 sm:gap-7">
          <div
            className={`w-44 h-44 sm:w-48 sm:h-48 rounded-2xl shadow-[0_24px_50px_rgba(0,0,0,0.65)] flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/15 ${
              playlist.isLikedSongs ? 'bg-gradient-to-br from-[#F43F5E] to-[#9333EA]' : 'bg-[#1D1F27]'
            }`}
          >
            {playlist.coverUrl ? (
              <img src={playlist.coverUrl} className="w-full h-full object-cover" alt={playlist.name} />
            ) : playlist.tracks[0]?.coverUrl ? (
              <img src={playlist.tracks[0].coverUrl} className="w-full h-full object-cover" alt={playlist.name} />
            ) : playlist.isLikedSongs ? (
              <Heart className="w-16 h-16 text-white fill-current" />
            ) : (
              <span className="text-white/40 font-extrabold text-6xl">♪</span>
            )}
          </div>

          <div className="flex flex-col text-white w-full md:w-auto text-left">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/75 mb-1">Playlist</span>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold mb-2 tracking-tight truncate">
              {playlist.name}
            </h1>
            <p className="text-xs sm:text-sm text-white/75 leading-relaxed mb-3">
              {playlist.description || 'Official songs & personal collection curated for continuous playback'}
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/85 tabular-nums">
              <span>You</span>
              <span>·</span>
              <span>{playlist.tracks.length} songs</span>
              <span>·</span>
              <span className="text-white/60">{Math.floor(totalDuration / 60000)} min</span>
            </div>
          </div>
        </div>

        {/* Action Row: Left Icons + Right Magenta Play FAB matching PLAYLIST screenshot */}
        <div className="flex items-center justify-between mt-5 pt-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => playlist.tracks.length > 0 && onPlayTrack(playlist.tracks[0], playlist)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              aria-label="Play from start"
            >
              <Heart className={`w-5 h-5 ${playlist.isLikedSongs ? 'text-[#F43F5E] fill-current' : ''}`} />
            </button>
            {onToggleSaveOffline && playlist.tracks[0] && canSaveTrackOffline(playlist.tracks[0]) && (
              <button
                onClick={() => onToggleSaveOffline(playlist.tracks[0])}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
                title="Save first track offline"
                aria-label="Save track offline"
              >
                <Download className="w-5 h-5" />
              </button>
            )}
            {!playlist.isLikedSongs && onDeletePlaylist && (
              <button
                onClick={onDeletePlaylist}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
                title="Playlist options"
                aria-label="Playlist options"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Signature Magenta/Rose Circular Play FAB */}
          <button
            onClick={() => playlist.tracks.length > 0 && onPlayTrack(playlist.tracks[0], playlist)}
            disabled={playlist.tracks.length === 0}
            className="w-14 h-14 bg-[#F43F5E] hover:bg-[#FB7185] disabled:opacity-40 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-rose-500/35 cursor-pointer"
            aria-label={isPlaylistPlaying ? 'Pause playlist' : 'Play playlist'}
          >
            {isPlaylistPlaying ? (
              <Pause className="w-6 h-6 text-white fill-current" />
            ) : (
              <Play className="w-6 h-6 text-white fill-current ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Tracks List (Clean rounded dark #1D1F27 rows matching PLAYLIST screenshot) */}
      <div className="px-4 sm:px-8 pt-2 pb-10">
        {playlist.tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-white/60 text-center bg-[#1D1F27] rounded-2xl border border-white/[0.06] p-6">
            <Search className="w-12 h-12 mb-4 opacity-40" />
            <h2 className="text-lg font-bold text-white mb-1">Let&apos;s find something for your playlist</h2>
            <p className="text-xs text-white/55">Use Search to discover official tracks and add them here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {playlist.tracks.map((track, index) => {
              const isActive = currentTrack?.id === track.id;
              const isSaved = offlineIds?.has(track.id);
              const isSaving = savingOfflineId === track.id;

              return (
                <div
                  key={`${track.id}-${index}`}
                  onClick={() => onPlayTrack(track, playlist)}
                  className={`group flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl transition cursor-pointer border ${
                    isActive
                      ? 'bg-[#252833] border-[#F43F5E]/40'
                      : 'bg-[#1D1F27] hover:bg-[#252833] border-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[#131418]">
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div
                        className={`absolute inset-0 bg-black/50 flex items-center justify-center transition ${
                          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {isActive && isPlaying ? (
                          <Pause className="w-4 h-4 text-[#FACC15] fill-current" />
                        ) : (
                          <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm font-bold truncate ${
                          isActive ? 'text-[#FACC15]' : 'text-white'
                        }`}
                      >
                        {track.title}
                      </div>
                      <div className="text-xs text-white/55 truncate mt-0.5">
                        {track.artist}
                        {track.album ? ` · ${track.album}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {onToggleSaveOffline && canSaveTrackOffline(track) && track.source !== 'local' && (
                      <button
                        onClick={() => onToggleSaveOffline(track)}
                        disabled={isSaving}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer ${
                          isSaved ? 'text-[#FACC15]' : 'text-white/50 hover:text-white'
                        }`}
                        aria-label={isSaved ? 'Remove offline track' : 'Save offline'}
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

                    <span className="text-xs text-white/45 w-10 text-right tabular-nums hidden sm:inline">
                      {formatDuration(track.duration)}
                    </span>

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

      {/* Track Options Sheet Modal matching PLAYLIST screen 3 */}
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
                  onPlayTrack(sheetTrack, playlist);
                  setSheetTrack(null);
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-[#1D1F27] hover:bg-[#252833] text-sm font-semibold text-white transition cursor-pointer"
              >
                <Play className="w-4 h-4 text-[#F43F5E] fill-current" />
                <span>Play Now</span>
              </button>

              {onAddTrackToLiked && !playlist.isLikedSongs && (
                <button
                  onClick={() => {
                    onAddTrackToLiked(sheetTrack);
                    setSheetTrack(null);
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-[#1D1F27] hover:bg-[#252833] text-sm font-semibold text-white transition cursor-pointer"
                >
                  <Heart className="w-4 h-4 text-[#F43F5E]" />
                  <span>Like Song</span>
                </button>
              )}

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

              {onRemoveTrack && (
                <button
                  onClick={() => {
                    onRemoveTrack(sheetTrack.id);
                    setSheetTrack(null);
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-[#1D1F27] hover:bg-rose-500/15 text-sm font-semibold text-rose-400 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{playlist.isLikedSongs ? 'Remove from Liked Songs' : 'Remove from Playlist'}</span>
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
