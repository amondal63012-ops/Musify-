import React from 'react';
import { Play, Pause, Clock, Heart, MoreHorizontal, Search, Trash2 } from 'lucide-react';
import { Track, Playlist } from '../types';

interface PlaylistViewProps {
  playlist: Playlist;
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, contextPlaylist?: Playlist) => void;
  onRemoveTrack?: (trackId: string) => void;
  onDeletePlaylist?: () => void;
}

export default function PlaylistView({ playlist, currentTrack, isPlaying, onPlayTrack, onRemoveTrack, onDeletePlaylist }: PlaylistViewProps) {
  
  const formatDuration = (ms: number) => {
    if (!ms || isNaN(ms)) return '0:00';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000).toFixed(0);
    return `${mins}:${Number(secs) < 10 ? '0' : ''}${secs}`;
  };

  const totalDuration = playlist.tracks.reduce((acc, t) => acc + t.duration, 0);

  return (
    <div className="h-full flex flex-col bg-[#121212] overflow-y-auto">
      {/* Hero Section */}
      <div className={`p-6 flex items-end gap-6 h-[30vh] min-h-[250px] ${playlist.isLikedSongs ? 'bg-gradient-to-b from-indigo-700 to-[#121212]' : 'bg-gradient-to-b from-[#535353] to-[#121212]'}`}>
        <div className={`w-[192px] h-[192px] shadow-2xl flex-shrink-0 flex items-center justify-center ${playlist.isLikedSongs ? 'bg-gradient-to-br from-indigo-600 to-purple-400' : 'bg-[#282828]'}`}>
           {playlist.coverUrl ? (
             <img src={playlist.coverUrl} className="w-full h-full object-cover" alt="cover" />
           ) : playlist.isLikedSongs ? (
             <Heart className="w-20 h-20 text-white fill-current" />
           ) : (
             <span className="text-gray-500 font-bold text-6xl">♪</span>
           )}
        </div>
        <div className="flex flex-col text-white">
          <span className="text-sm font-bold mb-2">Playlist</span>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tighter truncate">{playlist.name}</h1>
          <div className="flex items-center gap-2 text-sm font-medium opacity-90">
            {playlist.description && <span>{playlist.description} • </span>}
            <span className="font-bold">You</span>
            <span>•</span>
            <span>{playlist.tracks.length} songs,</span>
            <span className="text-[#b3b3b3]">{Math.floor(totalDuration / 60000)} min</span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-6 py-6 flex items-center gap-6 relative z-10">
        <button 
          onClick={() => playlist.tracks.length > 0 && onPlayTrack(playlist.tracks[0], playlist)}
          className="w-14 h-14 bg-[#1db954] rounded-full flex items-center justify-center hover:scale-105 hover:bg-[#1ed760] transition-transform shadow-lg"
        >
          {isPlaying && playlist.tracks.some(t => t.id === currentTrack?.id) ? (
            <Pause className="w-7 h-7 text-black fill-current" />
          ) : (
            <Play className="w-7 h-7 text-black fill-current ml-1" />
          )}
        </button>
        {playlist.isLikedSongs || (
           <button onClick={onDeletePlaylist} className="text-[#b3b3b3] hover:text-white transition" title="Delete Playlist">
             <MoreHorizontal className="w-8 h-8" />
           </button>
        )}
      </div>

      {/* Tracks List */}
      <div className="px-6 pb-20">
        <div className="grid grid-cols-[16px_1fr_1fr_minmax(120px,1fr)] gap-4 px-4 py-2 border-b border-[#282828] text-sm text-[#b3b3b3] font-medium mb-4">
          <div className="text-center">#</div>
          <div>Title</div>
          <div>Album</div>
          <div className="flex justify-end pr-8"><Clock className="w-4 h-4" /></div>
        </div>

        {playlist.tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#b3b3b3]">
            <Search className="w-16 h-16 mb-6 opacity-30" />
            <h2 className="text-xl font-bold text-white mb-2">Let's find something for your playlist</h2>
            <p>Use the search to find tracks and add them here.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {playlist.tracks.map((track, index) => {
              const isActive = currentTrack?.id === track.id;
              
              return (
                <div 
                  key={`${track.id}-${index}`}
                  onDoubleClick={() => onPlayTrack(track, playlist)}
                  className={`group grid grid-cols-[16px_1fr_1fr_minmax(120px,1fr)] gap-4 px-4 py-2 items-center rounded-md hover:bg-white/10 transition-colors ${isActive ? 'bg-white/10' : ''}`}
                >
                  <div className="text-[#b3b3b3] text-sm relative flex justify-center w-4">
                    <span className={`group-hover:hidden ${isActive ? 'text-[#1db954] hidden' : 'block'}`}>{index + 1}</span>
                    <button onClick={() => onPlayTrack(track, playlist)}>
                      {isActive && isPlaying ? (
                          <Pause className="w-4 h-4 fill-current text-[#1db954] hidden group-hover:block absolute top-1/2 -translate-y-1/2" />
                      ) : (
                          <Play className={`w-4 h-4 fill-current absolute top-1/2 -translate-y-1/2 hidden group-hover:block ${isActive ? 'text-[#1db954]' : 'text-white'}`} />
                      )}
                    </button>
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
                      <div className={`text-sm font-medium truncate ${isActive ? 'text-[#1db954]' : 'text-white'}`}>{track.title}</div>
                      <div className="text-xs text-[#b3b3b3] truncate group-hover:text-white transition cursor-pointer hover:underline">{track.artist}</div>
                    </div>
                  </div>

                  <div className="text-sm text-[#b3b3b3] truncate group-hover:text-white transition cursor-pointer hover:underline">
                    {track.album}
                  </div>

                  <div className="text-sm text-[#b3b3b3] flex items-center justify-end gap-4 pr-2">
                    {playlist.isLikedSongs && (
                      <Heart className="w-4 h-4 text-[#1db954] fill-current opacity-0 group-hover:opacity-100 transition cursor-pointer" onClick={() => onRemoveTrack?.(track.id)} />
                    )}
                    {!playlist.isLikedSongs && (
                      <Trash2 className="w-4 h-4 opacity-0 group-hover:opacity-100 transition cursor-pointer hover:text-white" onClick={() => onRemoveTrack?.(track.id)} />
                    )}
                    <span className="w-10 text-right">{formatDuration(track.duration)}</span>
                    <MoreHorizontal className="w-5 h-5 opacity-0 group-hover:opacity-100 hover:text-white transition cursor-pointer" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
