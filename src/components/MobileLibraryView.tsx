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
    <div className="px-4 sm:px-6 pt-2 pb-36 text-white min-h-screen">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.m4a,.aac,.flac,.wav,.ogg"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Action Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="hidden md:block text-2xl font-extrabold tracking-tight">Your Library</h2>
          <p className="text-xs text-white/55">Playlists, liked songs &amp; offline device vault</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-1.5 rounded-full bg-[#1D1F27] hover:bg-[#252833] border border-white/[0.08] px-3.5 min-h-[38px] text-xs font-semibold text-white transition active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
            title="Import MP3, M4A, FLAC, or WAV files from your device"
          >
            <Upload className="w-3.5 h-3.5 text-[#FACC15]" />
            <span>{isImporting ? 'Importing...' : 'Import Audio'}</span>
          </button>
          <button
            onClick={onCreatePlaylist}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#F43F5E] hover:bg-[#FB7185] text-white active:scale-95 transition cursor-pointer shadow-lg shadow-rose-500/20"
            aria-label="Create playlist"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 min-h-[34px] rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
            filter === 'all' ? 'bg-[#F43F5E] text-white' : 'bg-[#1D1F27] text-white/75 hover:bg-[#252833]'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('playlists')}
          className={`px-4 min-h-[34px] rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
            filter === 'playlists' ? 'bg-[#F43F5E] text-white' : 'bg-[#1D1F27] text-white/75 hover:bg-[#252833]'
          }`}
        >
          Playlists
        </button>
        <button
          onClick={() => setFilter('offline')}
          className={`px-4 min-h-[34px] rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer flex items-center gap-1.5 ${
            filter === 'offline' ? 'bg-[#FACC15] text-black' : 'bg-[#1D1F27] text-white/75 hover:bg-[#252833]'
          }`}
        >
          <HardDriveDownload className="w-3.5 h-3.5" />
          <span>Offline Vault ({offlineTracks.length})</span>
        </button>
      </div>

      {/* Search & Sort row */}
      <div className="flex items-center justify-between mb-5 text-xs text-white/60 gap-2">
        <div className="flex items-center gap-2 bg-[#1D1F27] px-3.5 py-2.5 rounded-xl flex-1 max-w-xs border border-white/[0.06]">
          <Search className="w-3.5 h-3.5 text-white/45 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search library & saved audio"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="bg-transparent border-none outline-none text-xs text-white placeholder-white/40 w-full"
          />
        </div>
        <div className="flex items-center gap-1 text-white/60">
          <span>Recents</span>
          <ListFilter className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Offline & Local Audio Vault Section */}
      {filter !== 'playlists' && (
        <div className="mb-7">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <HardDriveDownload className="w-4 h-4 text-[#FACC15]" />
              <span>Offline &amp; Local Vault</span>
            </h2>
            {offlineTracks.length > 0 && (
              <button
                onClick={() => onPlayTrack(offlineTracks[0], undefined, offlineTracks)}
                className="text-xs font-bold text-[#FACC15] hover:underline cursor-pointer"
              >
                Play all ({offlineTracks.length})
              </button>
            )}
          </div>

          {filteredOfflineTracks.length === 0 ? (
            <div className="rounded-2xl bg-[#1D1F27] border border-white/[0.06] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs text-white/70">
                <p className="font-bold text-white">Play anytime with zero internet connection</p>
                <p className="mt-0.5 text-white/50">
                  Save tracks for offline use or import personal MP3, M4A, FLAC, or WAV files from your device.
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-full bg-[#FACC15] text-black text-xs font-bold hover:brightness-110 transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                Choose Audio Files
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOfflineTracks.map((track) => {
                const isActive = currentTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    onClick={() => onPlayTrack(track, undefined, offlineTracks)}
                    className={`group flex items-center justify-between gap-3 p-2.5 rounded-xl transition cursor-pointer border ${
                      isActive
                        ? 'bg-[#252833] border-[#F43F5E]/40'
                        : 'bg-[#1D1F27] hover:bg-[#252833] border-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-[#131418] flex items-center justify-center">
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
                        <p className={`text-sm font-bold truncate ${isActive ? 'text-[#FACC15]' : 'text-white'}`}>
                          {track.title}
                        </p>
                        <p className="text-xs text-white/55 truncate">
                          {track.artist} ·{' '}
                          <span className="text-[#FACC15]">{track.source === 'local' ? 'Local File' : 'Offline Ready'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-white/45 tabular-nums">{formatDuration(track.duration)}</span>
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
                className="flex items-center gap-3.5 p-2.5 rounded-xl bg-[#1D1F27] hover:bg-[#252833] border border-white/[0.05] transition cursor-pointer"
              >
                {isLiked ? (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#F43F5E] to-[#9333EA] flex items-center justify-center flex-shrink-0 shadow">
                    <Heart className="w-6 h-6 fill-white text-white" />
                  </div>
                ) : playlist.coverUrl ? (
                  <img
                    src={playlist.coverUrl}
                    alt={playlist.name}
                    className="w-14 h-14 rounded-xl object-cover flex-shrink-0 shadow"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-[#252833] flex items-center justify-center flex-shrink-0 shadow text-white/50">
                    <Music className="w-6 h-6" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-white truncate">{playlist.name}</h3>
                  <p className="text-xs text-white/55 mt-0.5 truncate tabular-nums">
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
