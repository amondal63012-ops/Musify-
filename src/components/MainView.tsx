import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  Play,
  Search,
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
  Bell,
  X,
  Disc3,
} from 'lucide-react';
import { Track, Playlist, Artist } from '../types';
import { searchArtists, getViralSongs } from '../api';
import { canSaveTrackOffline } from '../lib/offlineVault';
import HomeView from './HomeView';
import BrowseCategories, { BrowseCategoryItem } from './BrowseCategories';
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

type SearchFilterTab = 'top' | 'songs' | 'artists' | 'albums';

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
  const [searchTab, setSearchTab] = useState<SearchFilterTab>('top');
  const [activeCategory, setActiveCategory] = useState<BrowseCategoryItem | null>(null);
  const [matchingArtists, setMatchingArtists] = useState<Artist[]>([]);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [recentViral, setRecentViral] = useState<Track[]>([]);
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
    getViralSongs().then((list) => {
      if (Array.isArray(list)) setRecentViral(list.slice(0, 5));
    });
  }, []);

  useEffect(() => {
    if (searchQueryProp && searchQueryProp !== 'Search') {
      setSearchInput(searchQueryProp);
      setActiveCategory(null);
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

  // Clear category sub-view if navigating away from search
  useEffect(() => {
    if (currentView !== 'search') {
      setActiveCategory(null);
    }
  }, [currentView]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setActiveCategory(null);
      onSearch(searchInput);
    }
  };

  const handleCategoryClick = (cat: BrowseCategoryItem) => {
    setActiveCategory(cat);
    onSearch(cat.query);
    onViewChange?.('search');
  };

  const handleHomePlayContext = (query: string) => {
    setActiveCategory(null);
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
          compact ? 'w-8 h-8' : 'w-9 h-9'
        } ${isSaved ? 'text-[#FACC15]' : 'text-white/50 hover:text-white'}`}
        title={isSaved ? 'Saved offline (click to remove)' : 'Save track offline for zero-internet playback'}
        aria-label={isSaved ? 'Remove offline track' : 'Save track offline'}
      >
        {isSaving ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#FACC15]" />
        ) : isSaved ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <Download className="w-4 h-4" />
        )}
      </button>
    );
  };

  const topTrack = tracks.length > 0 ? tracks[0] : null;
  const hideStickyHeader =
    currentView === 'playlist' || currentView === 'artist' || (currentView === 'search' && Boolean(activeCategory));

  // Unique album groupings when user selects "Albums" tab
  const uniqueAlbums = React.useMemo(() => {
    const map = new Map<string, { album: string; artist: string; coverUrl: string; track: Track }>();
    for (const t of tracks) {
      const key = `${t.album || t.title}-${t.artist}`;
      if (!map.has(key)) {
        map.set(key, {
          album: t.album || t.title,
          artist: t.artist,
          coverUrl: t.coverUrl,
          track: t,
        });
      }
    }
    return Array.from(map.values());
  }, [tracks]);

  return (
    <div className="flex-1 bg-[#131418] md:rounded-2xl overflow-y-auto relative h-full flex flex-col border border-white/[0.04]">
      {/* Subtle Ambient Backdrop Gradient */}
      {!hideStickyHeader && (
        <div
          className={`absolute top-0 left-0 w-full h-72 pointer-events-none z-0 transition-colors duration-700 ${
            currentView === 'home'
              ? 'bg-gradient-to-b from-[#1E2436]/75 via-[#131418]/90 to-[#131418]'
              : 'bg-gradient-to-b from-[#1C1E28] via-[#131418] to-[#131418]'
          }`}
        />
      )}

      {/* Top Sticky Bar (hidden cleanly on full-bleed Playlist / Artist / Category subviews) */}
      {!hideStickyHeader && (
        <div className="sticky top-0 z-20 flex-shrink-0 transition-colors pt-safe bg-[#131418]/90 backdrop-blur-xl px-4 sm:px-6 py-3">
          {/* Mobile Header Row matching screenshots: Title/Greeting context left + Bell & Avatar right */}
          <div className="flex items-center justify-between gap-2 md:hidden">
            <div className="flex items-center gap-2.5 min-w-0">
              {currentView === 'home' && (
                <span className="text-xs font-extrabold tracking-widest uppercase text-[#FACC15]">Aura Music</span>
              )}
              {currentView === 'search' && (
                <h1 className="text-[26px] font-extrabold text-white tracking-tight truncate">Search</h1>
              )}
              {currentView === 'viral' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onViewChange?.('home')}
                    className="w-9 h-9 rounded-full bg-[#1D1F27] flex items-center justify-center text-white"
                    aria-label="Back to home"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-1.5 truncate">
                    <Flame className="w-5 h-5 text-[#F43F5E] fill-current flex-shrink-0" />
                    <span>Viral Hits</span>
                  </h1>
                </div>
              )}
              {currentView === 'artists' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onViewChange?.('home')}
                    className="w-9 h-9 rounded-full bg-[#1D1F27] flex items-center justify-center text-white"
                    aria-label="Back to home"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h1 className="text-xl font-extrabold text-white tracking-tight truncate">Artists</h1>
                </div>
              )}
              {currentView === 'library' && (
                <h1 className="text-[26px] font-extrabold text-white tracking-tight truncate">Your Library</h1>
              )}
            </div>

            {/* Right Header Icons: Install (when eligible), Bell Notifications, and Golden Profile Avatar */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <PWAInstallButton variant="header" />
              <button
                onClick={() => setIsBellOpen(!isBellOpen)}
                className="w-10 h-10 rounded-full bg-[#1D1F27] hover:bg-[#252833] border border-white/[0.08] flex items-center justify-center text-white relative transition cursor-pointer"
                aria-label="Trending notifications"
              >
                <Bell className="w-[18px] h-[18px]" />
                {recentViral.length > 0 && (
                  <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-[#F43F5E]" />
                )}
              </button>
              <button
                onClick={() => onViewChange?.('library')}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FACC15] to-[#EA580C] text-black font-extrabold flex items-center justify-center text-sm shadow-lg ring-2 ring-[#FACC15]/25 cursor-pointer"
                title="Open Library & Offline Vault"
                aria-label="Library and Offline vault"
              >
                A
              </button>
            </div>
          </div>

          {/* Mobile Search Bar when in Search View */}
          {currentView === 'search' && (
            <form onSubmit={handleSearchSubmit} className="mt-3 relative w-full md:hidden">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search songs, artists, or Gaana link..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-[#1D1F27] border border-white/[0.08] text-white rounded-xl py-3 pl-10 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-[#F43F5E]/60 placeholder:text-white/40 font-medium"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>
          )}

          {/* Desktop Top Bar */}
          <div className="hidden md:flex items-center justify-between h-11">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onViewChange?.('home')}
                className="w-9 h-9 rounded-full bg-[#1D1F27] hover:bg-[#252833] border border-white/[0.06] flex items-center justify-center text-white/70 hover:text-white transition cursor-pointer"
                aria-label="Go Home"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => onViewChange?.('search')}
                className="w-9 h-9 rounded-full bg-[#1D1F27] hover:bg-[#252833] border border-white/[0.06] flex items-center justify-center text-white/70 hover:text-white transition cursor-pointer"
                aria-label="Go to Search"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {currentView === 'search' && (
                <form onSubmit={handleSearchSubmit} className="relative w-96 ml-3">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                  <input
                    type="text"
                    placeholder="Search official artists, songs, or Gaana link..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w-full bg-[#1D1F27] hover:bg-[#232630] border border-white/[0.08] text-white rounded-xl py-2.5 pl-10 pr-9 text-sm focus:outline-none focus:ring-1 focus:ring-[#F43F5E]/60 transition-all placeholder:text-white/40 font-medium"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => setSearchInput('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </form>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {offlineNotice && (
                <span className="text-xs font-medium text-[#FACC15] mr-2 truncate max-w-xs">{offlineNotice}</span>
              )}
              <PWAInstallButton variant="header" />
              <button
                onClick={() => setIsBellOpen(!isBellOpen)}
                className="w-9 h-9 rounded-full bg-[#1D1F27] hover:bg-[#252833] border border-white/[0.08] flex items-center justify-center text-white relative transition cursor-pointer"
                title="Trending Alerts"
                aria-label="Trending Alerts"
              >
                <Bell className="w-4 h-4" />
                {recentViral.length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#F43F5E]" />
                )}
              </button>
              <button
                onClick={() => onViewChange?.('library')}
                className="flex items-center gap-2 rounded-full bg-[#1D1F27] hover:bg-[#252833] border border-white/[0.08] px-3.5 min-h-[36px] text-xs font-semibold text-white transition whitespace-nowrap shrink-0 cursor-pointer"
                title="Open Offline Vault & Local Audio Files"
              >
                <HardDriveDownload className="w-3.5 h-3.5 text-[#FACC15]" />
                <span>Offline Vault ({offlineTracks.length})</span>
              </button>
            </div>
          </div>

          {/* Interactive Notification Bell Dropdown Drawer */}
          {isBellOpen && (
            <div className="mt-3 p-3.5 rounded-2xl bg-[#1D1F27] border border-white/10 shadow-2xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[#FACC15] flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-[#F43F5E] fill-current" />
                  Fresh Trending Hits
                </span>
                <button
                  onClick={() => setIsBellOpen(false)}
                  className="text-white/50 hover:text-white p-1 cursor-pointer"
                  aria-label="Close notifications"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1.5">
                {recentViral.map((t, i) => (
                  <button
                    key={`${t.id}-${i}`}
                    onClick={() => {
                      onPlayTrack(t, undefined, recentViral);
                      setIsBellOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.06] text-left transition cursor-pointer"
                  >
                    <img src={t.coverUrl} alt={t.title} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{t.title}</p>
                      <p className="text-[11px] text-white/55 truncate">{t.artist}</p>
                    </div>
                    <Play className="w-3.5 h-3.5 text-[#F43F5E] fill-current flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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

        {currentView === 'artists' && <ArtistsListView onSelectArtist={(id) => onSelectArtist?.(id)} />}

        {currentView === 'artist' && (
          <ArtistView
            artistId={selectedArtistId || 'karan_aujla'}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onBack={onBackFromArtist || (() => onViewChange?.('artists'))}
            onAddTrackToLiked={onAddTrackToLiked}
            offlineIds={offlineIds}
            savingOfflineId={savingOfflineId}
            onToggleSaveOffline={onToggleSaveOffline}
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
          <PlaylistView
            playlist={selectedPlaylist}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onRemoveTrack={onRemoveTrack}
            onDeletePlaylist={onDeletePlaylist}
            onBack={() => onViewChange?.('library')}
            offlineIds={offlineIds}
            savingOfflineId={savingOfflineId}
            onToggleSaveOffline={onToggleSaveOffline}
            onAddTrackToLiked={onAddTrackToLiked}
          />
        )}

        {currentView === 'search' && (
          <>
            {/* SEARCH SCREEN 2: Vibrant Crimson/Category Showcase Sub-View ("The Best New Releases") */}
            {activeCategory ? (
              <div className="min-h-full pb-28 animate-in fade-in duration-200">
                <div className={`pt-safe px-4 sm:px-6 pt-4 pb-6 bg-gradient-to-b ${activeCategory.headerGradient}`}>
                  <div className="flex items-center justify-between mb-6">
                    <button
                      onClick={() => setActiveCategory(null)}
                      className="w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur flex items-center justify-center text-white cursor-pointer"
                      aria-label="Back to search categories"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h2 className="text-lg font-extrabold text-white tracking-tight">{activeCategory.name}</h2>
                    <div className="w-10" />
                  </div>

                  <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-4 tracking-tight">
                    The Best {activeCategory.name}
                  </h3>

                  {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="w-10 h-10 border-4 border-[#F43F5E] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <>
                      {/* 2-Column Showcase Cards matching SEARCH Screen 2 */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-7">
                        {tracks.slice(0, 4).map((track, idx) => (
                          <div
                            key={`${track.id}-feat-${idx}`}
                            onClick={() => onPlayTrack(track, undefined, tracks)}
                            className="bg-[#1D1F27]/90 hover:bg-[#252833] rounded-2xl p-3 border border-white/[0.08] cursor-pointer transition group shadow-xl"
                          >
                            <div className="relative aspect-square mb-2.5">
                              <img
                                src={track.coverUrl}
                                alt={track.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover rounded-xl shadow-lg"
                              />
                              <div className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-[#F43F5E] text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition">
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              </div>
                            </div>
                            <h4 className="font-bold text-xs sm:text-sm text-white truncate">{track.title}</h4>
                            <p className="text-[11px] text-white/60 line-clamp-2 mt-0.5 leading-snug">
                              {track.artist} · {track.album || activeCategory.name}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Singles & Albums Track List */}
                      <h3 className="text-base sm:text-lg font-bold text-white mb-3 tracking-tight">
                        New Singles &amp; Releases
                      </h3>
                      <div className="space-y-2">
                        {tracks.slice(4).map((track, idx) => {
                          const isActive = currentTrack?.id === track.id;
                          return (
                            <div
                              key={`${track.id}-sub-${idx}`}
                              onClick={() => onPlayTrack(track, undefined, tracks)}
                              className={`flex items-center justify-between gap-3 p-2.5 rounded-xl cursor-pointer border transition ${
                                isActive
                                  ? 'bg-[#252833] border-[#F43F5E]/40'
                                  : 'bg-[#1D1F27] hover:bg-[#252833] border-white/[0.05]'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <img
                                  src={track.coverUrl}
                                  alt={track.title}
                                  referrerPolicy="no-referrer"
                                  className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm font-bold truncate ${isActive ? 'text-[#FACC15]' : 'text-white'}`}>
                                    {track.title}
                                  </p>
                                  <p className="text-xs text-white/55 truncate">{track.artist}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {renderOfflineSaveButton(track, true)}
                                <span className="text-xs text-white/45 tabular-nums w-10 text-right">
                                  {formatDuration(track.duration)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : searchInput.trim() === '' ? (
              <BrowseCategories onCategoryClick={handleCategoryClick} />
            ) : (
              /* SEARCH SCREEN 4: Filter Tabs ("Top", "Songs", "Artists", "Albums") + Clean Track Cards */
              <div className="px-4 sm:px-6 pt-2 pb-28">
                {/* Category Filter Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-4">
                  {(
                    [
                      { id: 'top', label: 'Top' },
                      { id: 'songs', label: 'Songs' },
                      { id: 'artists', label: 'Artists' },
                      { id: 'albums', label: 'Albums' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSearchTab(tab.id)}
                      className={`px-4 min-h-[34px] rounded-full text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                        searchTab === tab.id
                          ? 'bg-[#F43F5E] text-white shadow-md shadow-rose-500/25'
                          : 'bg-[#1D1F27] hover:bg-[#252833] text-white/75 border border-white/[0.06]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-28">
                    <div className="w-11 h-11 border-4 border-[#F43F5E] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <>
                    {/* ARTISTS SECTION */}
                    {(searchTab === 'top' || searchTab === 'artists') && matchingArtists.length > 0 && (
                      <div className="mb-7">
                        <h2 className="text-base sm:text-lg font-bold text-white mb-3 flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-[#FACC15]" />
                          <span>Artists</span>
                        </h2>
                        <div className="flex overflow-x-auto gap-3.5 pb-2 scrollbar-none">
                          {matchingArtists.slice(0, 10).map((artist, idx) => (
                            <div
                              key={`${artist.id}-${idx}`}
                              onClick={() => onSelectArtist?.(artist.id)}
                              className="w-[132px] sm:w-[148px] flex-shrink-0 bg-[#1D1F27] hover:bg-[#252833] transition p-3.5 rounded-2xl cursor-pointer flex flex-col items-center text-center group border border-white/[0.06]"
                            >
                              <img
                                src={artist.avatarUrl}
                                alt={artist.name}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
                                }}
                                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-white/10 group-hover:border-[#FACC15] transition mb-2.5"
                              />
                              <h3 className="font-bold text-xs sm:text-sm text-white truncate w-full">{artist.name}</h3>
                              <span className="text-[11px] text-white/50 mt-0.5">Artist</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TOP RESULT HERO CARD (when on Top tab) */}
                    {searchTab === 'top' && topTrack && (
                      <div className="mb-7">
                        <h2 className="text-base sm:text-lg font-bold text-white mb-3">Top Result</h2>
                        <div
                          onClick={() => onPlayTrack(topTrack, undefined, tracks)}
                          className="bg-[#1D1F27] hover:bg-[#252833] border border-white/[0.06] rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer group shadow-xl transition"
                        >
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <img
                              src={topTrack.coverUrl}
                              alt={topTrack.title}
                              referrerPolicy="no-referrer"
                              className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shadow-lg flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <h3 className="text-base sm:text-xl font-extrabold text-white truncate">
                                {topTrack.title}
                              </h3>
                              <p className="text-xs text-white/60 truncate mt-1">
                                Song · {topTrack.artist} ·{' '}
                                <span className="text-[#FACC15]">{getSourceLabel(topTrack.source)}</span>
                              </p>
                            </div>
                          </div>
                          <div className="w-12 h-12 rounded-full bg-[#F43F5E] text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition flex-shrink-0">
                            {currentTrack?.id === topTrack.id && isPlaying ? (
                              <Pause className="w-5 h-5 fill-current" />
                            ) : (
                              <Play className="w-5 h-5 fill-current ml-0.5" />
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ALBUMS GRID (when on Albums tab) */}
                    {searchTab === 'albums' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 mb-8">
                        {uniqueAlbums.map((item, idx) => (
                          <div
                            key={`${item.album}-${idx}`}
                            onClick={() => onPlayTrack(item.track, undefined, tracks)}
                            className="bg-[#1D1F27] hover:bg-[#252833] border border-white/[0.06] rounded-2xl p-3 cursor-pointer transition group"
                          >
                            <div className="aspect-square rounded-xl overflow-hidden mb-2.5 relative">
                              <img
                                src={item.coverUrl}
                                alt={item.album}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-[#F43F5E] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg">
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              </div>
                            </div>
                            <h4 className="font-bold text-xs sm:text-sm text-white truncate flex items-center gap-1">
                              <Disc3 className="w-3.5 h-3.5 text-[#FACC15] flex-shrink-0" />
                              <span className="truncate">{item.album}</span>
                            </h4>
                            <p className="text-[11px] text-white/55 truncate mt-0.5">{item.artist}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* SONGS LIST (on Top or Songs tab) */}
                    {(searchTab === 'top' || searchTab === 'songs') && tracks.length > 0 && (
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-white mb-3">Songs</h2>
                        <div className="space-y-2 pb-10">
                          {tracks.map((track, idx) => {
                            const isActive = currentTrack?.id === track.id;
                            return (
                              <div
                                key={`${track.id}-${idx}`}
                                onClick={() => onPlayTrack(track, undefined, tracks)}
                                className={`group flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl transition cursor-pointer border ${
                                  isActive
                                    ? 'bg-[#252833] border-[#F43F5E]/40'
                                    : 'bg-[#1D1F27] hover:bg-[#252833] border-white/[0.05]'
                                }`}
                              >
                                <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                                  <div className="relative w-11 h-11 flex-shrink-0 rounded-lg overflow-hidden">
                                    <img
                                      src={track.coverUrl}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                      alt={track.title}
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
                                      Song · {track.artist} ·{' '}
                                      <span className="text-[#FACC15]">{getSourceLabel(track.source)}</span>
                                    </div>
                                  </div>
                                </div>

                                <div
                                  className="flex items-center gap-1 flex-shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {renderOfflineSaveButton(track, true)}
                                  <button
                                    onClick={() => onAddTrackToLiked?.(track)}
                                    className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-[#F43F5E] transition cursor-pointer"
                                    aria-label="Like song"
                                  >
                                    <Heart className="w-4 h-4" />
                                  </button>
                                  {playlists && playlists.length > 1 && (
                                    <button
                                      onClick={() => onAddTrackToPlaylist?.(track)}
                                      className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition cursor-pointer"
                                      aria-label="Add to playlist"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  )}
                                  <span className="text-xs text-white/45 w-10 text-right tabular-nums hidden sm:inline">
                                    {formatDuration(track.duration)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {tracks.length === 0 && (
                      <div className="text-center text-white/60 py-20 flex flex-col items-center gap-3">
                        <Search className="w-12 h-12 opacity-40" />
                        <h3 className="text-lg font-bold text-white">No results found</h3>
                        <p className="text-xs text-white/50">
                          Try another artist, official release, or direct Gaana song link.
                        </p>
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
