import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  Play,
  Search,
  Clock,
  Pause,
  Heart,
  ChevronLeft,
  ChevronRight,
  HardDriveDownload,
  Plus,
  Flame,
  UserCheck,
  Download,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Track, Playlist, Artist } from '../types';
import { searchArtists } from '../api';
import { canSaveTrackOffline } from '../lib/offlineVault';
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
  offlineTracks: Track[];
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
  savingOfflineId?: string | null;
  onToggleSaveOffline?: (track: Track) => void;
  onImportLocalFiles?: (files: FileList) => Promise<void>;
  onRemoveOfflineTrack?: (trackId: string) => Promise<void>;
  offlineNotice?: string | null;
}

const getSourceLabel = (source?: Track['source']) => {
  switch (source) {
    case 'soundcloud':
      return 'SoundCloud';
    case 'gaana':
      return 'Gaana HD';
    case 'audius':
      return 'Audius 320k';
    case 'jamendo':
      return 'Jamendo';
    case 'archive':
      return 'Archive';
    case 'local':
      return 'Local File';
    default:
      return '320k Audio';
  }
};

const MainView = forwardRef(({
  currentView,
  tracks,
  offlineTracks,
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
  onViewChange,
  savingOfflineId = null,
  onToggleSaveOffline,
  onImportLocalFiles,
  onRemoveOfflineTrack,
  offlineNotice = null,
}: MainViewProps, ref) => {
  const [searchInput, setSearchInput] = useState('');
  const [matchingArtists, setMatchingArtists] = useState<Artist[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const offlineIds = new Set(offlineTracks.map((t) => t.id));

  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    },
  }));

  useEffect(() => {
    if (searchQueryProp && searchQueryProp !== 'Search') {
      setSearchInput(searchQueryProp);
    } else if (searchQueryProp === 'Search' && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchQueryProp]);

  useEffect(() => {
    if (searchInput.trim()) {
      const timer = setTimeout(() => {
        searchArtists(searchInput).then((res) => {
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
    onViewChange?.('search');
  };

  const handleHomePlayContext = (query: string) => {
    setSearchInput(query);
    onSearch(query);
    onViewChange?.('search');
  };

  const formatDuration = (ms: number) => {
    if (!ms || isNaN(ms)) return '0:00';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const renderOfflineSaveButton = (track: Track, compact = false) => {
    if (!onToggleSaveOffline || !canSaveTrackOffline(track) || track.source === 'local') {
      return null;
    }
    const isSaved = offlineIds.has(track.id);
    const isSaving = savingOfflineId === track.id;
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSaveOffline(track);
        }}
        disabled={isSaving}
        className={`flex items-center justify-center rounded-full transition cursor-pointer ${
          compact ? 'w-7 h-7' : 'w-8 h-8'
        } ${
          isSaved
            ? 'text-[#1db954]'
            : 'text-gray-400 hover:text-white md:opacity-0 md:group-hover:opacity-100'
        }`}
        title={isSaved ? 'Saved offline (click to remove)' : 'Save track offline for zero-internet playback'}
        aria-label={isSaved ? 'Remove offline track' : 'Save track offline'}
      >
        {isSaving ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#1db954]" />
        ) : isSaved ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <Download className="w-4 h-4" />
        )}
      </button>
    );
  };

  const topTrack = tracks.length > 0 ? tracks[0] : null;

  return (
    <div className="flex-1 bg-[#121212] rounded-lg overflow-y-auto relative h-full flex flex-col">
      {/* Background Gradient */}
      <div className={`absolute top-0 left-0 w-full h-80 pointer-events-none z-0 transition-colors duration-1000 ${currentView === 'home' ? 'bg-gradient-to-b from-indigo-900/40 via-[#121212]/80 to-[#121212]' : 'bg-gradient-to-b from-[#242424] via-[#121212] to-[#121212]'}`}></div>

      {/* Top Bar */}
      <div className={`sticky top-0 z-20 flex-shrink-0 transition-colors pt-safe ${currentView === 'playlist' || currentView === 'artist' ? 'bg-transparent' : 'bg-[#121212]/95 backdrop-blur-md border-b border-white/5'} px-4 sm:px-6 py-3`}>
        {/* Mobile Header Row */}
        <div className="flex items-center justify-between gap-2 md:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#1db954] text-black font-extrabold flex items-center justify-center text-xs shadow flex-shrink-0">
              A
            </div>
            {currentView === 'home' && (
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                <button onClick={() => onViewChange?.('home')} className="px-3 min-h-[32px] rounded-full text-xs font-semibold bg-white text-black whitespace-nowrap shrink-0">All</button>
                <button onClick={() => onViewChange?.('viral')} className="px-3 min-h-[32px] rounded-full text-xs font-semibold bg-[#282828] text-white hover:bg-[#333] whitespace-nowrap shrink-0">Viral Hits</button>
                <button onClick={() => onViewChange?.('artists')} className="px-3 min-h-[32px] rounded-full text-xs font-semibold bg-[#282828] text-white hover:bg-[#333] whitespace-nowrap shrink-0">Artists</button>
              </div>
            )}
            {currentView === 'search' && <h1 className="text-xl font-bold text-white tracking-tight truncate">Search</h1>}
            {currentView === 'viral' && (
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-1.5 truncate">
                <Flame className="w-5 h-5 text-rose-500 fill-current flex-shrink-0" />
                <span>Viral Hits</span>
              </h1>
            )}
            {currentView === 'artists' && <h1 className="text-xl font-bold text-white tracking-tight truncate">Artists</h1>}
            {currentView === 'library' && <h1 className="text-xl font-bold text-white tracking-tight truncate">Your Library</h1>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <PWAInstallButton variant="header" />
            <button
              onClick={() => onViewChange?.('library')}
              className="w-9 h-9 rounded-full bg-[#242424] flex items-center justify-center text-[#1db954] hover:text-white border border-white/10"
              title="Open Offline & Local Vault"
              aria-label="Offline vault"
            >
              <HardDriveDownload className="w-4 h-4" />
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
              placeholder="Search artists, songs, or paste Gaana URL"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-[#242424] text-white rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/40 placeholder:text-gray-400 font-medium"
            />
          </form>
        )}

        {/* Desktop Top Bar */}
        <div className="hidden md:flex items-center justify-between h-10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewChange?.('home')}
              className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
              aria-label="Go Home"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => onViewChange?.('search')}
              className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
              aria-label="Go to Search"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {currentView === 'search' && (
              <form onSubmit={handleSearchSubmit} className="relative w-96 ml-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search official artists, songs, or paste Gaana link..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full bg-[#242424] hover:bg-[#2a2a2a] hover:border-[#333333] border border-transparent text-white rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder:text-gray-400 font-medium"
                />
              </form>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {offlineNotice && (
              <span className="text-xs font-medium text-amber-300 mr-2 truncate max-w-xs">
                {offlineNotice}
              </span>
            )}
            <PWAInstallButton variant="header" />
            <button
              onClick={() => onViewChange?.('library')}
              className="flex items-center gap-1.5 rounded-full bg-[#242424] hover:bg-[#303030] border border-white/10 px-3.5 min-h-[36px] text-xs font-semibold text-white transition whitespace-nowrap shrink-0 cursor-pointer"
              title="Open Offline Vault & Local Audio Files"
            >
              <HardDriveDownload className="w-3.5 h-3.5 text-[#1db954]" />
              <span>Offline Vault ({offlineTracks.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative z-10 pb-36 md:pb-12">
        {(currentView === 'home' || currentView === 'viral' || currentView === 'charts') && (
          <HomeView
            onPlayContext={handleHomePlayContext}
            onPlayTrackDirect={onPlayTrack}
            onSelectArtist={(id) => onSelectArtist?.(id)}
            onViewAllViral={() => onViewChange?.('viral')}
            onViewAllArtists={() => onViewChange?.('artists')}
          />
        )}

        {currentView === 'artists' && (
          <ArtistsListView onSelectArtist={(id) => onSelectArtist?.(id)} />
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
            offlineTracks={offlineTracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onSelectPlaylist={onSelectPlaylist || (() => {})}
            onCreatePlaylist={onCreatePlaylist || (() => {})}
            onPlayTrack={onPlayTrack}
            onImportLocalFiles={onImportLocalFiles || (async () => {})}
            onRemoveOfflineTrack={onRemoveOfflineTrack || (async () => {})}
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
              <div className="p-4 sm:p-6 pb-24">
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
                            <span>Artists</span>
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
                                  referrerPolicy="no-referrer"
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
                              <span className="text-[11px] text-[#1db954] font-semibold mt-0.5">Artist</span>
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
                          <div
                            className="bg-[#181818] p-5 rounded-lg w-full md:w-2/5 hover:bg-[#282828] transition duration-300 group relative cursor-pointer shadow-lg shadow-black/40"
                            onClick={() => onPlayTrack(topTrack, undefined, tracks)}
                          >
                            <img
                              src={topTrack.coverUrl}
                              alt={topTrack.title}
                              referrerPolicy="no-referrer"
                              className="w-24 h-24 rounded-full md:rounded-md mb-5 shadow-lg object-cover"
                            />
                            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 truncate">{topTrack.title}</h1>
                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
                              <span className="truncate">{topTrack.artist}</span>
                              <span>·</span>
                              <span className="text-[#1db954] whitespace-nowrap shrink-0">{getSourceLabel(topTrack.source)}</span>
                            </div>
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
                                  <div
                                    key={`${track.id}-${idx}`}
                                    onClick={() => onPlayTrack(track, undefined, tracks)}
                                    className={`group flex items-center gap-3 p-2 rounded-md hover:bg-white/10 transition cursor-pointer ${isActive ? 'bg-white/10' : ''}`}
                                  >
                                    <div className="relative w-10 h-10 flex-shrink-0">
                                      <img
                                        src={track.coverUrl}
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full rounded shadow object-cover"
                                        alt={track.title}
                                      />
                                      <div className={`absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition ${isActive && isPlaying ? 'opacity-100' : ''}`}>
                                        {isActive && isPlaying ? <Pause className="w-4 h-4 text-white fill-current" /> : <Play className="w-4 h-4 text-white fill-current ml-0.5" />}
                                      </div>
                                    </div>
                                    <div className="flex-1 overflow-hidden flex flex-col justify-center min-w-0">
                                      <div className={`text-sm font-semibold truncate ${isActive ? 'text-[#1db954]' : 'text-white'}`}>
                                        {track.title}
                                      </div>
                                      <div className="text-xs text-gray-400 truncate">
                                        {track.artist} · <span className="text-emerald-400">{getSourceLabel(track.source)}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      {renderOfflineSaveButton(track, true)}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onAddTrackToLiked?.(track);
                                        }}
                                        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white md:opacity-0 md:group-hover:opacity-100 transition cursor-pointer"
                                        aria-label="Like song"
                                      >
                                        <Heart className="w-4 h-4" />
                                      </button>
                                      {playlists && playlists.length > 1 && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onAddTrackToPlaylist?.(track);
                                          }}
                                          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white md:opacity-0 md:group-hover:opacity-100 transition cursor-pointer"
                                          aria-label="Add to playlist"
                                        >
                                          <Plus className="w-4 h-4" />
                                        </button>
                                      )}
                                      <div className="text-xs text-gray-400 w-10 text-right tabular-nums">
                                        {formatDuration(track.duration)}
                                      </div>
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
                          <div className="grid grid-cols-[16px_1fr_minmax(120px,1fr)] md:grid-cols-[16px_1fr_1fr_minmax(130px,1fr)] gap-4 px-4 py-2 border-b border-[#282828] text-sm text-gray-400 font-medium mb-2">
                            <div className="text-center">#</div>
                            <div>Title</div>
                            <div className="hidden md:block">Album</div>
                            <div className="flex justify-end pr-4"><Clock className="w-4 h-4" /></div>
                          </div>

                          <div className="space-y-1 pb-10">
                            {tracks.slice(5).map((track, index) => {
                              const isActive = currentTrack?.id === track.id;
                              const actualIndex = index + 6;

                              return (
                                <div
                                  key={`${track.id}-${index}`}
                                  onClick={() => onPlayTrack(track, undefined, tracks)}
                                  className={`group grid grid-cols-[16px_1fr_minmax(120px,1fr)] md:grid-cols-[16px_1fr_1fr_minmax(130px,1fr)] gap-4 px-4 py-2 items-center rounded-md cursor-pointer hover:bg-white/10 transition-colors ${isActive ? 'bg-white/10' : ''}`}
                                >
                                  <div className="text-gray-400 text-sm relative flex justify-center w-4 tabular-nums">
                                    <span className={`group-hover:hidden ${isActive ? 'text-[#1db954] hidden' : 'block'}`}>{actualIndex}</span>
                                    {isActive && isPlaying ? (
                                      <Pause className="w-4 h-4 fill-current text-[#1db954] hidden group-hover:block absolute top-1/2 -translate-y-1/2" />
                                    ) : (
                                      <Play className={`w-4 h-4 fill-current absolute top-1/2 -translate-y-1/2 hidden group-hover:block ${isActive ? 'text-[#1db954]' : 'text-white'}`} />
                                    )}
                                    {isActive && !isPlaying && (
                                      <span className="text-[#1db954] text-xs font-bold group-hover:hidden">{actualIndex}</span>
                                    )}
                                    {isActive && isPlaying && (
                                      <div className="w-3 h-3 group-hover:hidden flex items-end justify-between gap-[1px]">
                                        <div className="w-[3px] bg-[#1db954] animate-[bounce_1s_infinite] h-2"></div>
                                        <div className="w-[3px] bg-[#1db954] animate-[bounce_1.2s_infinite] h-3"></div>
                                        <div className="w-[3px] bg-[#1db954] animate-[bounce_0.8s_infinite] h-1.5"></div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                    <img
                                      src={track.coverUrl}
                                      alt={track.title}
                                      referrerPolicy="no-referrer"
                                      className="w-10 h-10 rounded shadow flex-shrink-0 object-cover"
                                    />
                                    <div className="truncate min-w-0">
                                      <div className={`text-sm font-medium truncate ${isActive ? 'text-[#1db954]' : 'text-white'}`}>{track.title}</div>
                                      <div className="text-xs text-gray-400 truncate">
                                        {track.artist} · <span className="text-emerald-400">{getSourceLabel(track.source)}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="hidden md:block text-sm text-gray-400 truncate">
                                    {track.album}
                                  </div>

                                  <div className="text-sm text-gray-400 flex items-center justify-end gap-2 pr-2">
                                    {renderOfflineSaveButton(track, true)}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onAddTrackToLiked?.(track);
                                      }}
                                      className="w-7 h-7 flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 hover:text-white transition cursor-pointer"
                                      aria-label="Like song"
                                    >
                                      <Heart className="w-4 h-4" />
                                    </button>
                                    {playlists && playlists.length > 1 && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onAddTrackToPlaylist?.(track);
                                        }}
                                        className="w-7 h-7 flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 hover:text-white transition cursor-pointer"
                                        aria-label="Add to playlist"
                                      >
                                        <Plus className="w-4 h-4" />
                                      </button>
                                    )}
                                    <span className="w-10 text-right tabular-nums">{formatDuration(track.duration)}</span>
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
                        <p>Try another artist, official release, or direct Gaana song link.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

export default MainView;
