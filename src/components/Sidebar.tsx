import React, { useRef } from 'react';
import {
  Home,
  Search,
  Compass,
  Library,
  Plus,
  Heart,
  HardDriveDownload,
  Upload,
  User,
  Settings,
  Clock,
  Play,
  ListMusic,
} from 'lucide-react';
import { AppView, Playlist, Track } from '../types';
import AuraLogo from './design/AuraLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { ECHO_COVERS } from './echoCovers';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: AppView) => void;
  onSearchShortcut: (query: string) => void;
  playlists: Playlist[];
  offlineCount: number;
  recentlyPlayed: Track[];
  currentTrack: Track | null;
  onSelectPlaylist: (playlist: Playlist) => void;
  onCreatePlaylist: () => void;
  onImportLocalFiles: (files: FileList) => Promise<void>;
  onPlayTrack: (track: Track, contextPlaylist?: Playlist, contextTrackList?: Track[]) => void;
}

export default function Sidebar({
  currentView,
  onViewChange,
  onSearchShortcut,
  playlists,
  offlineCount,
  recentlyPlayed,
  currentTrack,
  onSelectPlaylist,
  onCreatePlaylist,
  onImportLocalFiles,
  onPlayTrack,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleNavClick = (view: AppView) => {
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

  const mainNav = [
    { id: 'home' as const, label: 'Home', icon: Home, active: currentView === 'home' },
    {
      id: 'explore' as const,
      label: 'Explore',
      icon: Compass,
      active:
        currentView === 'explore' ||
        currentView === 'viral' ||
        currentView === 'charts' ||
        currentView === 'artists' ||
        currentView === 'artist',
    },
    { id: 'search' as const, label: 'Search', icon: Search, active: currentView === 'search' },
    {
      id: 'library' as const,
      label: 'Your Library',
      icon: Library,
      active: currentView === 'library' || currentView === 'playlist',
    },
    { id: 'queue' as const, label: 'Playing Queue', icon: ListMusic, active: currentView === 'queue' },
    { id: 'profile' as const, label: 'Profile', icon: User, active: currentView === 'profile' },
    { id: 'settings' as const, label: 'Settings', icon: Settings, active: currentView === 'settings' },
  ];

  return (
    <aside className="w-[264px] lg:w-[288px] h-full flex flex-col gap-2 flex-shrink-0 select-none">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.m4a,.aac,.flac,.wav,.ogg"
        onChange={handleFilesSelected}
        className="hidden"
      />

      {/* Brand + Main Navigation */}
      <div className="bg-[#111111] border border-[#303030] rounded-2xl px-3 py-4 flex flex-col gap-1">
        <div
          onClick={() => handleNavClick('home')}
          className="px-2.5 pb-3.5 mb-1.5 border-b border-[#303030] cursor-pointer"
        >
          <AuraLogo />
        </div>

        {mainNav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`flex items-center gap-3 px-3 min-h-[40px] rounded-xl cursor-pointer transition-colors text-sm font-semibold text-left whitespace-nowrap shrink-0 ${
                item.active
                  ? 'bg-[#222222] text-white border border-[#303030]'
                  : 'text-[#A3A3A3] hover:text-white hover:bg-[#191919] border border-transparent'
              }`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Library + Playlists + Recently Played */}
      <div className="bg-[#111111] border border-[#303030] rounded-2xl flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b border-[#303030]">
          <button
            type="button"
            onClick={() => handleNavClick('library')}
            className="text-xs font-bold text-white hover:text-[#A3A3A3] transition cursor-pointer"
          >
            Playlists &amp; Vault
          </button>
          <div className="flex items-center gap-1 text-[#A3A3A3]">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-8 h-8 flex items-center justify-center hover:text-white hover:bg-[#222222] rounded-lg cursor-pointer transition"
              title="Import local audio files"
              aria-label="Import local audio files"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onCreatePlaylist}
              className="w-8 h-8 flex items-center justify-center hover:text-white hover:bg-[#222222] rounded-lg cursor-pointer transition"
              title="Create playlist"
              aria-label="Create playlist"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-4">
          {/* Offline Vault Quick Entry */}
          <div>
            <div
              onClick={() => handleNavClick('library')}
              className={`flex items-center gap-3 p-2 rounded-xl hover:bg-[#191919] cursor-pointer transition ${
                currentView === 'library' ? 'bg-[#191919] border border-[#303030]' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center bg-[#222222] border border-[#303030] text-white">
                <HardDriveDownload className="w-4 h-4" />
              </div>
              <div className="flex flex-col truncate min-w-0">
                <span className="text-white text-xs font-bold truncate">Offline Vault</span>
                <span className="text-[11px] text-[#737373] truncate tabular-nums">
                  {offlineCount} {offlineCount === 1 ? 'track' : 'tracks'}
                </span>
              </div>
            </div>
          </div>

          {/* Playlists */}
          <div className="space-y-1">
            <p className="px-2 text-[11px] font-semibold text-[#737373] mb-1">Your Playlists</p>
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                onClick={() => onSelectPlaylist(playlist)}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#191919] cursor-pointer transition group"
              >
                <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center overflow-hidden border border-[#303030] bg-[#191919]">
                  {playlist.coverUrl || playlist.tracks[0]?.coverUrl ? (
                    <img
                      src={playlist.coverUrl || playlist.tracks[0].coverUrl}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      alt={playlist.name}
                    />
                  ) : playlist.isLikedSongs ? (
                    <Heart className="w-4 h-4 text-white fill-white" />
                  ) : (
                    <span className="text-[#737373] font-bold text-xs">♪</span>
                  )}
                </div>
                <div className="flex flex-col truncate min-w-0">
                  <span className="text-white text-xs font-semibold truncate">{playlist.name}</span>
                  <span className="text-[11px] text-[#737373] truncate tabular-nums">
                    {playlist.tracks.length} {playlist.tracks.length === 1 ? 'song' : 'songs'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Recently Played */}
          {recentlyPlayed.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-[#303030]">
              <p className="px-2 text-[11px] font-semibold text-[#737373] flex items-center gap-1.5 mb-1">
                <Clock className="w-3 h-3" />
                <span>Recently Played</span>
              </p>
              {recentlyPlayed.slice(0, 5).map((track, idx) => {
                const isActive = currentTrack?.id === track.id;
                return (
                  <div
                    key={`${track.id}-side-${idx}`}
                    onClick={() => onPlayTrack(track, undefined, recentlyPlayed)}
                    className={`flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-[#191919] cursor-pointer transition group ${
                      isActive ? 'bg-[#222222]' : ''
                    }`}
                  >
                    <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-[#191919]">
                      <img
                        src={track.coverUrl || ECHO_COVERS.global}
                        alt={track.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = ECHO_COVERS.global;
                        }}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-3.5 h-3.5 text-white fill-current ml-0.5" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white truncate">{track.title}</p>
                      <p className="text-[11px] text-[#737373] truncate">{track.artist}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-[#303030]">
          <PWAInstallButton variant="sidebar" />
        </div>
      </div>
    </aside>
  );
}
