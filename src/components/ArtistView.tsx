import React, { useState, useEffect } from 'react';
import { Play, Pause, Heart, Check, Plus, Clock, Sparkles, UserCheck, ChevronLeft, Radio } from 'lucide-react';
import { Artist, Track, Playlist } from '../types';
import { getArtistDetails } from '../api';

interface ArtistViewProps {
  artistId: string;
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, contextPlaylist?: Playlist, contextTrackList?: Track[]) => void;
  onBack: () => void;
  onAddTrackToLiked?: (track: Track) => void;
}

export default function ArtistView({
  artistId,
  currentTrack,
  isPlaying,
  onPlayTrack,
  onBack,
  onAddTrackToLiked
}: ArtistViewProps) {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    const loadArtist = async () => {
      const data = await getArtistDetails(artistId);
      if (!isCancelled && data) {
        setArtist(data);
      }
      if (!isCancelled) setIsLoading(false);
    };

    loadArtist();
    return () => { isCancelled = true; };
  }, [artistId]);

  const formatDuration = (ms: number) => {
    if (!ms || isNaN(ms)) return '0:00';
    const mins = Math.floor(ms / 60000);
    const secs = ((ms % 60000) / 1000).toFixed(0);
    return `${mins}:${Number(secs) < 10 ? '0' : ''}${secs}`;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-40">
        <div className="w-12 h-12 border-4 border-[#1db954] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="p-8 text-center text-white">
        <p className="text-gray-400">Artist details not available.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-white text-black rounded-full font-bold">
          Go Back
        </button>
      </div>
    );
  }

  const tracks = artist.popularTracks || [];

  return (
    <div className="pb-36 select-none relative animate-in fade-in duration-300">
      
      {/* Back Button */}
      <div className="sticky top-0 z-30 px-4 py-3 pt-safe bg-gradient-to-b from-black/80 to-transparent flex items-center gap-3">
        <button 
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white active:scale-95 transition"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="text-sm font-bold text-white/90 truncate">{artist.name}</span>
      </div>

      {/* Artist Hero Banner */}
      <div className="relative h-72 sm:h-84 md:h-96 w-full -mt-16 overflow-hidden">
        <img 
          src={artist.bannerUrl || artist.avatarUrl} 
          alt={artist.name} 
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80';
          }}
          className="w-full h-full object-cover object-center filter brightness-[0.7]" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/40 to-transparent" />
        
        <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-[#1db954] text-black text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
              <Sparkles className="w-3 h-3 fill-current" />
              Verified Artist
            </span>
            <span className="text-xs text-white/80 font-medium">{artist.genre}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight drop-shadow-md">
            {artist.name}
          </h1>

          <p className="text-xs sm:text-sm font-semibold text-white/70">
            {artist.monthlyListeners}
          </p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-6 py-4 flex items-center gap-4">
        {tracks.length > 0 && (
          <button 
            onClick={() => onPlayTrack(tracks[0], undefined, tracks)}
            className="w-14 h-14 bg-[#1db954] hover:scale-105 active:scale-95 rounded-full flex items-center justify-center text-black shadow-xl shadow-[#1db954]/20 transition"
          >
            {isPlaying && currentTrack && tracks.some(t => t.id === currentTrack.id) ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-1" />
            )}
          </button>
        )}

        <button 
          onClick={() => setIsFollowing(!isFollowing)}
          className={`px-5 py-2 rounded-full text-xs font-bold border transition ${
            isFollowing 
              ? 'border-[#1db954] text-[#1db954] bg-[#1db954]/10' 
              : 'border-white/30 text-white hover:border-white'
          }`}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-white/50 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
          <Radio className="w-3.5 h-3.5 text-[#1db954]" />
          <span>320kbps HD Audio Available</span>
        </div>
      </div>

      {/* Popular Tracks Section */}
      <div className="px-6 mt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Popular Songs ({tracks.length})</h2>
          <span className="text-xs text-[#1db954] font-semibold bg-[#1db954]/10 px-2.5 py-1 rounded-full border border-[#1db954]/20">
            Background Audio Active
          </span>
        </div>

        {tracks.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No tracks found for this artist.</p>
        ) : (
          <div className="space-y-1">
            {tracks.map((track, index) => {
              const isActive = currentTrack?.id === track.id;

              return (
                <div 
                  key={`${track.id}-${index}`}
                  onClick={() => onPlayTrack(track, undefined, tracks)}
                  className={`group flex items-center justify-between p-2.5 rounded-lg hover:bg-white/10 active:bg-white/15 transition cursor-pointer ${
                    isActive ? 'bg-white/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <span className="w-5 text-center text-sm font-semibold text-white/40 group-hover:hidden">
                      {index + 1}
                    </span>
                    <div className="w-5 hidden group-hover:flex items-center justify-center text-white">
                      {isActive && isPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current" />
                      )}
                    </div>

                    <img 
                      src={track.coverUrl} 
                      alt={track.title} 
                      className="w-10 h-10 rounded-md object-cover shadow flex-shrink-0" 
                    />

                    <div className="overflow-hidden flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold truncate ${isActive ? 'text-[#1db954]' : 'text-white'}`}>
                          {track.title}
                        </span>
                        {track.streamUrl && (
                          <span className="text-[9px] bg-[#1db954]/20 text-[#1db954] font-extrabold px-1 rounded flex-shrink-0">
                            320k
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-white/50 truncate block mt-0.5">
                        {track.album || artist.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-white/50 pl-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddTrackToLiked?.(track);
                      }}
                      className="hover:text-white transition"
                    >
                      <Heart className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-right">{formatDuration(track.duration)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* About Section */}
      {artist.bio && (
        <div className="px-6 mt-10">
          <h2 className="text-xl font-bold text-white mb-3 tracking-tight">About</h2>
          <div className="p-5 rounded-2xl bg-[#181818] border border-white/5 shadow-xl">
            <p className="text-sm text-white/80 leading-relaxed font-normal">
              {artist.bio}
            </p>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
              <span>{artist.monthlyListeners}</span>
              <span className="text-[#1db954] font-semibold">{artist.genre}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
