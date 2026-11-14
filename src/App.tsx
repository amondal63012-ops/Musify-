import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Track,
  Playlist,
  RepeatMode,
  Artist,
  SavedAlbum,
  UserProfile,
  AppSettings,
  AppView,
} from './types';
import { searchTracks } from './api';
import {
  getOfflineTracks,
  importLocalAudioFiles,
  removeOfflineTrack,
  saveTrackForOffline,
} from './lib/offlineVault';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import MainView from './components/MainView';
import RightSidebar from './components/RightSidebar';
import MobileBottomNav from './components/MobileBottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { App as CapacitorApp } from '@capacitor/app';
import { isNativeAndroid } from './lib/apiConfig';

const DEFAULT_PROFILE: UserProfile = {
  name: 'Aura Listener',
  handle: '@auramusic',
  email: 'amondal63012@gmail.com',
  bio: 'Studio quality audio · Continuous background playback',
  avatarStyle: 'initials',
};

const DEFAULT_SETTINGS: AppSettings = {
  audioQuality: '320k',
  autoplay: true,
  gaplessPlayback: true,
  pureBlackSurface: false,
  reducedMotion: false,
  releaseNotifications: true,
  chartNotifications: true,
  pauseHistory: false,
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [offlineTracks, setOfflineTracks] = useState<Track[]>([]);
  const [savingOfflineId, setSavingOfflineId] = useState<string | null>(null);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarQuery, setSidebarQuery] = useState('');
  const [currentView, setCurrentView] = useState<AppView>('home');

  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [queue, setQueue] = useState<Track[]>([]);
  const [rightSidebarView, setRightSidebarView] = useState<'none' | 'queue' | 'lyrics'>('none');
  const [playbackContext, setPlaybackContext] = useState<{
    type: 'search' | 'playlist';
    playlist?: Playlist;
    trackList: Track[];
  }>({
    type: 'search',
    trackList: [],
  });

  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    const saved = localStorage.getItem('aura_playlists') || localStorage.getItem('spotify_playlists');
    if (saved) return JSON.parse(saved);
    return [{ id: 'liked', name: 'Liked Songs', tracks: [], isLikedSongs: true }];
  });

  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>(() =>
    readStorage<Track[]>('aura_recently_played', [])
  );
  const [savedAlbums, setSavedAlbums] = useState<SavedAlbum[]>(() =>
    readStorage<SavedAlbum[]>('aura_saved_albums', [])
  );
  const [followedArtists, setFollowedArtists] = useState<Artist[]>(() =>
    readStorage<Artist[]>('aura_followed_artists', [])
  );
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    readStorage<string[]>('aura_recent_searches', [])
  );
  const [userProfile, setUserProfile] = useState<UserProfile>(() =>
    readStorage<UserProfile>('aura_user_profile', DEFAULT_PROFILE)
  );
  const [appSettings, setAppSettings] = useState<AppSettings>(() =>
    readStorage<AppSettings>('aura_app_settings', DEFAULT_SETTINGS)
  );

  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('aura_playlists', JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    localStorage.setItem('aura_recently_played', JSON.stringify(recentlyPlayed));
  }, [recentlyPlayed]);

  useEffect(() => {
    localStorage.setItem('aura_saved_albums', JSON.stringify(savedAlbums));
  }, [savedAlbums]);

  useEffect(() => {
    localStorage.setItem('aura_followed_artists', JSON.stringify(followedArtists));
  }, [followedArtists]);

  useEffect(() => {
    localStorage.setItem('aura_recent_searches', JSON.stringify(recentSearches));
  }, [recentSearches]);

  useEffect(() => {
    localStorage.setItem('aura_user_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('aura_app_settings', JSON.stringify(appSettings));
    document.documentElement.dataset.surface = appSettings.pureBlackSurface ? 'pure-black' : 'obsidian';
  }, [appSettings]);

  const mainViewRef = useRef<{ focusSearch: () => void }>(null);
  const currentViewRef = useRef(currentView);
  currentViewRef.current = currentView;

  useEffect(() => {
    getOfflineTracks().then((saved) => {
      setOfflineTracks(saved);
    });
    handleSearch('Global Top Hits Official', false, false);
  }, []);

  useEffect(() => {
    if (!isNativeAndroid()) return;
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      const backEvent = new CustomEvent('auraAndroidBack', { cancelable: true });
      const shouldContinue = window.dispatchEvent(backEvent);
      if (!shouldContinue) {
        return;
      }
      const view = currentViewRef.current;
      if (view === 'artist') {
        setCurrentView('artists');
      } else if (view !== 'home') {
        setCurrentView('home');
      } else {
        CapacitorApp.minimizeApp().catch(() => {});
      }
    });
    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {});
    };
  }, []);

  const showNotice = (msg: string) => {
    setOfflineNotice(msg);
    setTimeout(() => setOfflineNotice((prev) => (prev === msg ? null : prev)), 3500);
  };

  const recordRecentlyPlayed = (track: Track) => {
    if (appSettings.pauseHistory) return;
    setRecentlyPlayed((prev) => [track, ...prev.filter((t) => t.id !== track.id)].slice(0, 20));
  };

  const handleSearch = async (query: string, navigateToSearch = false, saveHistory = true) => {
    if (navigateToSearch) {
      setCurrentView('search');
    }
    const cleanQuery = query.trim();
    if (saveHistory && cleanQuery && cleanQuery !== 'Global Top Hits Official') {
      setRecentSearches((prev) => [cleanQuery, ...prev.filter((s) => s.toLowerCase() !== cleanQuery.toLowerCase())].slice(0, 10));
    }
    setIsLoading(true);
    const results = await searchTracks(query);
    setTracks(results);
    setPlaybackContext({ type: 'search', trackList: results });
    setIsLoading(false);
  };

  const handleReplaceTrack = (replacement: Track, failedTrackId?: string) => {
    if (failedTrackId && currentTrack?.id !== failedTrackId) {
      return;
    }
    const targetId = failedTrackId || currentTrack?.id;
    setCurrentTrack(replacement);
    setIsPlaying(true);
    if (targetId) {
      setTracks((prev) => prev.map((t) => (t.id === targetId ? replacement : t)));
      setPlaybackContext((prev) => ({
        ...prev,
        trackList: prev.trackList.map((t) => (t.id === targetId ? replacement : t)),
      }));
    }
  };

  const handleSidebarShortcut = (query: string) => {
    if (query === 'Search') {
      setCurrentView('search');
      setTimeout(() => mainViewRef.current?.focusSearch(), 50);
    } else {
      setSidebarQuery(query);
      handleSearch(query, true);
    }
  };

  const handleCreatePlaylist = () => {
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name: `My Playlist #${playlists.length}`,
      tracks: [],
    };
    setPlaylists([...playlists, newPlaylist]);
    setSelectedPlaylist(newPlaylist);
    setCurrentView('playlist');
  };

  const handleDeletePlaylist = () => {
    if (!selectedPlaylist || selectedPlaylist.isLikedSongs) return;
    setPlaylists(playlists.filter((p) => p.id !== selectedPlaylist.id));
    setCurrentView('library');
    setSelectedPlaylist(null);
  };

  const handleSelectPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setCurrentView('playlist');
  };

  const handleAddTrackToPlaylist = (track: Track, targetPlaylistId?: string) => {
    const chosenId = targetPlaylistId || playlists[playlists.length - 1]?.id;
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id === chosenId && !p.tracks.some((t) => t.id === track.id)) {
          const updated = { ...p, tracks: [...p.tracks, track] };
          if (selectedPlaylist?.id === p.id) {
            setSelectedPlaylist(updated);
          }
          return updated;
        }
        return p;
      })
    );
    showNotice(`Added "${track.title}" to playlist`);
  };

  const handleAddTrackToLiked = (track: Track) => {
    const liked = playlists.find((p) => p.isLikedSongs);
    const alreadyLiked = liked?.tracks.some((t) => t.id === track.id);
    setPlaylists((prev) =>
      prev.map((p) => {
        if (!p.isLikedSongs) return p;
        const updated = alreadyLiked
          ? { ...p, tracks: p.tracks.filter((t) => t.id !== track.id) }
          : { ...p, tracks: [...p.tracks, track] };
        if (selectedPlaylist?.id === p.id) {
          setSelectedPlaylist(updated);
        }
        return updated;
      })
    );
    showNotice(alreadyLiked ? `Removed "${track.title}" from Liked Songs` : `Added "${track.title}" to Liked Songs`);
  };

  const handleRemoveTrack = (trackId: string) => {
    if (!selectedPlaylist) return;
    const updated = { ...selectedPlaylist, tracks: selectedPlaylist.tracks.filter((t) => t.id !== trackId) };
    setPlaylists(playlists.map((p) => (p.id === selectedPlaylist.id ? updated : p)));
    setSelectedPlaylist(updated);
  };

  const handleToggleFollowArtist = (artist: Artist) => {
    setFollowedArtists((prev) => {
      const exists = prev.some((a) => a.id === artist.id);
      if (exists) {
        showNotice(`Unfollowed ${artist.name}`);
        return prev.filter((a) => a.id !== artist.id);
      }
      showNotice(`Following ${artist.name}`);
      return [artist, ...prev];
    });
  };

  const handleToggleSaveAlbum = (album: SavedAlbum) => {
    setSavedAlbums((prev) => {
      const exists = prev.some((a) => a.id === album.id);
      if (exists) {
        showNotice(`Removed "${album.title}" from Saved Albums`);
        return prev.filter((a) => a.id !== album.id);
      }
      showNotice(`Saved "${album.title}" to Your Library`);
      return [{ ...album, savedAt: Date.now() }, ...prev];
    });
  };

  const handleToggleSaveOffline = async (track: Track) => {
    const alreadySaved = offlineTracks.some((t) => t.id === track.id);
    if (alreadySaved) {
      await removeOfflineTrack(track.id);
      setOfflineTracks((prev) => prev.filter((t) => t.id !== track.id));
      showNotice(`Removed "${track.title}" from Offline Vault`);
      return;
    }

    setSavingOfflineId(track.id);
    try {
      const saved = await saveTrackForOffline(track);
      setOfflineTracks((prev) => [saved, ...prev.filter((t) => t.id !== saved.id)]);
      showNotice(`Saved "${track.title}" for offline playback`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save track offline';
      showNotice(message);
    } finally {
      setSavingOfflineId(null);
    }
  };

  const handleImportLocalFiles = async (files: FileList) => {
    const imported = await importLocalAudioFiles(files);
    if (imported.length > 0) {
      setOfflineTracks((prev) => [...imported, ...prev]);
      showNotice(`Imported ${imported.length} local audio ${imported.length === 1 ? 'file' : 'files'}`);
      if (!currentTrack) {
        setCurrentTrack(imported[0]);
        recordRecentlyPlayed(imported[0]);
        setPlaybackContext({ type: 'search', trackList: imported });
        setIsPlaying(true);
      }
    }
  };

  const handleRemoveOfflineTrack = async (trackId: string) => {
    await removeOfflineTrack(trackId);
    setOfflineTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  const handlePlayTrack = (track: Track, contextPlaylist?: Playlist, contextTrackList?: Track[]) => {
    if (contextPlaylist) {
      setPlaybackContext({ type: 'playlist', playlist: contextPlaylist, trackList: contextPlaylist.tracks });
    } else if (contextTrackList && contextTrackList.length > 0) {
      setPlaybackContext({ type: 'search', trackList: contextTrackList });
    } else if (tracks.some((t) => t.id === track.id)) {
      setPlaybackContext({ type: 'search', trackList: tracks });
    } else {
      setPlaybackContext({ type: 'search', trackList: [track] });
    }

    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
      recordRecentlyPlayed(track);
      setIsPlaying(true);
    }
  };

  const handleAddToQueue = (track: Track) => {
    setQueue((prev) => [...prev, track]);
    showNotice(`Queued "${track.title}"`);
  };

  const handleReorderQueue = (fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleRemoveFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearQueue = () => {
    setQueue([]);
  };

  const upcomingFallback = useMemo(() => {
    const list = playbackContext.trackList || [];
    if (!currentTrack || list.length === 0) return [];
    const idx = list.findIndex((t) => t.id === currentTrack.id);
    if (idx === -1) return list.slice(0, 8);
    return list.slice(idx + 1, idx + 9);
  }, [currentTrack?.id, playbackContext.trackList]);

  const nextTrack = useMemo(() => {
    if (!currentTrack) return null;
    if (queue.length > 0) return queue[0];
    const list = playbackContext.trackList;
    if (!list || list.length === 0) return null;
    const idx = list.findIndex((t) => t.id === currentTrack.id);
    if (idx === -1) return null;
    if (idx + 1 < list.length) return list[idx + 1];
    return repeatMode === 'all' ? list[0] : null;
  }, [currentTrack?.id, queue, playbackContext.trackList, repeatMode]);

  const handleNext = () => {
    if (!currentTrack) return;

    if (repeatMode === 'one') {
      setIsPlaying(false);
      setTimeout(() => setIsPlaying(true), 50);
      return;
    }

    if (queue.length > 0) {
      const upcoming = queue[0];
      setQueue(queue.slice(1));
      setCurrentTrack(upcoming);
      recordRecentlyPlayed(upcoming);
      setIsPlaying(true);
      return;
    }

    const list = playbackContext.trackList;
    if (!list || list.length === 0) return;

    if (isShuffle) {
      const nextIndex = Math.floor(Math.random() * list.length);
      const chosen = list[nextIndex];
      setCurrentTrack(chosen);
      recordRecentlyPlayed(chosen);
      setIsPlaying(true);
      return;
    }

    const currentIndex = list.findIndex((t) => t.id === currentTrack.id);
    if (currentIndex === -1) {
      setIsPlaying(false);
      return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex >= list.length) {
      if (repeatMode === 'all') {
        setCurrentTrack(list[0]);
        recordRecentlyPlayed(list[0]);
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    } else {
      setCurrentTrack(list[nextIndex]);
      recordRecentlyPlayed(list[nextIndex]);
      setIsPlaying(true);
    }
  };

  const handlePrev = () => {
    if (!currentTrack) return;
    const list = playbackContext.trackList;
    if (list.length === 0) return;

    const currentIndex = list.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = currentIndex - 1;
    const target = prevIndex < 0 ? list[list.length - 1] : list[prevIndex];
    setCurrentTrack(target);
    recordRecentlyPlayed(target);
    setIsPlaying(true);
  };

  const handleToggleRightSidebar = (view: 'queue' | 'lyrics') => {
    if (rightSidebarView === view) {
      setRightSidebarView('none');
    } else {
      setRightSidebarView(view);
    }
  };

  const isCurrentTrackLiked = Boolean(
    currentTrack && playlists.find((p) => p.isLikedSongs)?.tracks.some((t) => t.id === currentTrack.id)
  );

  const isCurrentTrackOfflineSaved = Boolean(
    currentTrack && offlineTracks.some((t) => t.id === currentTrack.id)
  );

  const handleToggleCurrentTrackLiked = () => {
    if (!currentTrack) return;
    handleAddTrackToLiked(currentTrack);
  };

  const handleResetSession = () => {
    setRecentlyPlayed([]);
    setRecentSearches([]);
    setUserProfile(DEFAULT_PROFILE);
    setAppSettings(DEFAULT_SETTINGS);
    setQueue([]);
  };

  return (
    <div className="h-screen w-full bg-[var(--aura-bg)] flex flex-col font-sans overflow-hidden select-none text-white">
      <OfflineIndicator />

      <div className="flex-1 flex overflow-hidden p-0 md:p-2 gap-2 pb-0">
        <div className="hidden md:flex h-full">
          <Sidebar
            currentView={currentView}
            onViewChange={setCurrentView}
            onSearchShortcut={handleSidebarShortcut}
            playlists={playlists}
            offlineCount={offlineTracks.length}
            recentlyPlayed={recentlyPlayed}
            currentTrack={currentTrack}
            onSelectPlaylist={handleSelectPlaylist}
            onCreatePlaylist={handleCreatePlaylist}
            onImportLocalFiles={handleImportLocalFiles}
            onPlayTrack={handlePlayTrack}
          />
        </div>

        <MainView
          ref={mainViewRef}
          currentView={currentView}
          tracks={tracks}
          offlineTracks={offlineTracks}
          recentlyPlayed={recentlyPlayed}
          savedAlbums={savedAlbums}
          followedArtists={followedArtists}
          recentSearches={recentSearches}
          queue={queue}
          upcomingFallback={upcomingFallback}
          userProfile={userProfile}
          appSettings={appSettings}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onPlayTrack={handlePlayTrack}
          onSearch={(q) => handleSearch(q, false, true)}
          isLoading={isLoading}
          searchQueryProp={sidebarQuery}
          selectedPlaylist={selectedPlaylist}
          onRemoveTrack={handleRemoveTrack}
          onDeletePlaylist={handleDeletePlaylist}
          onAddTrackToPlaylist={handleAddTrackToPlaylist}
          onAddTrackToLiked={handleAddTrackToLiked}
          playlists={playlists}
          onSelectPlaylist={handleSelectPlaylist}
          onCreatePlaylist={handleCreatePlaylist}
          selectedArtistId={selectedArtistId}
          onSelectArtist={(id) => {
            setSelectedArtistId(id);
            setCurrentView('artist');
          }}
          onBackFromArtist={() => setCurrentView('artists')}
          onViewChange={setCurrentView}
          savingOfflineId={savingOfflineId}
          onToggleSaveOffline={handleToggleSaveOffline}
          onImportLocalFiles={handleImportLocalFiles}
          onRemoveOfflineTrack={handleRemoveOfflineTrack}
          offlineNotice={offlineNotice}
          onToggleFollowArtist={handleToggleFollowArtist}
          onToggleSaveAlbum={handleToggleSaveAlbum}
          onAddToQueue={handleAddToQueue}
          onReorderQueue={handleReorderQueue}
          onRemoveFromQueue={handleRemoveFromQueue}
          onClearQueue={handleClearQueue}
          onRemoveRecentSearch={(term) => setRecentSearches((prev) => prev.filter((s) => s !== term))}
          onClearRecentSearches={() => setRecentSearches([])}
          onClearRecentlyPlayed={() => setRecentlyPlayed([])}
          onUpdateProfile={setUserProfile}
          onUpdateSettings={setAppSettings}
          onResetSession={handleResetSession}
        />

        {rightSidebarView !== 'none' && (
          <div className="hidden md:block">
            <RightSidebar
              view={rightSidebarView}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              queue={queue}
              upcomingFallback={upcomingFallback}
              onClose={() => setRightSidebarView('none')}
              onPlayTrack={(track) => handlePlayTrack(track)}
              onReorderQueue={handleReorderQueue}
              onRemoveFromQueue={handleRemoveFromQueue}
              onClearQueue={handleClearQueue}
            />
          </div>
        )}
      </div>

      <Player
        currentTrack={currentTrack}
        nextTrack={nextTrack}
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onExternalPlayingChange={setIsPlaying}
        onNext={handleNext}
        onPrev={handlePrev}
        isShuffle={isShuffle}
        onToggleShuffle={() => setIsShuffle(!isShuffle)}
        repeatMode={repeatMode}
        onToggleRepeat={() => setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'))}
        rightSidebarView={rightSidebarView}
        onToggleRightSidebar={handleToggleRightSidebar}
        isLiked={isCurrentTrackLiked}
        onToggleLike={handleToggleCurrentTrackLiked}
        onReplaceTrack={handleReplaceTrack}
        isOfflineSaved={isCurrentTrackOfflineSaved}
        isSavingOffline={Boolean(currentTrack && savingOfflineId === currentTrack.id)}
        onToggleSaveOffline={handleToggleSaveOffline}
        queue={queue}
        upcomingFallback={upcomingFallback}
        onPlayTrackFromQueue={(track) => handlePlayTrack(track)}
        onReorderQueue={handleReorderQueue}
        onRemoveFromQueue={handleRemoveFromQueue}
        onClearQueue={handleClearQueue}
      />

      <MobileBottomNav
        currentView={currentView}
        onViewChange={(view) => {
          if (view === 'search') {
            setCurrentView('search');
            setTimeout(() => mainViewRef.current?.focusSearch(), 100);
          } else {
            setCurrentView(view);
          }
        }}
        onOpenSearch={() => mainViewRef.current?.focusSearch()}
      />
    </div>
  );
}
