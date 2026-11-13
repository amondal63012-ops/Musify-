import React, { useRef, useState } from 'react';
import {
  Plus,
  Search,
  Heart,
  Music,
  ListFilter,
  HardDriveDownload,
  Upload,
  Play,
  Pause,
  Trash2,
} from 'lucide-react';
import { Playlist, Track } from '../types';

interface MobileLibraryViewProps {
  playlists: Playlist[];
  offlineTracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onSelectPlaylist: (playlist: Playlist) => void;
  onCreatePlaylist: () => void;
  onPlayTrack: (track: Track, contextPlaylist?: Playlist, contextTrackList?: Track[]) => void;
  onImportLocalFiles: (files: FileList) => Promise<void>;
  onRemoveOfflineTrack: (trackId: string) => Promise<void>;
}

export default function MobileLibraryView({
  playlists,
  offlineTracks,
  currentTrack,
  isPlaying,
  onSelectPlaylist,
  onCreatePlaylist,
  onPlayTrack,
  onImportLocalFiles,
  onRemoveOfflineTrack,
}: MobileLibraryViewProps) {
  const [filter, setFilter] = useState<'all' | 'playlists' | 'offline'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const q = searchFilter.trim().toLowerCase();
  const filteredPlaylists = playlists.filter((p) => {
    if (filter === 'offline') return false;
    if (q && !p.name.toLowerCase().includes(q)) return false;
    return true;
  });

  const filteredOfflineTracks = offlineTracks.filter((t) => {
    if (filter === 'playlists') return false;
    if (q && !`${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsImporting(true);
    try {
      await onImportLocalFiles(files);
      setFilter('offline');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatDuration = (ms: number) => {
    if (!ms || isNaN(ms)) return '0:00';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="p-4 sm:p-6 pb-36 text-white min-h-screen">
      {/* Hidden File Input for Local MP3/FLAC/M4A/WAV Import */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.m4a,.aac,.flac,.wav,.ogg"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1db954] text-black font-bold flex items-center justify-center text-sm shadow">
            A
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Your Library</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-1.5 rounded-full bg-[#242424] hover:bg-[#303030] border border-white/10 px-3 min-h-[38px] text-xs font-semibold text-white transition active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
            title="Import MP3, M4A, FLAC, or WAV files from your device"
          >
            <Upload className="w-3.5 h-3.5 text-[#1db954]" />
            <span>{isImporting ? 'Importing...' : 'Import Audio'}</span>
          </button>
          <button
            onClick={onCreatePlaylist}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 transition cursor-pointer"
            aria-label="Create playlist"
          >
            <Plus className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`px-3.5 min-h-[34px] rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
            filter === 'all' ? 'bg-white text-black' : 'bg-[#282828] text-white hover:bg-[#333]'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('playlists')}
          className={`px-3.5 min-h-[34px] rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
            filter === 'playlists' ? 'bg-white text-black' : 'bg-[#282828] text-white hover:bg-[#333]'
          }`}
        >
          Playlists
        </button>
        <button
          onClick={() => setFilter('offline')}
          className={`px-3.5 min-h-[34px] rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer flex items-center gap-1.5 ${
            filter === 'offline' ? 'bg-[#1db954] text-black font-bold' : 'bg-[#282828] text-white hover:bg-[#333]'
          }`}
        >
          <HardDriveDownload className="w-3.5 h-3.5" />
          <span>Offline &amp; Local ({offlineTracks.length})</span>
        </button>
      </div>

      {/* Search & Sort row */}
      <div className="flex items-center justify-between mb-4 text-xs text-[#b3b3b3] gap-2">
        <div className="flex items-center gap-2 bg-[#181818] px-3 py-2 rounded-lg flex-1 max-w-xs border border-white/5">
          <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search library & saved audio"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="bg-transparent border-none outline-none text-xs text-white placeholder-gray-500 w-full"
          />
        </div>
        <div className="flex items-center gap-1 text-white/60">
          <span>Recents</span>
          <ListFilter className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Offline & Local Audio Vault Section */}
      {filter !== 'playlists' && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <HardDriveDownload className="w-4 h-4 text-[#1db954]" />
              <span>Offline &amp; Local Vault</span>
            </h2>
            {offlineTracks.length > 0 && (
              <button
                onClick={() => onPlayTrack(offlineTracks[0], undefined, offlineTracks)}
                className="text-xs font-bold text-[#1db954] hover:underline cursor-pointer"
              >
                Play all ({offlineTracks.length})
              </button>
            )}
          </div>

          {filteredOfflineTracks.length === 0 ? (
            <div className="rounded-xl bg-[#181818] border border-white/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs text-white/70">
                <p className="font-semibold text-white">Play anytime with zero internet connection</p>
                <p className="mt-0.5 text-white/50">
                  Save direct tracks for offline use or import personal MP3, M4A, FLAC, or WAV files from your device.
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-full bg-white text-black text-xs font-bold hover:bg-white/90 transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                Choose Audio Files
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredOfflineTracks.map((track) => {
                const isActive = currentTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    onClick={() => onPlayTrack(track, undefined, offlineTracks)}
                    className={`group flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-white/10 active:bg-white/15 transition cursor-pointer ${
                      isActive ? 'bg-white/10' : 'bg-[#181818]/70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative w-11 h-11 rounded overflow-hidden flex-shrink-0 bg-[#282828] flex items-center justify-center">
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          {isActive && isPlaying ? (
                            <Pause className="w-4 h-4 text-[#1db954] fill-current" />
                          ) : (
                            <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold truncate ${isActive ? 'text-[#1db954]' : 'text-white'}`}>
                          {track.title}
                        </p>
                        <p className="text-xs text-[#b3b3b3] truncate">
                          {track.artist} · <span className="text-[#1db954]">{track.source === 'local' ? 'Local File' : 'Offline Ready'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-white/50 tabular-nums">{formatDuration(track.duration)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveOfflineTrack(track.id);
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-white/50 hover:text-rose-400 hover:bg-white/10 transition cursor-pointer"
                        title="Remove from offline vault"
                        aria-label="Remove offline track"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Playlists & Liked Songs List */}
      {filter !== 'offline' && (
        <div className="space-y-2">
          {filteredPlaylists.map((playlist) => {
            const isLiked = playlist.isLikedSongs;
            const trackCount = playlist.tracks.length;

            return (
              <div
                key={playlist.id}
                onClick={() => onSelectPlaylist(playlist)}
                className="flex items-center gap-3.5 p-2 rounded-lg hover:bg-white/5 active:bg-white/10 transition cursor-pointer"
              >
                {isLiked ? (
                  <div className="w-14 h-14 rounded-md bg-gradient-to-br from-[#450af5] to-[#8e8ee5] flex items-center justify-center flex-shrink-0 shadow">
                    <Heart className="w-6 h-6 fill-white text-white" />
                  </div>
                ) : playlist.coverUrl ? (
                  <img
                    src={playlist.coverUrl}
                    alt={playlist.name}
                    className="w-14 h-14 rounded-md object-cover flex-shrink-0 shadow"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-md bg-[#282828] flex items-center justify-center flex-shrink-0 shadow text-gray-400">
                    <Music className="w-6 h-6" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-white truncate">{playlist.name}</h3>
                  <p className="text-xs text-[#b3b3b3] mt-0.5 truncate">
                    Playlist · {trackCount} {trackCount === 1 ? 'song' : 'songs'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
