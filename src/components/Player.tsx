import { Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Shuffle, MonitorSpeaker, ListMusic, Maximize2, Mic2 } from 'lucide-react';
import { Track, RepeatMode } from '../types';
import React, { useEffect, useRef, useState } from 'react';
import YouTube, { YouTubePlayer, YouTubeEvent } from 'react-youtube';

interface PlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: RepeatMode;
  onToggleRepeat: () => void;
  rightSidebarView: 'none' | 'queue' | 'lyrics';
  onToggleRightSidebar: (view: 'queue' | 'lyrics') => void;
}

export default function Player({ 
  currentTrack, 
  isPlaying, 
  onPlayPause, 
  onNext, 
  onPrev,
  isShuffle,
  onToggleShuffle,
  repeatMode,
  onToggleRepeat,
  rightSidebarView,
  onToggleRightSidebar
}: PlayerProps) {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const playerRef = useRef<YouTubePlayer | null>(null);

  // Background Media Session Integration
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || 'YouTube Audio',
        artwork: [
          { src: currentTrack.coverUrl || '', sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        onPlayPause();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        onPlayPause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        onPrev();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        onNext();
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime && playerRef.current) {
          playerRef.current.seekTo(details.seekTime, true);
          setProgress(details.seekTime);
          window.dispatchEvent(new CustomEvent('playerProgress', { detail: details.seekTime }));
        }
      });
    }
  }, [currentTrack, onPlayPause, onNext, onPrev]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && playerRef.current) {
      interval = setInterval(async () => {
        try {
          const time = await playerRef.current.getCurrentTime();
          const t = time || 0;
          setProgress(t);
          window.dispatchEvent(new CustomEvent('playerProgress', { detail: t }));
        } catch (e) {
          // ignore
        }
      }, 500); // 500ms for more responsive lyrics
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    const handleSeek = (e: Event) => {
      const time = (e as CustomEvent).detail;
      if (playerRef.current && typeof time === 'number') {
        playerRef.current.seekTo(time, true);
        setProgress(time);
      }
    };
    window.addEventListener('playerSeek', handleSeek);
    return () => window.removeEventListener('playerSeek', handleSeek);
  }, []);

  useEffect(() => {
    if (playerRef.current) {
      try {
        if (isPlaying) {
          playerRef.current.playVideo();
        } else {
          playerRef.current.pauseVideo();
        }
      } catch (error) {
        console.error("YouTube Player error:", error);
      }
    }
  }, [isPlaying, currentTrack]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (playerRef.current) {
      const time = Number(e.target.value);
      playerRef.current.seekTo(time, true);
      setProgress(time);
      window.dispatchEvent(new CustomEvent('playerProgress', { detail: time }));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    if (playerRef.current) {
      playerRef.current.setVolume(vol * 100);
    }
    setVolume(vol);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const onPlayerReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;
    event.target.setVolume(volume * 100);
    if (isPlaying) {
      event.target.playVideo();
    }
  };

  const onPlayerStateChange = (event: YouTubeEvent) => {
    const state = event.data;
    if (state === 1) { // PLAYING
      setDuration(event.target.getDuration());
    } else if (state === 0) { // ENDED
      onNext();
    }
  };

  const onPlayerError = (event: YouTubeEvent) => {
    console.error("YouTube Player Error:", event.data);
    // If a video fails to load/play (e.g. embedding disabled), skip to next after a short delay
    // to avoid infinite synchronous loops.
    setTimeout(() => {
      onNext();
    }, 1500);
  };

  return (
    <div className="h-[90px] bg-black border-t border-[#282828] flex items-center justify-between px-4 z-50 text-white select-none">
      
      {/* Hidden YouTube Player */}
      {currentTrack && currentTrack.youtubeId && (
        <div className="hidden">
          <YouTube 
            videoId={currentTrack.youtubeId}
            opts={{
              height: '0',
              width: '0',
              playerVars: {
                autoplay: 1,
                controls: 0,
                disablekb: 1,
                fs: 0,
                rel: 0,
                modestbranding: 1
              }
            }}
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            onError={onPlayerError}
          />
        </div>
      )}

      {/* Track Info */}
      <div className="w-[30%] min-w-[180px] flex items-center gap-4">
        {currentTrack ? (
          <>
            <div className="relative group">
              <img src={currentTrack.coverUrl} alt="cover" className="w-14 h-14 rounded-md shadow-lg object-cover" />
            </div>
            <div className="overflow-hidden flex flex-col justify-center">
              <h4 className="text-sm font-semibold truncate hover:underline cursor-pointer text-white">{currentTrack.title}</h4>
              <p className="text-[11px] text-[#b3b3b3] truncate hover:underline cursor-pointer">{currentTrack.artist}</p>
            </div>
            <button className="text-[#b3b3b3] hover:text-white ml-2 transition">
               <svg role="img" height="16" width="16" aria-hidden="true" viewBox="0 0 16 16" fill="currentColor"><path d="M1.69 2A4.582 4.582 0 0 1 8 2.023 4.583 4.583 0 0 1 11.88.817h.002a4.618 4.618 0 0 1 3.782 3.65v.003a4.543 4.543 0 0 1-1.011 3.84L9.35 14.629a1.765 1.765 0 0 1-2.093.464 1.762 1.762 0 0 1-1.15-1.464l-4.42-6.319a4.54 4.54 0 0 1-1.01-3.84 4.618 4.618 0 0 1 3.783-3.65h.002z"></path></svg>
            </button>
          </>
        ) : (
          <div className="text-xs text-gray-500 font-medium"></div>
        )}
      </div>

      {/* Controls */}
      <div className="flex-1 max-w-[722px] flex flex-col items-center gap-2">
        <div className="flex items-center gap-6">
          <button onClick={onToggleShuffle} className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition relative ${isShuffle ? 'text-[#1db954]' : 'text-[#b3b3b3] hover:text-white'}`}>
            <Shuffle className="w-4 h-4" />
            {isShuffle && <div className="absolute -bottom-1 w-1 h-1 bg-[#1db954] rounded-full"></div>}
          </button>
          <button onClick={onPrev} className="text-[#b3b3b3] hover:text-white transition"><SkipBack className="w-5 h-5 fill-current" /></button>
          <button 
            onClick={onPlayPause}
            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition transform"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-1" />}
          </button>
          <button onClick={onNext} className="text-[#b3b3b3] hover:text-white transition"><SkipForward className="w-5 h-5 fill-current" /></button>
          <button onClick={onToggleRepeat} className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition relative ${repeatMode !== 'off' ? 'text-[#1db954]' : 'text-[#b3b3b3] hover:text-white'}`}>
            <Repeat className="w-4 h-4" />
            {repeatMode === 'one' && <span className="absolute text-[8px] font-bold bg-[#181818] rounded-full w-3 h-3 flex items-center justify-center right-[5px] top-[14px]">1</span>}
            {repeatMode !== 'off' && <div className="absolute -bottom-1 w-1 h-1 bg-[#1db954] rounded-full"></div>}
          </button>
        </div>
        <div className="flex items-center gap-2 w-full max-w-md text-[11px] text-[#a7a7a7] font-medium group">
          <span className="w-10 text-right">{formatTime(progress)}</span>
          <input 
            type="range" 
            min={0} 
            max={duration || 100} 
            value={progress} 
            onChange={handleSeekChange}
            className="flex-1 h-1 bg-[#4d4d4d] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow hover:[&::-webkit-slider-thumb]:scale-110 [&::-webkit-slider-thumb]:opacity-0 group-hover:[&::-webkit-slider-thumb]:opacity-100 transition-all"
            style={{
              background: `linear-gradient(to right, ${currentTrack ? '#fff' : '#535353'} ${(progress / (duration || 1)) * 100}%, #535353 ${(progress / (duration || 1)) * 100}%)`
            }}
          />
          <span className="w-10 text-left">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Extras / Volume */}
      <div className="w-[30%] min-w-[180px] flex items-center justify-end gap-1 text-[#b3b3b3]">
        <button onClick={() => onToggleRightSidebar('lyrics')} className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition relative ${rightSidebarView === 'lyrics' ? 'text-[#1db954]' : 'hover:text-white'}`}>
          <Mic2 className="w-4 h-4" />
          {rightSidebarView === 'lyrics' && <div className="absolute -bottom-1 w-1 h-1 bg-[#1db954] rounded-full"></div>}
        </button>
        <button onClick={() => onToggleRightSidebar('queue')} className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition relative ${rightSidebarView === 'queue' ? 'text-[#1db954]' : 'hover:text-white'}`}>
          <ListMusic className="w-4 h-4" />
          {rightSidebarView === 'queue' && <div className="absolute -bottom-1 w-1 h-1 bg-[#1db954] rounded-full"></div>}
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition hover:text-white">
          <MonitorSpeaker className="w-4 h-4" />
        </button>
        <Volume2 className="w-5 h-5 hover:text-white cursor-pointer transition ml-2" />
        <input 
          type="range" 
          min={0} 
          max={1} 
          step={0.01}
          value={volume} 
          onChange={handleVolumeChange}
          className="w-[93px] h-1 bg-[#4d4d4d] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-110 [&::-webkit-slider-thumb]:opacity-0 hover:[&::-webkit-slider-thumb]:opacity-100 transition-all group"
          style={{
            background: `linear-gradient(to right, #fff ${volume * 100}%, #535353 ${volume * 100}%)`
          }}
        />
        <Maximize2 className="w-4 h-4 hover:text-white cursor-pointer transition ml-2" />
      </div>
    </div>
  );
}
