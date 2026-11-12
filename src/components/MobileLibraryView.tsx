import React, { useState } from 'react';
import { Plus, Search, Heart, Music, ListFilter } from 'lucide-react';
import { Playlist } from '../types';

interface MobileLibraryViewProps {
  playlists: Playlist[];
  onSelectPlaylist: (playlist: Playlist) => void;
  onCreatePlaylist: () => void;
}

export default function MobileLibraryView({
  playlists,
  onSelectPlaylist,
  onCreatePlaylist,
}: MobileLibraryViewProps) {
  const [filter, setFilter] = useState<'all' | 'playlists' | 'artists'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  const filteredPlaylists = playlists.filter(p => {
    if (searchFilter && !p.name.toLowerCase().includes(searchFilter.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="p-4 pb-36 text-white min-h-screen">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1db954] text-black font-bold flex items-center justify-center text-sm shadow">
            M
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Your Library</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onCreatePlaylist}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 transition"
            aria-label="Create playlist"
          >
            <Plus className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Filter Tabs / Pills */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
            filter === 'all' ? 'bg-white text-black' : 'bg-[#282828] text-white hover:bg-[#333]'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('playlists')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
            filter === 'playlists' ? 'bg-white text-black' : 'bg-[#282828] text-white hover:bg-[#333]'
          }`}
        >
          Playlists
        </button>
      </div>

      {/* Search & Sort row */}
      <div className="flex items-center justify-between mb-4 text-xs text-[#b3b3b3]">
        <div className="flex items-center gap-2 bg-[#181818] px-2.5 py-1.5 rounded-md flex-1 max-w-[220px]">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search in Your Library"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="bg-transparent border-none outline-none text-xs text-white placeholder-gray-500 w-full"
          />
        </div>
        <div className="flex items-center gap-1 cursor-pointer hover:text-white">
          <span>Recents</span>
          <ListFilter className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Playlists & Liked Songs List */}
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
    </div>
  );
}
