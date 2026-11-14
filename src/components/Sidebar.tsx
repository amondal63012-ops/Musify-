import React, { useRef } from 'react';
import {
  Home,
  Search,
  Library,
  Plus,
  List,
  Heart,
  Flame,
  Award,
  HardDriveDownload,
  Upload,
} from 'lucide-react';
import { Playlist } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: 'home' | 'search' | 'library' | 'playlist' | 'viral' | 'artists') => void;
  onSearchShortcut: (query: string) => void;
  playlists: Playlist[];
  offlineCount: number;
  onSelectPlaylist: (playlist: Playlist) => void;
  onCreatePlaylist: () => void;
  onImportLocalFiles: (files: FileList) => Promise<void>;
}

export default function Sidebar({
  currentView,
  onViewChange,
  onSearchShortcut,
  playlists,
  offlineCount,
  onSelectPlaylist,
  onCreatePlaylist,
  onImportLocalFiles,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleNavClick = (view: 'home' | 'search' | 'library' | 'viral' | 'artists') => {
    onViewChange(view);
    if (view === 'search') {
      onSearchShortcut('Search');
    }
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await onImportLocalFiles(files);
      onViewChange('library');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-[280px] lg:w-[300px] bg-[#0D0E12] h-full flex flex-col gap-2.5 flex-shrink-0 select-none">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.m4a,.aac,.flac,.wav,.ogg"
        onChange={handleFilesSelected}
        className="hidden"
      />

      {/* Top Navigation Panel */}
      <div className="bg-[#181A22] rounded-2xl px-5 py-4 flex flex-col gap-3 border border-white/[0.06]">
        <button
          onClick={() => handleNavClick('home')}
          className={`flex items-center gap-3.5 cursor-pointer transition font-bold text-sm text-left py-1 ${
            currentView === 'home' ? 'text-[#FACC15]' : 'text-white/65 hover:text-white'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </button>
        <button
          onClick={() => handleNavClick('search')}
          className={`flex items-center gap-3.5 cursor-pointer transition font-bold text-sm text-left py-1 ${
            currentView === 'search' ? 'text-[#FACC15]' : 'text-white/65 hover:text-white'
          }`}
        >
          <Search className="w-5 h-5" />
          <span>Search</span>
        </button>
        <button
          onClick={() => handleNavClick('viral')}
          className={`flex items-center gap-3.5 cursor-pointer transition font-bold text-sm text-left py-1 ${
            currentView === 'viral' ? 'text-[#F43F5E]' : 'text-white/65 hover:text-white'
          }`}
        >
          <Flame className={`w-5 h-5 ${currentView === 'viral' ? 'text-[#F43F5E]' : 'text-rose-400/80'}`} />
          <span>Viral Hits</span>
        </button>
        <button
          onClick={() => handleNavClick('artists')}
          className={`flex items-center gap-3.5 cursor-pointer transition font-bold text-sm text-left py-1 ${
            currentView === 'artists' || currentView === 'artist' ? 'text-[#FACC15]' : 'text-white/65 hover:text-white'
          }`}
        >
          <Award className={`w-5 h-5 ${currentView === 'artists' || currentView === 'artist' ? 'text-[#FACC15]' : 'text-amber-300/80'}`} />
          <span>Featured Artists</span>
        </button>
      </div>

      {/* Bottom Panel (Library & Offline Vault) */}
      <div className="bg-[#181A22] rounded-2xl flex-1 flex flex-col overflow-hidden border border-white/[0.06]">
        {/* Library Header */}
        <div className="px-5 py-4 flex items-center justify-between z-10">
          <button
            onClick={() => handleNavClick('library')}
            className={`flex items-center gap-3 cursor-pointer transition font-bold text-sm ${
              currentView === 'library' ? 'text-[#FACC15]' : 'text-white/75 hover:text-white'
            }`}
          >
            <Library className="w-5 h-5" />
            <span>Your Library</span>
          </button>
          <div className="flex items-center gap-1 text-white/60">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-8 h-8 flex items-center justify-center hover:text-white hover:bg-white/10 rounded-full cursor-pointer transition"
              title="Import local MP3, M4A, FLAC, or WAV files"
              aria-label="Import audio files"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={onCreatePlaylist}
              className="w-8 h-8 flex items-center justify-center hover:text-white hover:bg-white/10 rounded-full cursor-pointer transition"
              title="Create playlist"
              aria-label="Create playlist"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sort Row */}
        <div className="px-5 pb-2 flex items-center justify-between text-xs text-white/50">
          <span className="font-medium">Saved &amp; Playlists</span>
          <div className="flex items-center gap-1.5 font-semibold">
            <span>Recents</span>
            <List className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Library List */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          {/* Offline & Local Audio Vault shortcut */}
          <div
            onClick={() => handleNavClick('library')}
            className={`flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] cursor-pointer transition ${
              currentView === 'library' ? 'bg-white/[0.08]' : ''
            }`}
          >
            <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center bg-[#FACC15]/15 border border-[#FACC15]/30 text-[#FACC15]">
              <HardDriveDownload className="w-5 h-5" />
            </div>
            <div className="flex flex-col truncate">
              <span className="text-white text-sm font-semibold truncate">Offline &amp; Local Vault</span>
              <span className="text-xs text-white/55 truncate tabular-nums">
                {offlineCount} {offlineCount === 1 ? 'track' : 'tracks'} · Zero internet needed
              </span>
            </div>
          </div>

          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              onClick={() => onSelectPlaylist(playlist)}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] cursor-pointer transition group"
            >
              <div
                className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center shadow-md ${
                  playlist.isLikedSongs ? 'bg-gradient-to-br from-[#F43F5E] to-[#9333EA]' : 'bg-[#252833]'
                }`}
              >
                {playlist.coverUrl ? (
                  <img src={playlist.coverUrl} className="w-full h-full object-cover rounded-xl" alt={playlist.name} />
                ) : playlist.isLikedSongs ? (
                  <Heart className="w-5 h-5 text-white fill-current" />
                ) : (
                  <span className="text-white/60 font-bold text-base">A</span>
                )}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-white text-sm font-semibold truncate">{playlist.name}</span>
                <span className="text-xs text-white/55 truncate tabular-nums">
                  Playlist · {playlist.tracks.length} {playlist.tracks.length === 1 ? 'song' : 'songs'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom PWA Install Card */}
        <div className="p-3 border-t border-white/[0.06]">
          <PWAInstallButton variant="sidebar" />
        </div>
      </div>
    </div>
  );
}
