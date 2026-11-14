import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Heart,
  Trash2,
  ChevronLeft,
  Download,
  X,
  Shuffle,
  Plus,
  ListPlus,
  Check,
  Music,
  MoreHorizontal,
} from 'lucide-react';
import { Track, Playlist } from '../types';
import { canSaveTrackOffline } from '../lib/offlineVault';
import { searchTracks, getViralSongs } from '../api';
import { ECHO_COVERS } from './echoCovers';
import SongRow from './design/SongRow';
import SearchBar from './design/SearchBar';

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
  onAddTrackToPlaylist?: (track: Track, targetPlaylistId?: string) => void;
  onAddToQueue?: (track: Track) => void;
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
  onAddTrackToPlaylist,
  onAddToQueue,
}: PlaylistViewProps) {
  const [sheetTrack, setSheetTrack] = useState<Track | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPlaylistMenuOpen, setIsPlaylistMenuOpen] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [suggestedTracks, setSuggestedTracks] = useState<Track[]>([]);
  const [isSearchingAdd, setIsSearchingAdd] = useState(false);

  const totalDuration = playlist.tracks.reduce((acc, t) => acc + t.duration, 0);
  const isPlaylistPlaying = isPlaying && playlist.tracks.some((t) => t.id === currentTrack?.id);
  const heroArt = playlist.coverUrl || playlist.tracks[0]?.coverUrl || ECHO_COVERS.glasswave;
  const playlistTrackIds = new Set(playlist.tracks.map((t) => t.id));

  const savedOfflineCount = playlist.tracks.filter((t) => offlineIds?.has(t.id)).length;
  const allTracksOffline = playlist.tracks.length > 0 && savedOfflineCount === playlist.tracks.length;

  useEffect(() => {
    if (!isAddModalOpen) return;
    if (!addSearchQuery.trim()) {
      setIsSearchingAdd(true);
      getViralSongs()
        .then((res) => setSuggestedTracks(res.slice(0, 15)))
        .finally(() => setIsSearchingAdd(false));
      return;
    }
    const timer = setTimeout(() => {
      setIsSearchingAdd(true);
      searchTracks(addSearchQuery)
        .then((res) => setSuggestedTracks(res.slice(0, 15)))
        .finally(() => setIsSearchingAdd(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [isAddModalOpen, addSearchQuery]);

  const totalMinutes = Math.floor(totalDuration / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minsRemainder = totalMinutes % 60;
  const formattedTotalTime = hours > 0 ? `${hours}h ${minsRemainder}m` : `${totalMinutes}m`;

  const artistSubtitle = playlist.tracks.length > 0
    ? Array.from(new Set(playlist.tracks.map((t) => t.artist))).slice(0, 3).join(', ') +
      (playlist.tracks.length > 3 ? ' and more' : '')
    : playlist.description || 'Curated collection ready for background playback.';

  return (
    <div className="h-full flex flex-col bg-[#080808] overflow-y-auto pb-44 relative select-none">
      {/* Monochrome Blurred Cover Header fading into #080808 */}
      <div className="relative overflow-hidden pt-safe px-4 sm:px-8 pt-4 pb-5">
        <img
          src={heroArt}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover brightness-[0.36] contrast-110 blur-3xl opacity-55 scale-125 pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-[#080808]/80 to-[#080808] pointer-events-none" />

        {/* Minimal Top Back Button */}
        <div className="relative z-10 flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white transition active:scale-95 cursor-pointer"
            aria-label="Back to library"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {!playlist.isLikedSongs && onDeletePlaylist && (
            <button
              type="button"
              onClick={() => setIsPlaylistMenuOpen(true)}
              className="w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-[#A3A3A3] hover:text-white transition cursor-pointer"
              aria-label="Playlist options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Centered Large Full-Color Artwork (Screenshot 3 Playlist Screen) */}
        <div className="relative z-10 flex flex-col items-center md:items-start">
          <div className="w-52 h-52 sm:w-56 sm:h-56 mx-auto md:mx-0 rounded-[4px] shadow-[0_24px_60px_rgba(0,0,0,0.85)] overflow-hidden bg-[#191919] flex items-center justify-center">
            {playlist.coverUrl || playlist.tracks[0]?.coverUrl ? (
              <img
                src={playlist.coverUrl || playlist.tracks[0].coverUrl}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = ECHO_COVERS.glasswave;
                }}
                className="w-full h-full object-cover"
                alt={playlist.name}
              />
            ) : playlist.isLikedSongs ? (
              <div className="w-full h-full bg-gradient-to-br from-[#2B2B2B] to-[#111111] flex items-center justify-center">
                <Heart className="w-16 h-16 text-white fill-white" />
              </div>
            ) : (
              <Music className="w-14 h-14 text-[#737373]" />
            )}
          </div>

          {/* Left-Aligned Playlist Title & Attribution */}
          <div className="w-full text-left mt-5">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight truncate">
              {playlist.name}
            </h1>
            <p className="text-xs text-[#A3A3A3] mt-1.5 line-clamp-2 leading-relaxed">
              {artistSubtitle}
            </p>
            <div className="flex items-center gap-2 text-xs text-[#A3A3A3] mt-2 tabular-nums">
              <span className="text-white font-bold">Made for Aura Listener</span>
              <span aria-hidden="true">·</span>
              <span>{playlist.tracks.length} songs</span>
              <span aria-hidden="true">·</span>
              <span>{formattedTotalTime}</span>
            </div>
          </div>

          {/* Action Row: Left Icon Cluster (Heart, Download, Shuffle, ...) + Right Circular White Play CTA */}
          <div className="w-full flex items-center justify-between gap-4 mt-4">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (playlist.tracks[0] && onAddTrackToLiked) {
                    onAddTrackToLiked(playlist.tracks[0]);
                  }
                }}
                disabled={playlist.tracks.length === 0}
                className="w-10 h-10 rounded-full flex items-center justify-center text-[#A3A3A3] hover:text-white transition cursor-pointer disabled:opacity-40"
                title="Like top track"
                aria-label="Like playlist highlight"
              >
                <Heart className={`w-5 h-5 ${playlist.isLikedSongs ? 'fill-white text-white' : ''}`} />
              </button>

              {onToggleSaveOffline && (
                <button
                  type="button"
                  onClick={() => {
                    const firstUnsaved = playlist.tracks.find((t) => canSaveTrackOffline(t) && !offlineIds?.has(t.id));
                    if (firstUnsaved) {
                      onToggleSaveOffline(firstUnsaved);
                    }
                  }}
                  disabled={playlist.tracks.length === 0}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer disabled:opacity-40 ${
                    allTracksOffline ? 'text-white' : 'text-[#A3A3A3] hover:text-white'
                  }`}
                  title="Save track offline"
                  aria-label="Download offline"
                >
                  <Download className="w-5 h-5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (playlist.tracks.length > 0) {
                    const idx = Math.floor(Math.random() * playlist.tracks.length);
                    onPlayTrack(playlist.tracks[idx], playlist);
                  }
                }}
                disabled={playlist.tracks.length === 0}
                className="w-10 h-10 rounded-full flex items-center justify-center text-[#A3A3A3] hover:text-white transition cursor-pointer disabled:opacity-40"
                title="Shuffle play"
                aria-label="Shuffle play"
              >
                <Shuffle className="w-5 h-5" />
              </button>

              {onAddTrackToPlaylist && (
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[#A3A3A3] hover:text-white transition cursor-pointer"
                  title="Add songs to playlist"
                  aria-label="Add songs"
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsPlaylistMenuOpen(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-[#A3A3A3] hover:text-white transition cursor-pointer"
                title="Playlist options"
                aria-label="More playlist options"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => playlist.tracks.length > 0 && onPlayTrack(playlist.tracks[0], playlist)}
              disabled={playlist.tracks.length === 0}
              className="w-14 h-14 rounded-full bg-white text-black hover:bg-[#E5E5E5] active:scale-95 transition shadow-2xl flex items-center justify-center shrink-0 disabled:opacity-40 cursor-pointer"
              aria-label={isPlaylistPlaying ? 'Pause playlist' : 'Play playlist'}
            >
              {isPlaylistPlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-0.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Borderless Track List (Screenshot 3 Right Panel) */}
      <div className="px-2 sm:px-6 pt-1 pb-10">
        {playlist.tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl bg-[#111111] border border-[#303030] mx-2 p-6">
            <Music className="w-11 h-11 mb-3 text-[#737373]" />
            <h2 className="text-lg font-bold text-white mb-1">This playlist is empty</h2>
            <p className="text-xs text-[#A3A3A3] mb-4">Add official songs using the button below.</p>
            {onAddTrackToPlaylist && (
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="aura-btn-primary px-5 py-2.5 rounded-full text-xs font-bold cursor-pointer"
              >
                Add Songs
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {playlist.tracks.map((track, index) => (
              <SongRow
                key={`${track.id}-${index}`}
                track={track}
                index={index}
                isActive={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                isOfflineSaved={offlineIds?.has(track.id)}
                isSavingOffline={savingOfflineId === track.id}
                onPlay={() => onPlayTrack(track, playlist)}
                onToggleSaveOffline={onToggleSaveOffline ? () => onToggleSaveOffline(track) : undefined}
                onAddToQueue={onAddToQueue ? () => onAddToQueue(track) : undefined}
                onMoreOptions={() => setSheetTrack(track)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Playlist Actions Menu Sheet */}
      {isPlaylistMenuOpen && (
        <div
          onClick={() => setIsPlaylistMenuOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md aura-sheet rounded-t-3xl sm:rounded-2xl p-6 pb-8 space-y-2"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#303030]">
              <h3 className="text-base font-bold text-white truncate">{playlist.name}</h3>
              <button
                type="button"
                onClick={() => setIsPlaylistMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-[#222222] flex items-center justify-center text-[#A3A3A3] hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {onAddTrackToPlaylist && (
              <button
                type="button"
                onClick={() => {
                  setIsPlaylistMenuOpen(false);
                  setIsAddModalOpen(true);
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-[#191919] border border-[#303030] hover:bg-[#222222] text-sm font-semibold text-white transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add songs to playlist</span>
              </button>
            )}

            {!playlist.isLikedSongs && onDeletePlaylist && (
              <button
                type="button"
                onClick={() => {
                  setIsPlaylistMenuOpen(false);
                  onDeletePlaylist();
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-[#191919] border border-[#303030] hover:bg-[#222222] text-sm font-semibold text-[#A3A3A3] hover:text-white transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete playlist</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add Songs Modal */}
      {isAddModalOpen && onAddTrackToPlaylist && (
        <div
          onClick={() => setIsAddModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg aura-sheet rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-h-[82vh] flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Add Songs to {playlist.name}</h3>
                <p className="text-xs text-[#A3A3A3] mt-0.5">Search official songs or pick from trending</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-9 h-9 rounded-full bg-[#222222] border border-[#303030] flex items-center justify-center text-[#A3A3A3] hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <SearchBar
              value={addSearchQuery}
              onChange={setAddSearchQuery}
              placeholder="Search tracks to add..."
              size="md"
            />

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {isSearchingAdd ? (
                <p className="text-xs text-[#A3A3A3] py-8 text-center">Searching catalog...</p>
              ) : (
                suggestedTracks.map((track) => {
                  const alreadyIn = playlistTrackIds.has(track.id);
                  return (
                    <div
                      key={track.id}
                      className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-[#191919] transition"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <img
                          src={track.coverUrl || ECHO_COVERS.global}
                          alt={track.title}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-[2px] object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{track.title}</p>
                          <p className="text-[11px] text-[#A3A3A3] truncate">{track.artist}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={alreadyIn}
                        onClick={() => onAddTrackToPlaylist(track, playlist.id)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1 shrink-0 transition cursor-pointer ${
                          alreadyIn
                            ? 'bg-[#222222] text-[#737373] border border-[#303030] cursor-default'
                            : 'aura-btn-primary'
                        }`}
                      >
                        {alreadyIn ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Added</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

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
                className="w-24 h-24 rounded-md object-cover shadow-2xl mb-3.5"
              />
              <h3 className="text-base font-extrabold text-white truncate max-w-full">{sheetTrack.title}</h3>
              <p className="text-xs text-[#A3A3A3] mt-1 truncate max-w-full">{sheetTrack.artist}</p>
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  onPlayTrack(sheetTrack, playlist);
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

              {onAddTrackToLiked && !playlist.isLikedSongs && (
                <button
                  type="button"
                  onClick={() => {
                    onAddTrackToLiked(sheetTrack);
                    setSheetTrack(null);
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-[#191919] border border-[#303030] hover:bg-[#222222] text-sm font-semibold text-white transition cursor-pointer"
                >
                  <Heart className="w-4 h-4" />
                  <span>Like song</span>
                </button>
              )}

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

              {onRemoveTrack && (
                <button
                  type="button"
                  onClick={() => {
                    onRemoveTrack(sheetTrack.id);
                    setSheetTrack(null);
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-[#191919] border border-[#303030] hover:bg-[#222222] text-sm font-semibold text-[#A3A3A3] hover:text-white transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{playlist.isLikedSongs ? 'Remove from Liked Songs' : 'Remove from Playlist'}</span>
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
