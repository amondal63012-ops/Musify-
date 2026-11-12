import { Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Shuffle, MonitorSpeaker, ListMusic, Maximize2, Mic2, Heart } from 'lucide-react';
import { Track, RepeatMode } from '../types';
import React, { useEffect, useRef, useState } from 'react';
import YouTube, { YouTubePlayer, YouTubeEvent } from 'react-youtube';
import Hls from 'hls.js';
import MobileNowPlaying from './MobileNowPlaying';

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
  isLiked?: boolean;
  onToggleLike?: () => void;
}

// Live Web Audio MediaStream provider to keep active OS audio hardware pipeline open across lock screen & tab switches
class LiveAudioSessionKeeper {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;

  getMediaStream(): MediaStream | null {
    try {
      if (!this.stream) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
        const dest = this.ctx.createMediaStreamDestination();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Sub-audible carrier (20Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(20, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.001, this.ctx.currentTime);

        osc.connect(gain);
        gain.connect(dest);
        osc.start();

        this.stream = dest.stream;
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.stream;
    } catch {
      return null;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }
}

const liveAudioSessionKeeper = new LiveAudioSessionKeeper();

const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

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
  onToggleRightSidebar,
  isLiked = false,
  onToggleLike = () => {}
}: PlayerProps) {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMobileNowPlayingOpen, setIsMobileNowPlayingOpen] = useState(false);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const carrierAudioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryCountRef = useRef(0);
  const loadedStreamUrlRef = useRef<string | null>(null);

  const isDirectAudio = Boolean(currentTrack?.streamUrl);

  useEffect(() => {
    retryCountRef.current = 0;
  }, [currentTrack?.id]);

  // Maintain active Web Audio hardware pipeline and silent carrier whenever playing
  useEffect(() => {
    if (isPlaying) {
      liveAudioSessionKeeper.resume();
      if (carrierAudioRef.current && carrierAudioRef.current.paused) {
        carrierAudioRef.current.play().catch(() => {});
      }
    } else {
      if (carrierAudioRef.current && !carrierAudioRef.current.paused) {
        carrierAudioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Prevent browser tab / lock screen throttling when app is minimized, locked, or user navigates to another site
  useEffect(() => {
    const handleBackgroundState = () => {
      liveAudioSessionKeeper.resume();
      if (isPlaying) {
        if (carrierAudioRef.current && carrierAudioRef.current.paused) {
          carrierAudioRef.current.play().catch(() => {});
        }
        if (audioRef.current && audioRef.current.paused && isDirectAudio) {
          audioRef.current.play().catch(() => {});
        }
        if (!isDirectAudio && playerRef.current) {
          try {
            playerRef.current.playVideo();
          } catch {}
        }
      }
    };

    document.addEventListener('visibilitychange', handleBackgroundState);
    window.addEventListener('focus', handleBackgroundState);
    window.addEventListener('blur', handleBackgroundState);
    return () => {
      document.removeEventListener('visibilitychange', handleBackgroundState);
      window.removeEventListener('focus', handleBackgroundState);
      window.removeEventListener('blur', handleBackgroundState);
    };
  }, [isPlaying, isDirectAudio]);

  // Periodic heartbeat ensuring background audio execution never stalls
  useEffect(() => {
    if (!isPlaying) return;
    const heartbeat = setInterval(() => {
      liveAudioSessionKeeper.resume();
      if (carrierAudioRef.current && carrierAudioRef.current.paused) {
        carrierAudioRef.current.play().catch(() => {});
      }
      if (isDirectAudio) {
        if (audioRef.current && audioRef.current.paused) {
          audioRef.current.play().catch(() => {});
        }
      } else {
        if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
          try {
            const state = playerRef.current.getPlayerState();
            // State 2 = PAUSED, State 5 = CUED, State -1 = UNSTARTED
            if (state === 2 && document.hidden) {
              playerRef.current.playVideo();
            }
          } catch {}
        }
      }
    }, 1000);

    return () => clearInterval(heartbeat);
  }, [isPlaying, isDirectAudio]);

  // Background Media Session Integration for Lock Screen / Headphone controls
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album || 'Single',
          artwork: [
            { src: currentTrack.coverUrl || '', sizes: '96x96', type: 'image/jpeg' },
            { src: currentTrack.coverUrl || '', sizes: '128x128', type: 'image/jpeg' },
            { src: currentTrack.coverUrl || '', sizes: '256x256', type: 'image/jpeg' },
            { src: currentTrack.coverUrl || '', sizes: '512x512', type: 'image/jpeg' },
          ]
        });

        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

        navigator.mediaSession.setActionHandler('play', () => {
          liveAudioSessionKeeper.resume();
          if (audioRef.current && audioRef.current.paused) {
            audioRef.current.play().catch(() => {});
          }
          if (!isDirectAudio && playerRef.current) {
            try {
              playerRef.current.playVideo();
            } catch {
              // ignore
            }
          }
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
          if (!isPlaying) {
            onPlayPause();
          }
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          if (audioRef.current) {
            audioRef.current.pause();
          }
          if (!isDirectAudio && playerRef.current) {
            try {
              playerRef.current.pauseVideo();
            } catch {
              // ignore
            }
          }
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
          }
          if (isPlaying) {
            onPlayPause();
          }
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
          onPrev();
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
          onNext();
        });

        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime != null) {
            if (isDirectAudio && audioRef.current) {
              audioRef.current.currentTime = details.seekTime;
            } else if (playerRef.current) {
              playerRef.current.seekTo(details.seekTime, true);
            }
            setProgress(details.seekTime);
            window.dispatchEvent(new CustomEvent('playerProgress', { detail: details.seekTime }));
          }
        });

        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const skip = details.seekOffset || 10;
          const newTime = Math.max(progress - skip, 0);
          if (isDirectAudio && audioRef.current) {
            audioRef.current.currentTime = newTime;
          } else if (playerRef.current) {
            playerRef.current.seekTo(newTime, true);
          }
          setProgress(newTime);
        });

        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const skip = details.seekOffset || 10;
          const newTime = Math.min(progress + skip, duration || 9999);
          if (isDirectAudio && audioRef.current) {
            audioRef.current.currentTime = newTime;
          } else if (playerRef.current) {
            playerRef.current.seekTo(newTime, true);
          }
          setProgress(newTime);
        });
      } catch (e) {
        console.error('MediaSession setup error:', e);
      }
    }
  }, [currentTrack, onPlayPause, onNext, onPrev, isPlaying, isDirectAudio, progress, duration]);

  // Update MediaSession position state when progress changes
  useEffect(() => {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(duration, 1),
          playbackRate: 1,
          position: Math.min(Math.max(progress, 0), duration)
        });
      } catch (e) {
        // Ignore edge-case duration rounding errors
      }
    }
  }, [progress, duration]);

  // Handle direct audio stream playback & background session carrier
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isDirectAudio && currentTrack?.streamUrl) {
      if (audio.srcObject) {
        audio.srcObject = null;
      }
      audio.loop = false;

      const streamUrl = currentTrack.streamUrl;
      const isHls = currentTrack.source === 'soundcloud' || streamUrl.includes('.m3u8') || streamUrl.includes('soundcloud');

      if (isHls && Hls.isSupported() && !audio.canPlayType('application/vnd.apple.mpegurl')) {
        if (!hlsRef.current || (hlsRef.current as any).url !== streamUrl) {
          if (hlsRef.current) {
            hlsRef.current.destroy();
          }
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hls.loadSource(streamUrl);
          hls.attachMedia(audio);
          (hls as any).url = streamUrl;
          loadedStreamUrlRef.current = streamUrl;
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (isPlaying) {
              audio.play().catch(e => console.warn('HLS play error:', e));
            }
          });
          hlsRef.current = hls;
        }
      } else {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        if (loadedStreamUrlRef.current !== streamUrl) {
          loadedStreamUrlRef.current = streamUrl;
          audio.src = streamUrl;
          audio.volume = volume;
          audio.load();
          setProgress(0);
        }
      }

      if (isPlaying) {
        if (playerRef.current) {
          try {
            playerRef.current.pauseVideo();
          } catch {}
        }
        if (audio.paused) {
          audio.play().catch(err => {
            console.warn('Audio play request failed/prevented:', err);
          });
        }
      } else {
        if (!audio.paused) {
          audio.pause();
        }
      }
    } else {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (audio.srcObject) {
        audio.srcObject = null;
      }
      loadedStreamUrlRef.current = null;
      audio.pause();
    }
  }, [currentTrack, isPlaying, isDirectAudio, volume]);

  // YouTube progress tracking (when playing via YouTube fallback)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (!isDirectAudio && isPlaying && playerRef.current) {
      interval = setInterval(async () => {
        try {
          const time = await playerRef.current.getCurrentTime();
          const t = time || 0;
          setProgress(t);
          window.dispatchEvent(new CustomEvent('playerProgress', { detail: t }));
        } catch (e) {
          // ignore
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isDirectAudio]);

  // Listen to seeking from lyrics or external events
  useEffect(() => {
    const handleSeek = (e: Event) => {
      const time = (e as CustomEvent).detail;
      if (typeof time === 'number') {
        if (isDirectAudio && audioRef.current) {
          audioRef.current.currentTime = time;
        } else if (playerRef.current) {
          playerRef.current.seekTo(time, true);
        }
        setProgress(time);
      }
    };
    window.addEventListener('playerSeek', handleSeek);
    return () => window.removeEventListener('playerSeek', handleSeek);
  }, [isDirectAudio]);

  // YouTube playback state sync
  useEffect(() => {
    if (playerRef.current) {
      if (isDirectAudio) {
        try {
          playerRef.current.pauseVideo();
        } catch {
          // ignore
        }
        return;
      }

      try {
        const ytId = currentTrack?.youtubeId || currentTrack?.id;
        if (ytId) {
          const currentData = playerRef.current.getVideoData?.();
          if (currentData && currentData.video_id !== ytId) {
            playerRef.current.loadVideoById(ytId);
          }
        }
        if (isPlaying) {
          playerRef.current.playVideo();
        } else {
          playerRef.current.pauseVideo();
        }
      } catch (error) {
        console.error("YouTube Player error:", error);
      }
    }
  }, [isPlaying, currentTrack, isDirectAudio]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (isDirectAudio && audioRef.current) {
      audioRef.current.currentTime = time;
    } else if (playerRef.current) {
      playerRef.current.seekTo(time, true);
    }
    setProgress(time);
    window.dispatchEvent(new CustomEvent('playerProgress', { detail: time }));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
    if (playerRef.current) {
      playerRef.current.setVolume(vol * 100);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const [isVideoFloating, setIsVideoFloating] = useState(false);
  const pipContainerRef = useRef<HTMLDivElement | null>(null);

  const togglePiP = async () => {
    if ('documentPictureInPicture' in window && (window as any).documentPictureInPicture) {
      try {
        if ((window as any).documentPictureInPicture.window) {
          (window as any).documentPictureInPicture.window.close();
          setIsVideoFloating(false);
          return;
        }
        const pipWin = await (window as any).documentPictureInPicture.requestWindow({
          width: 320,
          height: 190,
        });

        [...document.styleSheets].forEach((styleSheet) => {
          try {
            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
            const style = document.createElement('style');
            style.textContent = cssRules;
            pipWin.document.head.appendChild(style);
          } catch {
            if (styleSheet.href) {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = styleSheet.href;
              pipWin.document.head.appendChild(link);
            }
          }
        });

        if (pipContainerRef.current) {
          pipWin.document.body.appendChild(pipContainerRef.current);
          pipWin.document.body.style.margin = '0';
          pipWin.document.body.style.backgroundColor = '#000';
          pipWin.document.body.style.overflow = 'hidden';
          setIsVideoFloating(true);

          pipWin.addEventListener('pagehide', () => {
            const mount = document.getElementById('pip-original-mount');
            if (mount && pipContainerRef.current) {
              mount.appendChild(pipContainerRef.current);
            }
            setIsVideoFloating(false);
          });
        }
        return;
      } catch (err) {
        console.warn('Document PiP fallback to floating UI:', err);
      }
    }
    setIsVideoFloating(prev => !prev);
  };

  const onPlayerReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;
    event.target.setVolume(volume * 100);
    if (isPlaying && !isDirectAudio) {
      event.target.playVideo();
    }
  };

  const onPlayerStateChange = (event: YouTubeEvent) => {
    const state = event.data;
    if (state === 1) { // PLAYING
      setDuration(event.target.getDuration());
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    } else if (state === 2) { // PAUSED
      if (document.hidden && isPlaying) {
        // Tab was hidden / phone locked: browser triggered background pause; force resume!
        try {
          event.target.playVideo();
        } catch {}
      } else if (!isPlaying && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    } else if (state === 0) { // ENDED
      const curr = event.target.getCurrentTime() || 0;
      const dur = event.target.getDuration() || duration || 0;
      if (dur > 0 && curr >= dur - 3) {
        onNext();
      } else {
        try {
          event.target.playVideo();
        } catch {}
      }
    }
  };

  const onPlayerError = (event: YouTubeEvent) => {
    console.error("YouTube Player Error:", event.data);
    if (playerRef.current) {
      try {
        playerRef.current.playVideo();
      } catch {}
    }
  };

  return (
    <>
      {/* Native HTML5 Audio: Direct 320kbps MP3 playback + Lock Screen & Background playback hardware session holder */}
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        onCanPlay={() => {
          if (isPlaying && isDirectAudio && audioRef.current && audioRef.current.paused) {
            audioRef.current.play().catch(() => {});
          }
        }}
        onTimeUpdate={() => {
          if (audioRef.current && isDirectAudio) {
            const t = audioRef.current.currentTime;
            const d = audioRef.current.duration;
            if (!isNaN(t)) setProgress(t);
            if (!isNaN(d) && d > 0) setDuration(d);
            window.dispatchEvent(new CustomEvent('playerProgress', { detail: t }));
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && isDirectAudio) {
            const d = audioRef.current.duration;
            if (!isNaN(d) && d > 0) setDuration(d);
          }
        }}
        onEnded={() => {
          if (isDirectAudio) {
            const curr = audioRef.current?.currentTime || 0;
            const dur = audioRef.current?.duration || duration || 0;
            if (dur > 0 && curr >= dur - 3) {
              onNext();
            } else if (dur > 0 && curr < dur - 3) {
              if (audioRef.current) {
                audioRef.current.play().catch(() => {});
              }
            } else {
              onNext();
            }
          }
        }}
        onError={(e) => {
          console.warn("Direct stream error, attempting recovery:", e);
          if (isDirectAudio && audioRef.current) {
            const currentSrc = audioRef.current.src;
            const savedTime = audioRef.current.currentTime || 0;

            if (retryCountRef.current < 3) {
              retryCountRef.current += 1;
              setTimeout(() => {
                if (audioRef.current) {
                  if (currentSrc.includes('_320.')) {
                    audioRef.current.src = currentSrc.replace('_320.', '_160.');
                  } else if (currentSrc.includes('_160.')) {
                    audioRef.current.src = currentSrc.replace('_160.', '_96.');
                  } else {
                    audioRef.current.load();
                  }
                  if (savedTime > 0) {
                    audioRef.current.currentTime = savedTime;
                  }
                  audioRef.current.play().catch(() => {});
                }
              }, 1000);
              return;
            }

            const dur = audioRef.current.duration || duration || 0;
            if (dur > 0 && savedTime >= dur - 5) {
              onNext();
            }
          }
        }}
      />

      {/* Hardware OS Audio Session Carrier: Keeps audio pipeline active across lock screen, tabs, and home screen */}
      <audio
        ref={carrierAudioRef}
        src={SILENT_AUDIO_URI}
        loop
        playsInline
        preload="auto"
        className="hidden"
        style={{ display: 'none' }}
      />

      {/* Mount point for returning PiP container */}
      <div id="pip-original-mount">
        {/* Interactive Official Video / Picture-in-Picture Player Container */}
        {currentTrack && !isDirectAudio && (currentTrack.youtubeId || currentTrack.id) && (
          <div 
            ref={pipContainerRef}
            className={`fixed z-[9999] transition-all duration-300 shadow-2xl border border-white/20 bg-black rounded-xl overflow-hidden ${
              isVideoFloating 
                ? 'bottom-24 right-4 w-[320px] h-[190px]' 
                : 'bottom-2 right-2 w-[180px] h-[102px]'
            }`}
          >
            <div className="absolute top-1 right-1 z-10 flex items-center gap-1 bg-black/60 rounded-full px-1.5 py-0.5 backdrop-blur-sm">
              <button
                onClick={togglePiP}
                className="text-white/80 hover:text-white p-0.5 text-xs transition"
                title={isVideoFloating ? 'Minimize' : 'Float / PiP'}
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
          <YouTube 
            videoId={currentTrack.youtubeId || (currentTrack.id ? currentTrack.id.replace(/^yt_/, '') : '')}
            opts={{
              height: isVideoFloating ? '190' : '102',
              width: isVideoFloating ? '320' : '180',
              playerVars: {
                autoplay: 1,
                playsinline: 1,
                controls: 1,
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
      </div>

      {/* Floating Spotify Mobile Mini-Player (md:hidden) */}
      {currentTrack && (
        <div 
          onClick={() => setIsMobileNowPlayingOpen(true)}
          className="fixed bottom-[68px] left-2 right-2 z-40 bg-[#242424] hover:bg-[#2b2b2b] rounded-lg h-[56px] flex items-center justify-between px-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.8)] md:hidden cursor-pointer border border-white/5 active:scale-[0.99] transition-transform select-none"
        >
          {/* Left: Thumbnail & Song Info */}
          <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 pr-2">
            <img 
              src={currentTrack.coverUrl} 
              alt={currentTrack.title} 
              className="w-10 h-10 rounded object-cover shadow flex-shrink-0" 
            />
            <div className="truncate flex-1 min-w-0">
              <h4 className="text-xs font-bold text-white truncate">{currentTrack.title}</h4>
              <p className="text-[11px] text-[#b3b3b3] truncate mt-0.5">{currentTrack.artist}</p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={onToggleLike} 
              className="w-9 h-9 flex items-center justify-center rounded-full text-white/70 active:scale-90 transition"
              aria-label="Like"
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#1db954] text-[#1db954]' : 'hover:text-white'}`} />
            </button>
            <button 
              onClick={onPlayPause} 
              className="w-9 h-9 flex items-center justify-center rounded-full text-white active:scale-90 transition"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>
          </div>

          {/* Bottom Scrub Progress Line */}
          <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-white/10 rounded-b-lg overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-300" 
              style={{ width: `${Math.min(100, (progress / (duration || 1)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Full-Screen Spotify Mobile Now Playing View */}
      {isMobileNowPlayingOpen && currentTrack && (
        <MobileNowPlaying 
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onPlayPause={onPlayPause}
          onNext={onNext}
          onPrev={onPrev}
          isShuffle={isShuffle}
          onToggleShuffle={onToggleShuffle}
          repeatMode={repeatMode}
          onToggleRepeat={onToggleRepeat}
          onClose={() => setIsMobileNowPlayingOpen(false)}
          isLiked={isLiked}
          onToggleLike={onToggleLike}
        />
      )}

      {/* Desktop Player Bar (hidden md:flex) */}
      <div className="hidden md:flex h-[90px] bg-black border-t border-[#282828] items-center justify-between px-4 z-50 text-white select-none">
        {/* Track Info */}
        <div className="w-[30%] min-w-[180px] flex items-center gap-4">
          {currentTrack ? (
            <>
              <div className="relative group">
                <img src={currentTrack.coverUrl} alt="cover" className="w-14 h-14 rounded-md shadow-lg object-cover" />
              </div>
              <div className="overflow-hidden flex flex-col justify-center">
                <div className="flex items-center gap-2 max-w-full">
                  <h4 className="text-sm font-semibold truncate hover:underline cursor-pointer text-white">{currentTrack.title}</h4>
                  {isDirectAudio ? (
                    <span className="text-[9px] uppercase tracking-wider bg-[#1db954]/20 text-[#1db954] font-bold px-1.5 py-0.5 rounded border border-[#1db954]/30 flex-shrink-0" title="Direct Stream • Continuous Background & Lock Screen Active">
                      {currentTrack.source === 'soundcloud' ? 'SoundCloud' : currentTrack.source === 'gaana' ? 'Gaana 320k' : currentTrack.source === 'audius' ? 'Audius 320k' : '320k HD Audio'}
                    </span>
                  ) : (
                    <span className="text-[9px] uppercase tracking-wider bg-purple-500/20 text-purple-400 font-bold px-1.5 py-0.5 rounded border border-purple-500/30 flex-shrink-0" title="Official Studio Master • Background Floating Mode Ready">
                      Official Master
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#b3b3b3] truncate hover:underline cursor-pointer">{currentTrack.artist}</p>
              </div>
              <button 
                onClick={onToggleLike}
                className="text-[#b3b3b3] hover:text-white ml-2 transition"
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#1db954] text-[#1db954]' : ''}`} />
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
          <button 
            onClick={togglePiP} 
            title="Floating Picture-in-Picture across all sites & apps"
            className="text-[#b3b3b3] hover:text-white transition ml-2 p-1"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
