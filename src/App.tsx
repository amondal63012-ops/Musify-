import { useState, useEffect, useRef, useMemo } from 'react';
import { Track, Playlist, RepeatMode } from './types';
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

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [offlineTracks, setOfflineTracks] = useState<Track[]>([]);
  const [savingOfflineId, setSavingOfflineId] = useState<string | null>(null);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarQuery, setSidebarQuery] = useState('');
  const [currentView, setCurrentView] = useState<string>('home');

  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [queue, setQueue] = useState<Track[]>([]);
  const [rightSidebarView, setRightSidebarView] = useState<'none' | 'queue' | 'lyrics'>('none');
  const [playbackContext, setPlaybackContext] = useState<{ type: 'search' | 'playlist'; playlist?: Playlist; trackList: Track[] }>({
    type: 'search',
    trackList: [],
  });

  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    const saved = localStorage.getItem('aura_playlists') || localStorage.getItem('spotify_playlists');
    if (saved) return JSON.parse(saved);
    return [{ id: 'liked', name: 'Liked Songs', tracks: [], isLikedSongs: true }];
  });

  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('aura_playlists', JSON.stringify(playlists));
  }, [playlists]);

  const mainViewRef = useRef<{ focusSearch: () => void }>(null);
  const currentViewRef = useRef(currentView);
  currentViewRef.current = currentView;

  useEffect(() => {
    getOfflineTracks().then((saved) => {
      setOfflineTracks(saved);
    });
    handleSearch('Global Top Hits Official');
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

  const handleSearch = async (query: string, navigateToSearch = false) => {
    if (navigateToSearch) {
      setCurrentView('search');
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
    setCurrentView('home');
    setSelectedPlaylist(null);
  };

  const handleSelectPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setCurrentView('playlist');
  };

  const handleAddTrackToPlaylist = (track: Track, targetPlaylistId?: string) => {
    setPlaylists(
      playlists.map((p) => {
        const isTarget = targetPlaylistId ? p.id === targetPlaylistId : p.id === playlists[playlists.length - 1].id;
        if (isTarget && !p.tracks.some((t) => t.id === track.id)) {
          return { ...p, tracks: [...p.tracks, track] };
        }
        return p;
      })
    );
  };

  const handleAddTrackToLiked = (track: Track) => {
    setPlaylists(
      playlists.map((p) => {
        if (p.isLikedSongs && !p.tracks.some((t) => t.id === track.id)) {
          return { ...p, tracks: [...p.tracks, track] };
        }
        return p;
      })
    );
  };

  const handleRemoveTrack = (trackId: string) => {
    if (!selectedPlaylist) return;
    const updated = { ...selectedPlaylist, tracks: selectedPlaylist.tracks.filter((t) => t.id !== trackId) };
    setPlaylists(playlists.map((p) => (p.id === selectedPlaylist.id ? updated : p)));
    setSelectedPlaylist(updated);
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
      setIsPlaying(true);
    }
  };

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
      setIsPlaying(true);
      return;
    }

    const list = playbackContext.trackList;
    if (!list || list.length === 0) return;

    if (isShuffle) {
      const nextIndex = Math.floor(Math.random() * list.length);
      setCurrentTrack(list[nextIndex]);
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
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    } else {
      setCurrentTrack(list[nextIndex]);
      setIsPlaying(true);
    }
  };

  const handlePrev = () => {
    if (!currentTrack) return;
    const list = playbackContext.trackList;
    if (list.length === 0) return;

    const currentIndex = list.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      setCurrentTrack(list[list.length - 1]);
    } else {
      setCurrentTrack(list[prevIndex]);
    }
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
    if (isCurrentTrackLiked) {
      setPlaylists((prev) =>
        prev.map((p) =>
          p.isLikedSongs ? { ...p, tracks: p.tracks.filter((t) => t.id !== currentTrack.id) } : p
        )
      );
    } else {
      handleAddTrackToLiked(currentTrack);
    }
  };

  return (
    <div className="h-screen w-full bg-black flex flex-col font-sans overflow-hidden select-none text-white">
      <OfflineIndicator />

      {/* Main App Layout */}
      <div className="flex-1 flex overflow-hidden p-0 md:p-2 gap-2 pb-0">
        <div className="hidden md:flex h-full">
          <Sidebar
            currentView={currentView}
            onViewChange={setCurrentView}
            onSearchShortcut={handleSidebarShortcut}
            playlists={playlists}
            offlineCount={offlineTracks.length}
            onSelectPlaylist={handleSelectPlaylist}
            onCreatePlaylist={handleCreatePlaylist}
            onImportLocalFiles={handleImportLocalFiles}
          />
        </div>
        <MainView
          ref={mainViewRef}
          currentView={currentView}
          tracks={tracks}
          offlineTracks={offlineTracks}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onPlayTrack={handlePlayTrack}
          onSearch={handleSearch}
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
        />
        {rightSidebarView !== 'none' && (
          <div className="hidden md:block">
            <RightSidebar
              view={rightSidebarView}
              currentTrack={currentTrack}
              queue={queue}
              onClose={() => setRightSidebarView('none')}
              onPlayTrack={handlePlayTrack}
            />
          </div>
        )}
      </div>

      {/* Player */}
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
      />

      {/* Mobile Bottom Navigation Bar */}
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
