import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Play, Search, Clock, Pause, Heart, MoreHorizontal, ChevronLeft, ChevronRight, User, Library, Plus, Sparkles, Flame, UserCheck } from 'lucide-react';
import { Track, Playlist, Artist } from '../types';
import { searchArtists } from '../api';
import HomeView from './HomeView';
import BrowseCategories from './BrowseCategories';
import PlaylistView from './PlaylistView';
import MobileLibraryView from './MobileLibraryView';
import ArtistView from './ArtistView';
import ArtistsListView from './ArtistsListView';
import { PWAInstallButton } from './PWAInstallButton';

interface MainViewProps {
  currentView: string;
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, contextPlaylist?: Playlist, contextTrackList?: Track[]) => void;
  onSearch: (query: string) => void;
  isLoading: boolean;
  searchQueryProp?: string;
  selectedPlaylist?: Playlist | null;
  onRemoveTrack?: (trackId: string) => void;
  onDeletePlaylist?: () => void;
  onAddTrackToPlaylist?: (track: Track) => void;
  onAddTrackToLiked?: (track: Track) => void;
  playlists: Playlist[];
  onSelectPlaylist?: (playlist: Playlist) => void;
  onCreatePlaylist?: () => void;
  selectedArtistId?: string | null;
  onSelectArtist?: (artistId: string) => void;
  onBackFromArtist?: () => void;
  onViewChange?: (view: string) => void;
}

const MainView = forwardRef(({ 
  currentView, 
  tracks, 
  currentTrack, 
  isPlaying, 
  onPlayTrack, 
  onSearch, 
  isLoading, 
  searchQueryProp, 
  selectedPlaylist, 
  onRemoveTrack, 
  onDeletePlaylist, 
  onAddTrackToPlaylist, 
  onAddTrackToLiked, 
  playlists, 
  onSelectPlaylist, 
  onCreatePlaylist,
  selectedArtistId,
  onSelectArtist,
  onBackFromArtist,
  onViewChange
}: MainViewProps, ref) => {
  const [searchInput, setSearchInput] = useState('');
  const [matchingArtists, setMatchingArtists] = useState<Artist[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    }
  }));

  useEffect(() => {
    if (searchQueryProp && searchQueryProp !== 'Search') {
      setSearchInput(searchQueryProp);
    } else if (searchQueryProp === 'Search' && searchInputRef.current) {
       searchInputRef.current.focus();
    }
  }, [searchQueryProp]);

  // Live fetch matching artists when user types or submits search
  useEffect(() => {
    if (searchInput.trim()) {
      const timer = setTimeout(() => {
        searchArtists(searchInput).then(res => {
          setMatchingArtists(res || []);
        });
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setMatchingArtists([]);
    }
  }, [searchInput]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearch(searchInput);
    }
  };

  const handleCategoryClick = (cat: string) => {
    setSearchInput(cat);
    onSearch(cat);
  };

  const formatDuration = (ms: number) => {
    if (!ms || isNaN(ms)) return '0:00';
    const mins = Math.floor(ms / 60000);
    const secs = ((ms % 60000) / 1000).toFixed(0);
    return `${mins}:${Number(secs) < 10 ? '0' : ''}${secs}`;
  };

  const topTrack = tracks.length > 0 ? tracks[0] : null;

  return (
    <div className="flex-1 bg-[#121212] rounded-lg overflow-y-auto relative h-full flex flex-col">
      {/* Background Gradient */}
      <div className={`absolute top-0 left-0 w-full h-80 pointer-events-none z-0 transition-colors duration-1000 ${currentView === 'home' ? 'bg-gradient-to-b from-indigo-900/40 via-[#121212]/80 to-[#121212]' : 'bg-gradient-to-b from-[#242424] via-[#121212] to-[#121212]'}`}></div>

      {/* Top Bar (Unified Professional Responsive Header) */}
      <div className={`sticky top-0 z-20 flex-shrink-0 transition-colors ${currentView === 'playlist' || currentView === 'artist' ? 'bg-transparent' : 'bg-[#121212]/95 backdrop-blur-md border-b border-white/5'} px-4 sm:px-6 py-3`}>
        {/* Mobile Header Row */}
        <div className="flex items-center justify-between gap-3 md:hidden">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1db954] text-black font-extrabold flex items-center justify-center text-xs shadow">
              A
            </div>
            {currentView === 'home' && (
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                <button onClick={() => onViewChange?.('home')} className="px-3 py-1 rounded-full text-xs font-semibold bg-white text-black whitespace-nowrap">All</button>
                <button onClick={() => onViewChange?.('viral')} className="px-3 py-1 rounded-full text-xs font-semibold bg-[#282828] text-white hover:bg-[#333] whitespace-nowrap">Viral Hits</button>
                <button onClick={() => onViewChange?.('artists')} className="px-3 py-1 rounded-full text-xs font-semibold bg-[#282828] text-white hover:bg-[#333] whitespace-nowrap">Artists</button>
              </div>
            )}
            {currentView === 'search' && (
              <h1 className="text-xl font-bold text-white tracking-tight">Search</h1>
            )}
            {currentView === 'viral' && (
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-1.5">
                <Flame className="w-5 h-5 text-rose-500 fill-current" />
                Viral Hits
              </h1>
            )}
            {currentView === 'artists' && (
              <h1 className="text-xl font-bold text-white tracking-tight">Artists</h1>
            )}
            {currentView === 'library' && (
              <h1 className="text-xl font-bold text-white tracking-tight">Your Library</h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <PWAInstallButton />
            <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-[10px] font-black border border-emerald-500/30">
              320k
            </div>
            <button className="w-8 h-8 rounded-full bg-[#242424] flex items-center justify-center text-gray-400 hover:text-white">
              <User className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Search Input when in Search View */}
        {currentView === 'search' && (
          <form onSubmit={handleSearchSubmit} className="mt-3 relative w-full md:hidden">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="What do you want to play?"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-[#242424] text-white rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/40 placeholder:text-gray-400 font-medium"
            />
          </form>
        )}

        {/* Desktop Top Bar (hidden on mobile) */}
        <div className="hidden md:flex items-center justify-between h-10">
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-gray-400 hover:text-white transition">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-gray-400 hover:text-white transition">
              <ChevronRight className="w-5 h-5" />
            </button>
            
            {currentView === 'search' && (
              <form onSubmit={handleSearchSubmit} className="relative w-80 ml-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="What do you want to play?"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full bg-[#242424] hover:bg-[#2a2a2a] hover:border-[#333333] border border-transparent text-white rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder:text-gray-400 font-medium"
                />
              </form>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <PWAInstallButton />
            <div className="flex items-center gap-1.5 bg-[#1db954]/15 border border-[#1db954]/30 text-[#1db954] font-bold text-xs px-3.5 py-1.5 rounded-full" title="Continuous background playback enabled">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              320kbps HD Audio
            </div>
            <button className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-gray-400 hover:scale-105 transition hover:text-white border border-[#242424]">
              <User className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative z-10 pb-36 md:pb-12">
        {currentView === 'home' && (
          <HomeView 
            onPlayContext={onSearch}
            onPlayTrackDirect={onPlayTrack}
            onSelectArtist={(id) => onSelectArtist?.(id)}
            onViewAllViral={() => onViewChange?.('viral')}
            onViewAllArtists={() => onViewChange?.('artists')}
          />
        )}

        {currentView === 'viral' && (
          <HomeView 
            onPlayContext={onSearch}
            onPlayTrackDirect={onPlayTrack}
            onSelectArtist={(id) => onSelectArtist?.(id)}
            onViewAllViral={() => onViewChange?.('viral')}
            onViewAllArtists={() => onViewChange?.('artists')}
          />
        )}

        {currentView === 'artists' && (
          <ArtistsListView 
            onSelectArtist={(id) => onSelectArtist?.(id)} 
          />
        )}

        {currentView === 'artist' && (
          <ArtistView 
            artistId={selectedArtistId || 'karan_aujla'}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onBack={onBackFromArtist || (() => onViewChange?.('artists'))}
            onAddTrackToLiked={onAddTrackToLiked}
          />
        )}

        {currentView === 'library' && (
          <MobileLibraryView 
            playlists={playlists || []} 
            onSelectPlaylist={onSelectPlaylist || (() => {})} 
            onCreatePlaylist={onCreatePlaylist || (() => {})} 
          />
        )}

        {currentView === 'charts' && (
          <HomeView 
            onPlayContext={onSearch}
            onPlayTrackDirect={onPlayTrack}
            onSelectArtist={(id) => onSelectArtist?.(id)}
          />
        )}

        {currentView === 'playlist' && selectedPlaylist && (
          <div className="absolute inset-0 -top-16">
            <PlaylistView 
              playlist={selectedPlaylist} 
              currentTrack={currentTrack} 
              isPlaying={isPlaying} 
              onPlayTrack={onPlayTrack} 
              onRemoveTrack={onRemoveTrack}
              onDeletePlaylist={onDeletePlaylist}
            />
          </div>
        )}

        {currentView === 'search' && (
          <>
            {searchInput.trim() === '' ? (
              <BrowseCategories onCategoryClick={handleCategoryClick} />
            ) : (
              <div className="p-6 pb-24">
                {isLoading ? (
                  <div className="flex items-center justify-center py-32">
                    <div className="w-12 h-12 border-4 border-[#1db954] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <>
                    {/* Matching Artists Section */}
                    {matchingArtists.length > 0 && (
                      <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                            <UserCheck className="w-5 h-5 text-[#1db954]" />
                            Artists
                          </h2>
                        </div>
                        <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-none">
                          {matchingArtists.slice(0, 10).map((artist, idx) => (
                            <div 
                              key={`${artist.id}-${idx}`}
                              onClick={() => onSelectArtist?.(artist.id)}
                              className="w-[130px] sm:w-[150px] flex-shrink-0 bg-[#181818] hover:bg-[#282828] active:bg-[#333] transition p-3.5 rounded-2xl cursor-pointer flex flex-col items-center text-center group border border-white/5 shadow-lg"
                            >
                              <div className="relative mb-2.5 w-24 h-24 sm:w-28 sm:h-28">
                                <img 
                                  src={artist.avatarUrl} 
                                  alt={artist.name} 
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
                                  }}
                                  className="w-full h-full rounded-full object-cover border-2 border-transparent group-hover:border-[#1db954] transition shadow-md bg-white/5"
                                />
                                <div className="absolute bottom-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1db954] rounded-full p-2 shadow-lg hidden sm:block">
                                  <Play className="w-3.5 h-3.5 text-black fill-current ml-0.5" />
                                </div>
                              </div>
                              <h3 className="font-bold text-xs sm:text-sm text-white truncate w-full">{artist.name}</h3>
                              <span className="text-[10px] text-[#1db954] font-bold uppercase tracking-wider mt-0.5">Artist</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {topTrack && (
                      <div className="mb-10">
                        <h2 className="text-2xl font-bold text-white mb-6">Top result</h2>
                        <div className="flex flex-col md:flex-row gap-6">
                          {/* Hero Card */}
                          <div className="bg-[#181818] p-5 rounded-lg w-full md:w-2/5 hover:bg-[#282828] transition duration-300 group relative cursor-pointer shadow-lg shadow-black/40"
                               onClick={() => onPlayTrack(topTrack, undefined, tracks)}>
                            <img src={topTrack.coverUrl} alt={topTrack.title} className="w-24 h-24 rounded-full md:rounded-md mb-5 shadow-lg object-cover" />
                            <h1 className="text-3xl font-bold text-white mb-1 truncate">{topTrack.title}</h1>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-400 hover:underline">{topTrack.artist}</span>
                              <span className="bg-[#121212] px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white">Song</span>
                              {topTrack.streamUrl && (
                                <span className="bg-[#1db954]/20 text-[#1db954] border border-[#1db954]/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">320kbps HD Audio</span>
                              )}
                            </div>
                            {/* Floating Play Button */}
                            <div className={`absolute bottom-5 right-5 w-12 h-12 bg-[#1db954] rounded-full flex items-center justify-center shadow-xl shadow-black/40 transform transition-all duration-300 ${currentTrack?.id === topTrack.id && isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105 hover:bg-[#1ed760]'}`}>
                               {currentTrack?.id === topTrack.id && isPlaying ? <Pause className="w-6 h-6 text-black fill-current" /> : <Play className="w-6 h-6 text-black fill-current ml-1" />}
                            </div>
                          </div>

                          {/* Top 4 songs */}
                          <div className="w-full md:w-3/5 flex flex-col">
                            <h2 className="text-xl font-bold text-white mb-4">Songs</h2>
                            <div className="flex flex-col gap-1">
                              {tracks.slice(1, 5).map((track, idx) => {
                                 const isActive = currentTrack?.id === track.id;
                                 return (
                                   <div key={`${track.id}-${idx}`} onClick={() => onPlayTrack(track, undefined, tracks)}
                                        className={`group flex items-center gap-4 p-2 rounded-md hover:bg-white/10 transition cursor-pointer ${isActive ? 'bg-white/10' : ''}`}>
                                     <div className="relative w-10 h-10 flex-shrink-0">
                                       <img src={track.coverUrl} className="w-full h-full rounded shadow object-cover" alt={track.title} />
                                       <div className={`absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition ${isActive && isPlaying ? 'opacity-100' : ''}`}>
                                          {isActive && isPlaying ? <Pause className="w-4 h-4 text-white fill-current" /> : <Play className="w-4 h-4 text-white fill-current ml-0.5" />}
                                       </div>
                                     </div>
                                     <div className="flex-1 overflow-hidden flex flex-col justify-center">
                                       <div className="flex items-center gap-1.5">
                                         <div className={`text-sm font-semibold truncate ${isActive ? 'text-[#1db954]' : 'text-white'}`}>{track.title}</div>
                                         {track.streamUrl ? (
                                           <span className="text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 px-1 rounded flex-shrink-0">
                                             {track.source === 'soundcloud' ? 'SoundCloud' : track.source === 'gaana' ? 'Gaana' : track.source === 'audius' ? 'Audius 320k' : '320k'}
                                           </span>
                                         ) : (
                                           <span className="text-[9px] font-semibold bg-purple-500/10 text-purple-400 px-1 rounded flex-shrink-0">Official Master</span>
                                         )}
                                       </div>
                                       <div className="text-xs text-gray-400 truncate hover:underline hover:text-white transition">{track.artist}</div>
                                     </div>
                                     <div className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition px-2 flex items-center gap-3">
                                       <Heart className="w-4 h-4 hover:text-white" onClick={(e) => { e.stopPropagation(); onAddTrackToLiked?.(track); }} />
                                       {playlists && playlists.length > 1 && (
                                         <Plus className="w-4 h-4 hover:text-white" onClick={(e) => { e.stopPropagation(); onAddTrackToPlaylist?.(track); }} />
                                       )}
                                     </div>
                                     <div className="text-sm text-gray-400 w-12 text-right">
                                       {formatDuration(track.duration)}
                                     </div>
                                   </div>
                                 );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {tracks.length > 5 && (
                      <div className="mt-8">
                         <h2 className="text-2xl font-bold text-white mb-6">More results</h2>
                         <div className="bg-[#121212] rounded-lg">
                          <div className="grid grid-cols-[16px_1fr_1fr_minmax(120px,1fr)] gap-4 px-4 py-2 border-b border-[#282828] text-sm text-gray-400 font-medium mb-2">
                            <div className="text-center">#</div>
                            <div>Title</div>
                            <div>Album</div>
                            <div className="flex justify-end pr-8"><Clock className="w-4 h-4" /></div>
                          </div>

                          <div className="space-y-1 pb-10">
                            {tracks.slice(5).map((track, index) => {
                              const isActive = currentTrack?.id === track.id;
                              const actualIndex = index + 6;
                              
                              return (
                                <div 
                                  key={`${track.id}-${index}`}
                                  onClick={() => onPlayTrack(track, undefined, tracks)}
                                  className={`group grid grid-cols-[16px_1fr_1fr_minmax(120px,1fr)] gap-4 px-4 py-2 items-center rounded-md cursor-pointer hover:bg-white/10 transition-colors ${isActive ? 'bg-white/10' : ''}`}
                                >
                                  <div className="text-gray-400 text-sm relative flex justify-center w-4">
                                    <span className={`group-hover:hidden ${isActive ? 'text-[#1db954] hidden' : 'block'}`}>{actualIndex}</span>
                                    {isActive && isPlaying ? (
                                        <Pause className="w-4 h-4 fill-current text-[#1db954] hidden group-hover:block absolute top-1/2 -translate-y-1/2" />
                                    ) : (
                                        <Play className={`w-4 h-4 fill-current absolute top-1/2 -translate-y-1/2 hidden group-hover:block ${isActive ? 'text-[#1db954]' : 'text-white'}`} />
                                    )}
                                    {isActive && !isPlaying && <div className="w-3 h-3 group-hover:hidden flex items-end justify-between gap-[1px]">
                                        <div className="text-[#1db954] text-xs leading-none">1</div>
                                      </div>
                                    }
                                    {isActive && isPlaying && <div className="w-3 h-3 group-hover:hidden flex items-end justify-between gap-[1px]">
                                        <div className="w-[3px] bg-[#1db954] animate-[bounce_1s_infinite] h-2"></div>
                                        <div className="w-[3px] bg-[#1db954] animate-[bounce_1.2s_infinite] h-3"></div>
                                        <div className="w-[3px] bg-[#1db954] animate-[bounce_0.8s_infinite] h-1.5"></div>
                                      </div>
                                    }
                                  </div>

                                  <div className="flex items-center gap-3 overflow-hidden">
                                    <img src={track.coverUrl} alt={track.title} className="w-10 h-10 rounded shadow flex-shrink-0 object-cover" />
                                    <div className="truncate">
                                      <div className="flex items-center gap-1.5">
                                        <div className={`text-sm font-medium truncate ${isActive ? 'text-[#1db954]' : 'text-white'}`}>{track.title}</div>
                                        {track.streamUrl ? (
                                          <span className="text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 px-1 rounded flex-shrink-0">
                                            {track.source === 'soundcloud' ? 'SoundCloud' : track.source === 'gaana' ? 'Gaana' : track.source === 'audius' ? 'Audius 320k' : '320k'}
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-semibold bg-purple-500/10 text-purple-400 px-1 rounded flex-shrink-0">Official Master</span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-400 truncate hover:underline hover:text-white transition">{track.artist}</div>
                                    </div>
                                  </div>

                                  <div className="text-sm text-gray-400 truncate hover:underline hover:text-white transition">
                                    {track.album}
                                  </div>

                                  <div className="text-sm text-gray-400 flex items-center justify-end gap-4 pr-2">
                                    <Heart className="w-4 h-4 opacity-0 group-hover:opacity-100 hover:text-white transition" onClick={(e) => { e.stopPropagation(); onAddTrackToLiked?.(track); }} />
                                    {playlists && playlists.length > 1 && (
                                       <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 hover:text-white transition" onClick={(e) => { e.stopPropagation(); onAddTrackToPlaylist?.(track); }} />
                                    )}
                                    <span className="w-10 text-right">{formatDuration(track.duration)}</span>
                                    <MoreHorizontal className="w-5 h-5 opacity-0 group-hover:opacity-100 hover:text-white transition" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {tracks.length === 0 && (
                      <div className="text-center text-gray-400 py-20 flex flex-col items-center gap-4">
                        <Search className="w-12 h-12 opacity-50" />
                        <h3 className="text-xl font-bold text-white">No results found</h3>
                        <p>Please make sure your words are spelled correctly, or use fewer or different keywords.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {currentView === 'library' && (
          <div className="p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Your Library</h2>
            <div className="text-center text-gray-400 py-20">
               <Library className="w-12 h-12 mx-auto mb-4 opacity-50" />
               <p>Your library is currently mocked for preview purposes.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default MainView;
