import { useState, useEffect, useRef } from 'react';
import { Track, Playlist, RepeatMode } from './types';
import { searchTracks } from './api';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import MainView from './components/MainView';
import RightSidebar from './components/RightSidebar';
import MobileBottomNav from './components/MobileBottomNav';

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarQuery, setSidebarQuery] = useState('');
  const [currentView, setCurrentView] = useState<string>('home');
  
  // Advanced playback state
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [queue, setQueue] = useState<Track[]>([]);
  const [rightSidebarView, setRightSidebarView] = useState<'none' | 'queue' | 'lyrics'>('none');
  const [playbackContext, setPlaybackContext] = useState<{ type: 'search' | 'playlist'; playlist?: Playlist; trackList: Track[] }>({ type: 'search', trackList: [] });

  // Library state
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    const saved = localStorage.getItem('spotify_playlists');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'liked', name: 'Liked Songs', tracks: [], isLikedSongs: true }
    ];
  });
  
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('aura_playlists', JSON.stringify(playlists));
  }, [playlists]);
  
  const mainViewRef = useRef<{ focusSearch: () => void }>(null);
  
  useEffect(() => {
    // Initial fetch to populate some data
    handleSearch('Global Top Hits Official');
  }, []);

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    const results = await searchTracks(query);
    setTracks(results);
    setPlaybackContext({ type: 'search', trackList: results });
    setIsLoading(false);
  };

  const handleSidebarShortcut = (query: string) => {
    if (query === 'Search') {
      mainViewRef.current?.focusSearch();
    } else {
      setSidebarQuery(query);
      handleSearch(query);
    }
  };

  const handleCreatePlaylist = () => {
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name: `My Playlist #${playlists.length}`,
      tracks: []
    };
    setPlaylists([...playlists, newPlaylist]);
    setSelectedPlaylist(newPlaylist);
    setCurrentView('playlist');
  };

  const handleDeletePlaylist = () => {
    if (!selectedPlaylist || selectedPlaylist.isLikedSongs) return;
    setPlaylists(playlists.filter(p => p.id !== selectedPlaylist.id));
    setCurrentView('home');
    setSelectedPlaylist(null);
  };

  const handleSelectPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setCurrentView('playlist');
  };

  const handleAddTrackToPlaylist = (track: Track, targetPlaylistId?: string) => {
    setPlaylists(playlists.map(p => {
      // Add to latest created playlist by default if ID not provided
      const isTarget = targetPlaylistId ? p.id === targetPlaylistId : p.id === playlists[playlists.length - 1].id;
      if (isTarget && !p.tracks.some(t => t.id === track.id)) {
        return { ...p, tracks: [...p.tracks, track] };
      }
      return p;
    }));
  };

  const handleAddTrackToLiked = (track: Track) => {
    setPlaylists(playlists.map(p => {
      if (p.isLikedSongs && !p.tracks.some(t => t.id === track.id)) {
        return { ...p, tracks: [...p.tracks, track] };
      }
      return p;
    }));
  };

  const handleRemoveTrack = (trackId: string) => {
    if (!selectedPlaylist) return;
    const updated = { ...selectedPlaylist, tracks: selectedPlaylist.tracks.filter(t => t.id !== trackId) };
    setPlaylists(playlists.map(p => p.id === selectedPlaylist.id ? updated : p));
    setSelectedPlaylist(updated);
  };

  const handlePlayTrack = (track: Track, contextPlaylist?: Playlist, contextTrackList?: Track[]) => {
    if (contextPlaylist) {
      setPlaybackContext({ type: 'playlist', playlist: contextPlaylist, trackList: contextPlaylist.tracks });
    } else if (contextTrackList && contextTrackList.length > 0) {
      setPlaybackContext({ type: 'search', trackList: contextTrackList });
    } else if (tracks.some(t => t.id === track.id)) {
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

  const handleNext = () => {
    if (!currentTrack) return;
    
    if (repeatMode === 'one') {
      setIsPlaying(false);
      setTimeout(() => setIsPlaying(true), 50);
      return;
    }

    if (queue.length > 0) {
      const nextTrack = queue[0];
      setQueue(queue.slice(1));
      setCurrentTrack(nextTrack);
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

    const currentIndex = list.findIndex(t => t.id === currentTrack.id);
    if (currentIndex === -1) {
      // Current track is not in current playback context list; do not jump to index 0
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

    const currentIndex = list.findIndex(t => t.id === currentTrack.id);
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
    currentTrack && playlists.find(p => p.isLikedSongs)?.tracks.some(t => t.id === currentTrack.id)
  );

  const handleToggleCurrentTrackLiked = () => {
    if (!currentTrack) return;
    if (isCurrentTrackLiked) {
      handleRemoveTrack(currentTrack.id);
    } else {
      handleAddTrackToLiked(currentTrack);
    }
  };

  return (
    <div className="h-screen w-full bg-black flex flex-col font-sans overflow-hidden select-none text-white">
      {/* Main App Layout */}
      <div className="flex-1 flex overflow-hidden p-0 md:p-2 gap-2 pb-0">
        <div className="hidden md:flex h-full">
          <Sidebar 
            currentView={currentView}
            onViewChange={setCurrentView}
            onSearchShortcut={handleSidebarShortcut} 
            playlists={playlists}
            onSelectPlaylist={handleSelectPlaylist}
            onCreatePlaylist={handleCreatePlaylist}
          />
        </div>
        <MainView 
          ref={mainViewRef}
          currentView={currentView}
          tracks={tracks}
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
      
      {/* Player (Floating Mini-Player on mobile, Bottom bar on desktop) */}
      <Player 
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onNext={handleNext}
        onPrev={handlePrev}
        isShuffle={isShuffle}
        onToggleShuffle={() => setIsShuffle(!isShuffle)}
        repeatMode={repeatMode}
        onToggleRepeat={() => setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off')}
        rightSidebarView={rightSidebarView}
        onToggleRightSidebar={handleToggleRightSidebar}
        isLiked={isCurrentTrackLiked}
        onToggleLike={handleToggleCurrentTrackLiked}
      />

      {/* Mobile Bottom Navigation Bar (md:hidden) */}
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

