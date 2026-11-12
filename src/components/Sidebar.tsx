import { Home, Search, Library, Plus, ArrowRight, List, Heart } from 'lucide-react';
import { Playlist } from '../types';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: 'home' | 'search' | 'library' | 'playlist' | 'viral' | 'artists') => void;
  onSearchShortcut: (query: string) => void;
  playlists: Playlist[];
  onSelectPlaylist: (playlist: Playlist) => void;
  onCreatePlaylist: () => void;
}

export default function Sidebar({ currentView, onViewChange, onSearchShortcut, playlists, onSelectPlaylist, onCreatePlaylist }: SidebarProps) {

  const handleNavClick = (view: 'home' | 'search' | 'library' | 'viral' | 'artists') => {
    onViewChange(view);
    if (view === 'search') {
      onSearchShortcut('Search'); // Trigger focus
    }
  };

  const handlePlaylistClick = (playlist: Playlist) => {
    onSelectPlaylist(playlist);
  };

  return (
    <div className="w-[340px] bg-black h-full flex flex-col gap-2 flex-shrink-0 select-none">
      
      {/* Top Panel */}
      <div className="bg-[#121212] rounded-xl px-5 py-5 flex flex-col gap-4 border border-white/5">
        <div 
          onClick={() => handleNavClick('home')}
          className={`flex items-center gap-4 cursor-pointer transition font-bold text-sm ${currentView === 'home' ? 'text-white' : 'text-[#b3b3b3] hover:text-white'}`}
        >
          <Home className={`w-5 h-5 ${currentView === 'home' ? 'text-[#1db954] fill-current' : ''}`} />
          Home
        </div>
        <div 
          onClick={() => handleNavClick('search')}
          className={`flex items-center gap-4 cursor-pointer transition font-bold text-sm ${currentView === 'search' ? 'text-white' : 'text-[#b3b3b3] hover:text-white'}`}
        >
          <Search className={`w-5 h-5 ${currentView === 'search' ? 'text-[#1db954]' : ''}`} />
          Search
        </div>
        <div 
          onClick={() => handleNavClick('viral')}
          className={`flex items-center gap-4 cursor-pointer transition font-bold text-sm ${currentView === 'viral' ? 'text-white' : 'text-[#b3b3b3] hover:text-white'}`}
        >
          <span className="w-5 h-5 flex items-center justify-center text-rose-400 font-extrabold text-xs">🔥</span>
          Viral Hits
        </div>
        <div 
          onClick={() => handleNavClick('artists')}
          className={`flex items-center gap-4 cursor-pointer transition font-bold text-sm ${currentView === 'artists' || currentView === 'artist' ? 'text-white' : 'text-[#b3b3b3] hover:text-white'}`}
        >
          <span className="w-5 h-5 flex items-center justify-center text-[#1db954] font-extrabold text-xs">★</span>
          Featured Artists
        </div>
      </div>

      {/* Bottom Panel (Library) */}
      <div className="bg-[#121212] rounded-lg flex-1 flex flex-col overflow-hidden">
        {/* Library Header */}
        <div className="px-6 py-4 flex items-center justify-between shadow-sm z-10">
          <div 
            onClick={() => handleNavClick('library')}
            className={`flex items-center gap-4 cursor-pointer transition font-bold ${currentView === 'library' ? 'text-white' : 'text-[#b3b3b3] hover:text-white'}`}
          >
            <Library className={`w-7 h-7 ${currentView === 'library' ? 'fill-current' : ''}`} />
            Your Library
          </div>
          <div className="flex items-center gap-4 text-[#b3b3b3]">
            <Plus onClick={onCreatePlaylist} className="w-5 h-5 hover:text-white hover:bg-[#1a1a1a] rounded-full p-0.5 cursor-pointer transition" />
            <ArrowRight className="w-5 h-5 hover:text-white hover:bg-[#1a1a1a] rounded-full p-0.5 cursor-pointer transition" />
          </div>
        </div>

        {/* Filter Chips */}
        <div className="px-6 py-2 flex items-center gap-2 text-sm">
          <span className="bg-[#2a2a2a] hover:bg-[#333333] transition-colors text-white px-3 py-1 rounded-full cursor-pointer">Playlists</span>
          <span className="bg-[#2a2a2a] hover:bg-[#333333] transition-colors text-white px-3 py-1 rounded-full cursor-pointer">Artists</span>
        </div>

        {/* Sort/View Row */}
        <div className="px-6 py-2 flex items-center justify-between text-sm text-[#b3b3b3]">
          <div className="flex items-center gap-2 hover:text-white cursor-pointer transition">
            <Search className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 hover:text-white cursor-pointer transition font-semibold">
            Recents
            <List className="w-4 h-4" />
          </div>
        </div>

        {/* Library List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1 mt-2">
          {playlists.map((playlist) => (
            <div 
              key={playlist.id}
              onClick={() => handlePlaylistClick(playlist)}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-[#1a1a1a] cursor-pointer transition group"
            >
              <div className={`w-12 h-12 rounded-md flex-shrink-0 flex items-center justify-center shadow-md ${playlist.isLikedSongs ? 'bg-gradient-to-br from-indigo-600 to-purple-400' : 'bg-[#282828]'}`}>
                 {playlist.coverUrl ? (
                   <img src={playlist.coverUrl} className="w-full h-full object-cover rounded-md" alt={playlist.name} />
                 ) : playlist.isLikedSongs ? (
                   <Heart className="w-5 h-5 text-white fill-current" />
                 ) : (
                   <span className="text-gray-500 font-bold text-lg">♪</span>
                 )}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-white font-medium truncate">{playlist.name}</span>
                <span className="text-sm text-[#b3b3b3] flex items-center gap-1 truncate">
                  {playlist.isLikedSongs && <span className="text-[#1db954] text-xs">★</span>}
                  Playlist • {playlist.isLikedSongs ? '1,204' : playlist.tracks.length} songs
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
