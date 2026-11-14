import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import {
  Play,
  Pause,
  Search,
  ChevronLeft,
  ChevronRight,
  HardDriveDownload,
  Flame,
  Bell,
  X,
  Settings,
  User,
  Compass,
} from 'lucide-react';
import {
  Track,
  Playlist,
  Artist,
  SavedAlbum,
  UserProfile,
  AppSettings,
  AppView,
} from '../types';
import { searchArtists, getViralSongs } from '../api';
import HomeView from './HomeView';
import ExploreView from './ExploreView';
import BrowseCategories, { BrowseCategoryItem } from './BrowseCategories';
import PlaylistView from './PlaylistView';
import MobileLibraryView from './MobileLibraryView';
import ArtistView from './ArtistView';
import ArtistsListView from './ArtistsListView';
import ProfileView from './ProfileView';
import SettingsView from './SettingsView';
import { PWAInstallButton } from './PWAInstallButton';
import { ECHO_COVERS } from './echoCovers';
import AuraLogo from './design/AuraLogo';
import SearchBar from './design/SearchBar';
import ArtistCard from './design/ArtistCard';
import AlbumCard from './design/AlbumCard';
import SongRow from './design/SongRow';
import QueuePanel from './design/QueuePanel';
import LoadingSkeleton from './design/LoadingSkeleton';
import SectionHeader from './design/SectionHeader';

interface MainViewProps {
  currentView: AppView;
  tracks: Track[];
  offlineTracks: Track[];
  recentlyPlayed: Track[];
  savedAlbums: SavedAlbum[];
  followedArtists: Artist[];
  recentSearches: string[];
  queue: Track[];
  upcomingFallback: Track[];
  userProfile: UserProfile;
  appSettings: AppSettings;
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, contextPlaylist?: Playlist, contextTrackList?: Track[]) => void;
  onSearch: (query: string) => void;
  isLoading: boolean;
  searchQueryProp?: string;
  selectedPlaylist?: Playlist | null;
  onRemoveTrack?: (trackId: string) => void;
  onDeletePlaylist?: () => void;
  onAddTrackToPlaylist?: (track: Track, targetPlaylistId?: string) => void;
  onAddTrackToLiked?: (track: Track) => void;
  playlists: Playlist[];
  onSelectPlaylist?: (playlist: Playlist) => void;
  onCreatePlaylist?: () => void;
  selectedArtistId?: string | null;
  onSelectArtist?: (artistId: string) => void;
  onBackFromArtist?: () => void;
  onViewChange?: (view: AppView) => void;
  savingOfflineId?: string | null;
  onToggleSaveOffline?: (track: Track) => void;
  onImportLocalFiles?: (files: FileList) => Promise<void>;
  onRemoveOfflineTrack?: (trackId: string) => Promise<void>;
  offlineNotice?: string | null;
  onToggleFollowArtist: (artist: Artist) => void;
  onToggleSaveAlbum: (album: SavedAlbum) => void;
  onAddToQueue: (track: Track) => void;
  onReorderQueue: (fromIndex: number, toIndex: number) => void;
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
  onRemoveRecentSearch: (term: string) => void;
  onClearRecentSearches: () => void;
  onClearRecentlyPlayed: () => void;
  onUpdateProfile: (profile: UserProfile) => void;
  onUpdateSettings: (settings: AppSettings) => void;
  onResetSession: () => void;
}

type SearchFilterTab = 'top' | 'songs' | 'artists' | 'albums';

const QUICK_SUGGESTIONS = [
  'Arijit Singh',
  'Karan Aujla',
  'Global Top Hits',
  'Midnight Lo-Fi',
  'Indie Acoustic',
  'Electronic Chill',
];

const MainView = forwardRef(({
  currentView,
  tracks,
  offlineTracks,
  recentlyPlayed,
  savedAlbums,
  followedArtists,
  recentSearches,
  queue,
  upcomingFallback,
  userProfile,
  appSettings,
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
  onToggleFollowArtist,
  onToggleSaveAlbum,
  onAddToQueue,
  onReorderQueue,
  onRemoveFromQueue,
  onClearQueue,
  onRemoveRecentSearch,
  onClearRecentSearches,
  onClearRecentlyPlayed,
  onUpdateProfile,
  onUpdateSettings,
  onResetSession,
}: MainViewProps, ref) => {
  const [searchInput, setSearchInput] = useState('');
  const [searchTab, setSearchTab] = useState<SearchFilterTab>('top');
  const [activeCategory, setActiveCategory] = useState<BrowseCategoryItem | null>(null);
  const [matchingArtists, setMatchingArtists] = useState<Artist[]>([]);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [recentViral, setRecentViral] = useState<Track[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const offlineIds = useMemo(() => new Set(offlineTracks.map((t) => t.id)), [offlineTracks]);
  const likedIds = useMemo(
    () => new Set((playlists.find((p) => p.isLikedSongs)?.tracks || []).map((t) => t.id)),
    [playlists]
  );
  const savedAlbumIds = useMemo(() => new Set(savedAlbums.map((a) => a.id)), [savedAlbums]);
  const followedArtistIds = useMemo(() => new Set(followedArtists.map((a) => a.id)), [followedArtists]);

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
      if (Array.isArray(list)) setRecentViral(list.slice(0, 6));
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

  useEffect(() => {
    if (currentView !== 'search') {
      setActiveCategory(null);
    }
  }, [currentView]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setActiveCategory(null);
      onSearch(searchInput.trim());
    }
  };

  const handleQuickSearch = (term: string) => {
    setActiveCategory(null);
    setSearchInput(term);
    onSearch(term);
    onViewChange?.('search');
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

  const uniqueAlbums = useMemo<SavedAlbum[]>(() => {
    const map = new Map<string, SavedAlbum>();
    for (const t of tracks) {
      const albumTitle = t.album || t.title;
      const id = `${albumTitle}__${t.artist}`.toLowerCase();
      if (!map.has(id)) {
        map.set(id, {
          id,
          title: albumTitle,
          artist: t.artist,
          coverUrl: t.coverUrl || ECHO_COVERS.nightmix,
          tracks: [t],
        });
      } else {
        map.get(id)!.tracks.push(t);
      }
    }
    return Array.from(map.values());
  }, [tracks]);

  const searchSuggestions = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return [];
    const pool = Array.from(new Set([...recentSearches, ...QUICK_SUGGESTIONS]));
    return pool.filter((item) => item.toLowerCase().includes(q) && item.toLowerCase() !== q).slice(0, 5);
  }, [searchInput, recentSearches]);

  const topTrack = tracks.length > 0 ? tracks[0] : null;
  const hideStickyHeader =
    currentView === 'playlist' || currentView === 'artist' || (currentView === 'search' && Boolean(activeCategory));

  return (
    <main className="flex-1 bg-[var(--aura-bg)] md:rounded-2xl overflow-y-auto relative h-full flex flex-col border border-[#303030]">
      {/* Sticky Monochrome Top Bar */}
      {!hideStickyHeader && (
        <header className="sticky top-0 z-20 flex-shrink-0 pt-safe bg-[#080808]/90 backdrop-blur-xl border-b border-[#303030] px-4 sm:px-6 lg:px-8 py-2.5">
          {/* Mobile Header */}
          <div className="flex items-center justify-between gap-2 md:hidden">
            <div className="flex items-center gap-2 min-w-0">
              {currentView === 'home' ? (
                <AuraLogo size="sm" />
              ) : (
                <h1 className="font-display text-lg font-extrabold text-white tracking-tight truncate capitalize">
                  {currentView === 'viral' || currentView === 'charts' ? 'Explore' : currentView}
                </h1>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <PWAInstallButton variant="header" />
              <button
                type="button"
                onClick={() => onViewChange?.('explore')}
                className={`w-9 h-9 rounded-full border flex items-center justify-center transition cursor-pointer ${
                  currentView === 'explore' || currentView === 'viral' || currentView === 'charts'
                    ? 'bg-white text-black border-white'
                    : 'bg-[#191919] border-[#303030] hover:bg-[#222222] text-white'
                }`}
                aria-label="Explore"
              >
                <Compass className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsBellOpen(!isBellOpen)}
                className="w-9 h-9 rounded-full bg-[#191919] border border-[#303030] hover:bg-[#222222] flex items-center justify-center text-white transition cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onViewChange?.('settings')}
                className={`w-9 h-9 rounded-full border flex items-center justify-center transition cursor-pointer ${
                  currentView === 'settings'
                    ? 'bg-white text-black border-white'
                    : 'bg-[#191919] border-[#303030] hover:bg-[#222222] text-white'
                }`}
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onViewChange?.('profile')}
                className="w-9 h-9 rounded-full bg-white text-black font-bold flex items-center justify-center text-xs cursor-pointer"
                aria-label="Open Profile"
              >
                {userProfile.name.slice(0, 1).toUpperCase() || <User className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Desktop Top Bar */}
          <div className="hidden md:flex items-center justify-between h-11 gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => onViewChange?.('home')}
                className="w-9 h-9 rounded-full bg-[#191919] border border-[#303030] hover:bg-[#222222] flex items-center justify-center text-[#A3A3A3] hover:text-white transition cursor-pointer shrink-0"
                aria-label="Home"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onViewChange?.('explore')}
                className="w-9 h-9 rounded-full bg-[#191919] border border-[#303030] hover:bg-[#222222] flex items-center justify-center text-[#A3A3A3] hover:text-white transition cursor-pointer shrink-0"
                aria-label="Explore"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {currentView === 'search' ? (
                <div className="ml-2 flex-1 max-w-lg">
                  <SearchBar
                    ref={searchInputRef}
                    value={searchInput}
                    onChange={setSearchInput}
                    onSubmit={handleSearchSubmit}
                    size="md"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onViewChange?.('search');
                    setTimeout(() => searchInputRef.current?.focus(), 80);
                  }}
                  className="ml-2 flex items-center gap-2.5 bg-[#191919] hover:bg-[#222222] border border-[#303030] rounded-full px-4 h-9 text-xs font-medium text-[#737373] hover:text-white transition cursor-pointer w-64"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span className="truncate">Search songs, artists, albums...</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {offlineNotice && (
                <span className="text-xs font-semibold text-white bg-[#191919] border border-[#303030] px-3 py-1.5 rounded-full truncate max-w-xs">
                  {offlineNotice}
                </span>
              )}
              <PWAInstallButton variant="header" />
              <button
                type="button"
                onClick={() => setIsBellOpen(!isBellOpen)}
                className="w-9 h-9 rounded-full bg-[#191919] border border-[#303030] hover:bg-[#222222] flex items-center justify-center text-white transition cursor-pointer"
                title="Release Notifications"
                aria-label="Release Notifications"
              >
                <Bell className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onViewChange?.('settings')}
                className="w-9 h-9 rounded-full bg-[#191919] border border-[#303030] hover:bg-[#222222] flex items-center justify-center text-[#A3A3A3] hover:text-white transition cursor-pointer"
                title="Settings"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onViewChange?.('library')}
                className="inline-flex items-center gap-2 rounded-full bg-[#191919] border border-[#303030] hover:bg-[#222222] px-3.5 min-h-[36px] text-xs font-semibold text-white transition whitespace-nowrap shrink-0 cursor-pointer"
                title="Offline Vault"
              >
                <HardDriveDownload className="w-3.5 h-3.5 text-[#A3A3A3]" />
                <span className="tabular-nums">Vault ({offlineTracks.length})</span>
              </button>
              <button
                type="button"
                onClick={() => onViewChange?.('profile')}
                className="inline-flex items-center gap-2 rounded-full bg-white text-black hover:bg-[#E5E5E5] pl-1.5 pr-3 min-h-[36px] text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer"
                title="Profile"
              >
                <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[11px] font-extrabold">
                  {userProfile.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[90px] truncate">{userProfile.name}</span>
              </button>
            </div>
          </div>

          {/* Mobile Search Input Row */}
          {currentView === 'search' && (
            <div className="mt-2.5 md:hidden">
              <SearchBar
                ref={searchInputRef}
                value={searchInput}
                onChange={setSearchInput}
                onSubmit={handleSearchSubmit}
                size="lg"
              />
            </div>
          )}

          {/* Monochrome Notification Popover */}
          {isBellOpen && (
            <div className="mt-3 p-4 rounded-2xl aura-sheet animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#303030]">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[#A3A3A3]" />
                  <span>Trending Official Drops</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsBellOpen(false)}
                  className="text-[#A3A3A3] hover:text-white p-1 cursor-pointer"
                  aria-label="Close notifications"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1.5">
                {recentViral.map((t, i) => (
                  <button
                    key={`${t.id}-bell-${i}`}
                    type="button"
                    onClick={() => {
                      onPlayTrack(t, undefined, recentViral);
                      setIsBellOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[#222222] text-left transition cursor-pointer"
                  >
                    <img
                      src={t.coverUrl || ECHO_COVERS.global}
                      alt={t.title}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{t.title}</p>
                      <p className="text-[11px] text-[#A3A3A3] truncate">{t.artist}</p>
                    </div>
                    <Play className="w-3.5 h-3.5 text-white fill-current shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </header>
      )}

      {/* Main Route Viewport */}
      <div className="flex-1 relative z-10">
        {currentView === 'home' && (
          <HomeView
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            recentlyPlayed={recentlyPlayed}
            playlists={playlists}
            savedAlbums={savedAlbums}
            userProfile={userProfile}
            onPlayContext={handleHomePlayContext}
            onPlayTrackDirect={onPlayTrack}
            onSelectArtist={(id) => onSelectArtist?.(id)}
            onSelectPlaylist={(pl) => onSelectPlaylist?.(pl)}
            onToggleSaveAlbum={onToggleSaveAlbum}
            onViewAllExplore={() => onViewChange?.('explore')}
            onViewAllArtists={() => onViewChange?.('artists')}
          />
        )}

        {(currentView === 'explore' || currentView === 'viral' || currentView === 'charts') && (
          <ExploreView
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            likedIds={likedIds}
            offlineIds={offlineIds}
            savingOfflineId={savingOfflineId}
            savedAlbums={savedAlbums}
            onPlayTrack={onPlayTrack}
            onPlayContext={handleHomePlayContext}
            onSelectArtist={(id) => onSelectArtist?.(id)}
            onToggleLike={(t) => onAddTrackToLiked?.(t)}
            onToggleSaveOffline={(t) => onToggleSaveOffline?.(t)}
            onAddToQueue={onAddToQueue}
            onToggleSaveAlbum={onToggleSaveAlbum}
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
            onAddToQueue={onAddToQueue}
            offlineIds={offlineIds}
            savingOfflineId={savingOfflineId}
            onToggleSaveOffline={onToggleSaveOffline}
            isFollowed={followedArtistIds.has(selectedArtistId || 'karan_aujla')}
            onToggleFollow={onToggleFollowArtist}
            savedAlbums={savedAlbums}
            onToggleSaveAlbum={onToggleSaveAlbum}
            onSelectArtist={(id) => onSelectArtist?.(id)}
          />
        )}

        {currentView === 'library' && (
          <MobileLibraryView
            playlists={playlists || []}
            offlineTracks={offlineTracks}
            savedAlbums={savedAlbums}
            followedArtists={followedArtists}
            recentlyPlayed={recentlyPlayed}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onSelectPlaylist={onSelectPlaylist || (() => {})}
            onCreatePlaylist={onCreatePlaylist || (() => {})}
            onPlayTrack={onPlayTrack}
            onImportLocalFiles={onImportLocalFiles || (async () => {})}
            onRemoveOfflineTrack={onRemoveOfflineTrack || (async () => {})}
            onSelectArtist={(id) => onSelectArtist?.(id)}
            onToggleSaveAlbum={onToggleSaveAlbum}
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
            onAddTrackToPlaylist={onAddTrackToPlaylist}
            onAddToQueue={onAddToQueue}
          />
        )}

        {currentView === 'queue' && (
          <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-44 max-w-4xl mx-auto">
            <SectionHeader
              title="Playing Queue"
              subtitle="Reorder upcoming songs with drag & drop or clear queue"
            />
            <QueuePanel
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              queue={queue}
              upcomingFallback={upcomingFallback}
              onPlayTrack={(track) => onPlayTrack(track)}
              onReorderQueue={onReorderQueue}
              onRemoveFromQueue={onRemoveFromQueue}
              onClearQueue={onClearQueue}
            />
          </div>
        )}

        {currentView === 'profile' && (
          <ProfileView
            userProfile={userProfile}
            onUpdateProfile={onUpdateProfile}
            appSettings={appSettings}
            playlists={playlists}
            savedAlbums={savedAlbums}
            followedArtists={followedArtists}
            offlineTracks={offlineTracks}
            recentlyPlayed={recentlyPlayed}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onSelectArtist={(id) => onSelectArtist?.(id)}
            onNavigate={(view) => onViewChange?.(view)}
          />
        )}

        {currentView === 'settings' && (
          <SettingsView
            settings={appSettings}
            onUpdateSettings={onUpdateSettings}
            userProfile={userProfile}
            offlineCount={offlineTracks.length}
            recentSearchesCount={recentSearches.length}
            recentlyPlayedCount={recentlyPlayed.length}
            onClearRecentSearches={onClearRecentSearches}
            onClearRecentlyPlayed={onClearRecentlyPlayed}
            onResetSession={onResetSession}
            onNavigate={(view) => onViewChange?.(view)}
          />
        )}

        {currentView === 'search' && (
          <>
            {activeCategory ? (
              <div className="min-h-full pb-44 animate-in fade-in duration-200">
                <div className={`pt-safe px-4 sm:px-6 lg:px-8 pt-5 pb-6 bg-gradient-to-b ${activeCategory.headerGradient}`}>
                  <div className="flex items-center justify-between mb-6">
                    <button
                      type="button"
                      onClick={() => setActiveCategory(null)}
                      className="w-10 h-10 rounded-full bg-[#191919] border border-[#303030] hover:bg-[#222222] flex items-center justify-center text-white cursor-pointer"
                      aria-label="Back to search categories"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h2 className="font-display text-lg font-extrabold text-white tracking-tight">
                      {activeCategory.name}
                    </h2>
                    <div className="w-10" />
                  </div>

                  {isLoading ? (
                    <LoadingSkeleton variant="cards" count={4} />
                  ) : (
                    <>
                      <SectionHeader title={`Featured ${activeCategory.name}`} />
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-8">
                        {tracks.slice(0, 4).map((track, idx) => (
                          <div
                            key={`${track.id}-feat-${idx}`}
                            onClick={() => onPlayTrack(track, undefined, tracks)}
                            className="cursor-pointer group"
                          >
                            <div className="relative aspect-square mb-2 rounded-[4px] overflow-hidden bg-[#191919]">
                              <img
                                src={track.coverUrl || activeCategory.imageUrl}
                                alt={track.title}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = activeCategory.imageUrl;
                                }}
                                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                              />
                              <div className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-white text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-xl">
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              </div>
                            </div>
                            <h4 className="font-bold text-[13px] text-white truncate">{track.title}</h4>
                            <p className="text-[11px] text-[#A3A3A3] line-clamp-1 mt-0.5">{track.artist}</p>
                          </div>
                        ))}
                      </div>

                      <SectionHeader title="Tracks &amp; Releases" />
                      <div className="space-y-2">
                        {tracks.slice(4).map((track, idx) => (
                          <SongRow
                            key={`${track.id}-sub-${idx}`}
                            track={track}
                            index={idx}
                            isActive={currentTrack?.id === track.id}
                            isPlaying={isPlaying}
                            isLiked={likedIds.has(track.id)}
                            isOfflineSaved={offlineIds.has(track.id)}
                            isSavingOffline={savingOfflineId === track.id}
                            onPlay={() => onPlayTrack(track, undefined, tracks)}
                            onToggleLike={() => onAddTrackToLiked?.(track)}
                            onToggleSaveOffline={() => onToggleSaveOffline?.(track)}
                            onAddToQueue={() => onAddToQueue(track)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : searchInput.trim() === '' ? (
              <BrowseCategories
                onCategoryClick={handleCategoryClick}
                recentSearches={recentSearches}
                onQuickSearch={handleQuickSearch}
                onRemoveRecentSearch={onRemoveRecentSearch}
                onClearRecentSearches={onClearRecentSearches}
              />
            ) : (
              <div className="px-4 sm:px-6 lg:px-8 pt-3 pb-44 space-y-6">
                {/* Search Suggestions */}
                {searchSuggestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-[#737373] mr-1">Suggestions:</span>
                    {searchSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleQuickSearch(s)}
                        className="px-3 py-1 rounded-full bg-[#191919] border border-[#303030] hover:bg-[#222222] text-xs font-medium text-[#A3A3A3] hover:text-white transition cursor-pointer"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {/* Segmented Search Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                  {(
                    [
                      { id: 'top', label: 'All Results' },
                      { id: 'songs', label: 'Songs' },
                      { id: 'artists', label: 'Artists' },
                      { id: 'albums', label: 'Albums' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSearchTab(tab.id)}
                      className={`px-4 min-h-[36px] rounded-full text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                        searchTab === tab.id
                          ? 'bg-white text-black'
                          : 'bg-[#191919] border border-[#303030] text-[#A3A3A3] hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {isLoading ? (
                  <LoadingSkeleton variant="rows" count={7} />
                ) : (
                  <>
                    {(searchTab === 'top' || searchTab === 'artists') && matchingArtists.length > 0 && (
                      <section>
                        <SectionHeader title="Artists" />
                        <div className="flex overflow-x-auto gap-3.5 pb-2 scrollbar-none">
                          {matchingArtists.slice(0, 10).map((artist, idx) => (
                            <div key={`${artist.id}-sa-${idx}`} className="w-[144px] shrink-0">
                              <ArtistCard
                                artist={artist}
                                onClick={() => onSelectArtist?.(artist.id)}
                              />
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {searchTab === 'top' && topTrack && (
                      <section>
                        <SectionHeader title="Top Result" />
                        <div
                          onClick={() => onPlayTrack(topTrack, undefined, tracks)}
                          className="aura-card rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer group"
                        >
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <img
                              src={topTrack.coverUrl || ECHO_COVERS.global}
                              alt={topTrack.title}
                              referrerPolicy="no-referrer"
                              className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shadow-lg shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <h3 className="text-base sm:text-xl font-extrabold text-white truncate">
                                {topTrack.title}
                              </h3>
                              <p className="text-xs text-[#A3A3A3] truncate mt-1">
                                Song · {topTrack.artist}
                              </p>
                            </div>
                          </div>
                          <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center group-hover:scale-105 transition shrink-0">
                            {currentTrack?.id === topTrack.id && isPlaying ? (
                              <Pause className="w-5 h-5 fill-current" />
                            ) : (
                              <Play className="w-5 h-5 fill-current ml-0.5" />
                            )}
                          </div>
                        </div>
                      </section>
                    )}

                    {(searchTab === 'albums' || (searchTab === 'top' && uniqueAlbums.length > 0)) && (
                      <section>
                        <SectionHeader title="Albums" />
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                          {uniqueAlbums.slice(0, searchTab === 'albums' ? 20 : 5).map((item) => (
                            <AlbumCard
                              key={item.id}
                              title={item.title}
                              artist={item.artist}
                              coverUrl={item.coverUrl}
                              isSaved={savedAlbumIds.has(item.id)}
                              onPlay={() => onPlayTrack(item.tracks[0], undefined, item.tracks)}
                              onToggleSave={() => onToggleSaveAlbum(item)}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {(searchTab === 'top' || searchTab === 'songs') && tracks.length > 0 && (
                      <section>
                        <SectionHeader title="Songs" />
                        <div className="space-y-2">
                          {tracks.map((track, idx) => (
                            <SongRow
                              key={`${track.id}-sr-${idx}`}
                              track={track}
                              index={idx}
                              isActive={currentTrack?.id === track.id}
                              isPlaying={isPlaying}
                              isLiked={likedIds.has(track.id)}
                              isOfflineSaved={offlineIds.has(track.id)}
                              isSavingOffline={savingOfflineId === track.id}
                              onPlay={() => onPlayTrack(track, undefined, tracks)}
                              onToggleLike={() => onAddTrackToLiked?.(track)}
                              onToggleSaveOffline={() => onToggleSaveOffline?.(track)}
                              onAddToQueue={() => onAddToQueue(track)}
                              onAddToPlaylist={
                                playlists.length > 1 ? () => onAddTrackToPlaylist?.(track) : undefined
                              }
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {tracks.length === 0 && (
                      <div className="text-center py-20 rounded-2xl bg-[#191919] border border-[#303030] flex flex-col items-center gap-3">
                        <Search className="w-10 h-10 text-[#737373]" />
                        <h3 className="text-base font-bold text-white">No results found</h3>
                        <p className="text-xs text-[#A3A3A3]">
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
    </main>
  );
});

export default MainView;
