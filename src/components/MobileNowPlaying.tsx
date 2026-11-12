import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronDown, 
  MoreHorizontal, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Plus, 
  Check, 
  Share2, 
  MonitorSpeaker, 
  ListMusic, 
  Languages, 
  Timer, 
  Maximize2, 
  Minimize2, 
  Sparkles,
  Clapperboard,
  Volume2
} from 'lucide-react';
import { Track, RepeatMode } from '../types';
import { getCanvasVideo } from '../api';

interface MobileNowPlayingProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: RepeatMode;
  onToggleRepeat: () => void;
  onClose: () => void;
  isLiked: boolean;
  onToggleLike: () => void;
}

interface LrcLine {
  time: number;
  text: string;
}

export default function MobileNowPlaying({
  currentTrack,
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
  isShuffle,
  onToggleShuffle,
  repeatMode,
  onToggleRepeat,
  onClose,
  isLiked,
  onToggleLike,
}: MobileNowPlayingProps) {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [syncedLines, setSyncedLines] = useState<LrcLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState('');
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(false);
  const [canvasVideoId, setCanvasVideoId] = useState<string | null>(null);
  const [showCanvasVideo, setShowCanvasVideo] = useState(true);
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
  const [activeTimerMinutes, setActiveTimerMinutes] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const timerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Listen to progress events from the audio player
  useEffect(() => {
    const handleProgress = (e: Event) => {
      const time = (e as CustomEvent).detail;
      if (typeof time === 'number') {
        setProgress(time);
      }
    };
    window.addEventListener('playerProgress', handleProgress);
    return () => window.removeEventListener('playerProgress', handleProgress);
  }, []);

  // Set duration from track or audio
  useEffect(() => {
    if (currentTrack?.duration) {
      setDuration(currentTrack.duration / 1000);
    }
  }, [currentTrack]);

  // Fetch canvas video for the track
  useEffect(() => {
    if (!currentTrack) return;
    let isCancelled = false;

    // Reset video state while fetching
    setCanvasVideoId(null);

    const loadCanvas = async () => {
      // If track has a youtubeId, use it; otherwise search for official visualizer / music video
      if (currentTrack.youtubeId) {
        if (!isCancelled) setCanvasVideoId(currentTrack.youtubeId);
        return;
      }

      const vidId = await getCanvasVideo(currentTrack.title, currentTrack.artist);
      if (!isCancelled && vidId) {
        setCanvasVideoId(vidId);
      }
    };

    loadCanvas();
    return () => { isCancelled = true; };
  }, [currentTrack?.title, currentTrack?.artist]);

  // Ambient fluid canvas animation fallback when video is off or loading
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || (showCanvasVideo && canvasVideoId)) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let step = 0;

    const render = () => {
      step += 0.015;
      const width = canvas.width = canvas.offsetWidth;
      const height = canvas.height = canvas.offsetHeight;

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#2d0f1e');
      gradient.addColorStop(0.5, '#120a14');
      gradient.addColorStop(1, '#08080a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Subtle dynamic waves
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, height * 0.5);
        for (let x = 0; x <= width; x += 15) {
          const y = Math.sin(x * 0.008 + step + i) * (20 + i * 15) + (height * (0.45 + i * 0.1));
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(225, 45, 95, ${0.12 - i * 0.03})`;
        ctx.lineWidth = 40;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [showCanvasVideo, canvasVideoId]);

  // Fetch lyrics
  useEffect(() => {
    if (!currentTrack) return;
    let isCancelled = false;

    const fetchLyrics = async () => {
      try {
        const res = await fetch('/api/lyrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: currentTrack.title, artist: currentTrack.artist })
        });
        const data = await res.json();
        if (isCancelled) return;

        if (data.syncedLyrics) {
          const lines = data.syncedLyrics.split('\n');
          const parsed: LrcLine[] = [];
          const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
          lines.forEach((line: string) => {
            const match = timeRegex.exec(line);
            if (match) {
              const minutes = parseInt(match[1], 10);
              const seconds = parseInt(match[2], 10);
              const ms = parseInt(match[3].padEnd(3, '0').slice(0, 3), 10);
              const time = minutes * 60 + seconds + ms / 1000;
              const text = line.replace(timeRegex, '').trim();
              if (text) parsed.push({ time, text });
            }
          });
          setSyncedLines(parsed);
          setPlainLyrics('');
        } else if (data.plainLyrics) {
          setPlainLyrics(data.plainLyrics);
          setSyncedLines([]);
        } else {
          setPlainLyrics('Lyrics unavailable for this track');
          setSyncedLines([]);
        }
      } catch (err) {
        if (!isCancelled) {
          setPlainLyrics('Lyrics unavailable for this track');
          setSyncedLines([]);
        }
      }
    };

    fetchLyrics();
    return () => { isCancelled = true; };
  }, [currentTrack]);

  // Current active lyric line
  const activeLineIndex = useMemo(() => {
    if (syncedLines.length === 0) return -1;
    for (let i = syncedLines.length - 1; i >= 0; i--) {
      if (progress >= syncedLines[i].time - 0.25) {
        return i;
      }
    }
    return 0;
  }, [progress, syncedLines]);

  const activeLineText = useMemo(() => {
    if (activeLineIndex >= 0 && syncedLines[activeLineIndex]) {
      return syncedLines[activeLineIndex].text;
    }
    return null;
  }, [activeLineIndex, syncedLines]);

  // Auto-scroll lyrics in expanded sheet
  useEffect(() => {
    if (isLyricsExpanded && activeLineIndex !== -1 && lyricsContainerRef.current) {
      const activeElem = lyricsContainerRef.current.children[activeLineIndex] as HTMLElement;
      if (activeElem) {
        activeElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIndex, isLyricsExpanded]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setProgress(time);
    window.dispatchEvent(new CustomEvent('playerSeek', { detail: time }));
    window.dispatchEvent(new CustomEvent('playerProgress', { detail: time }));
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleShare = async () => {
    if (navigator.share && currentTrack) {
      try {
        await navigator.share({
          title: currentTrack.title,
          text: `Listening to ${currentTrack.title} by ${currentTrack.artist} on Aura Music`,
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      navigator.clipboard?.writeText(window.location.href);
      showToast('Track link copied to clipboard!');
    }
  };

  const setSleepTimer = (minutes: number) => {
    if (timerTimeoutRef.current) clearTimeout(timerTimeoutRef.current);
    setActiveTimerMinutes(minutes);
    setIsTimerModalOpen(false);
    showToast(`Sleep timer set for ${minutes} minutes`);

    timerTimeoutRef.current = setTimeout(() => {
      onPlayPause();
      setActiveTimerMinutes(null);
      showToast('Sleep timer expired. Music paused.');
    }, minutes * 60 * 1000);
  };

  const clearSleepTimer = () => {
    if (timerTimeoutRef.current) clearTimeout(timerTimeoutRef.current);
    setActiveTimerMinutes(null);
    setIsTimerModalOpen(false);
    showToast('Sleep timer turned off');
  };

  if (!currentTrack) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#121212] flex flex-col justify-between overflow-hidden select-none animate-in fade-in slide-in-from-bottom duration-300">
      
      {/* 1. SPOTIFY-STYLE BACKGROUND CANVAS / VIDEO (Full-bleed vertical 9:16 portrait video) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        {/* Ambient blurred backdrop to eliminate any black flash while video loads */}
        <img 
          src={currentTrack.coverUrl} 
          alt="" 
          className="absolute inset-0 w-full h-full object-cover filter blur-3xl scale-125 opacity-60 pointer-events-none" 
        />

        {showCanvasVideo && canvasVideoId ? (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${canvasVideoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${canvasVideoId}&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&enablejsapi=1`}
              title="Spotify Canvas Video"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[185vh] min-w-full h-full min-h-[100vh] object-cover pointer-events-none scale-105 opacity-90"
              allow="autoplay; encrypted-media"
            />
          </div>
        ) : (
          <canvas ref={canvasRef} className="w-full h-full object-cover pointer-events-none" />
        )}

        {/* Cinematic Vignette Overlay matching Spotify Mobile */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/85 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-[480px] bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-white/95 text-black text-xs font-semibold px-4 py-2 rounded-full shadow-2xl backdrop-blur animate-in fade-in zoom-in-95">
          {toastMessage}
        </div>
      )}

      {/* Top Navigation Bar */}
      <div className="relative z-20 flex items-center justify-between px-5 pt-10 pb-2">
        <button 
          onClick={onClose} 
          className="w-10 h-10 flex items-center justify-center text-white/80 active:scale-95 transition"
          aria-label="Collapse"
        >
          <ChevronDown className="w-7 h-7" />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold tracking-widest uppercase text-white/60">
            PLAYING FROM SEARCH
          </span>
          <span className="text-xs font-bold text-white max-w-[200px] truncate mt-0.5">
            {currentTrack.album || currentTrack.artist}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Toggle Canvas Video Button */}
          <button 
            onClick={() => setShowCanvasVideo(!showCanvasVideo)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition ${showCanvasVideo && canvasVideoId ? 'text-[#1db954] bg-white/10' : 'text-white/60 hover:text-white'}`}
            title="Toggle Background Canvas Video"
          >
            <Clapperboard className="w-4 h-4" />
          </button>
          <button 
            onClick={handleShare}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white"
          >
            <MoreHorizontal className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Mid Canvas: Floating Live Synchronized Lyric (As seen in the screenshot "Uh") */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 pointer-events-none">
        {activeLineText && !isLyricsExpanded && (
          <div className="animate-in fade-in duration-300">
            <span className="text-xl sm:text-2xl font-extrabold text-white/90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] tracking-wide">
              {activeLineText}
            </span>
          </div>
        )}
      </div>

      {/* 2. LOWER SECTION: METADATA, SCRUBBER, TRANSPORT, AND LYRICS PREVIEW */}
      <div className="relative z-20 px-6 pb-6 flex flex-col gap-4">
        
        {/* Track Info Row (Screenshot: Thumbnail on left, title & artist, circled plus on right) */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden flex-1">
            <img 
              src={currentTrack.coverUrl} 
              alt={currentTrack.title}
              className="w-13 h-13 rounded-lg object-cover shadow-2xl border border-white/10 flex-shrink-0"
            />
            <div className="overflow-hidden flex-1">
              <h2 className="text-lg font-bold text-white tracking-tight truncate">
                {currentTrack.title}
              </h2>
              <p className="text-xs font-medium text-white/70 truncate mt-0.5">
                {currentTrack.artist}
              </p>
            </div>
          </div>

          <button 
            onClick={onToggleLike}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-90 transition border border-white/20 hover:border-white"
            aria-label="Add to library"
          >
            {isLiked ? (
              <Check className="w-5 h-5 text-[#1db954]" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Scrubber (Screenshot: Thin clean bar with thumb, 0:10 / 3:37) */}
        <div className="flex flex-col gap-1">
          <input 
            type="range" 
            min="0" 
            max={duration || 100} 
            value={progress}
            onChange={handleSeek}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
          />
          <div className="flex justify-between text-[11px] font-medium text-white/60 px-0.5">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls (Screenshot: Shuffle, Prev, Big White Circle Play/Pause, Next, Timer) */}
        <div className="flex items-center justify-between px-2 pt-1">
          <button 
            onClick={onToggleShuffle}
            className={`relative p-2 transition ${isShuffle ? 'text-[#1db954]' : 'text-white/60 hover:text-white'}`}
            aria-label="Shuffle"
          >
            <Shuffle className="w-5 h-5" />
            {isShuffle && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1db954] rounded-full" />
            )}
          </button>

          <button 
            onClick={onPrev}
            className="p-2 text-white/80 active:scale-90 hover:text-white transition"
            aria-label="Previous"
          >
            <SkipBack className="w-7 h-7 fill-current" />
          </button>

          {/* Large prominent white circular play button */}
          <button 
            onClick={onPlayPause}
            className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center shadow-[0_8px_25px_rgba(0,0,0,0.6)] active:scale-95 hover:scale-105 transition"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>

          <button 
            onClick={onNext}
            className="p-2 text-white/80 active:scale-90 hover:text-white transition"
            aria-label="Next"
          >
            <SkipForward className="w-7 h-7 fill-current" />
          </button>

          {/* Sleep Timer Icon */}
          <button 
            onClick={() => setIsTimerModalOpen(true)}
            className={`relative p-2 transition ${activeTimerMinutes ? 'text-[#1db954]' : 'text-white/60 hover:text-white'}`}
            aria-label="Sleep timer"
          >
            <Timer className="w-5 h-5" />
            {activeTimerMinutes && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1db954] rounded-full" />
            )}
          </button>
        </div>

        {/* Utility Icon Row (Cast / Device, Share, Queue / Repeat) */}
        <div className="flex items-center justify-between text-white/60 px-2 pt-1 text-xs">
          <div className="flex items-center gap-1.5 text-white/70">
            <MonitorSpeaker className="w-4 h-4 text-[#1db954]" />
            <span className="text-[11px] font-semibold text-[#1db954]">320kbps Lossless Audio</span>
          </div>

          <div className="flex items-center gap-5">
            <button onClick={handleShare} className="hover:text-white transition">
              <Share2 className="w-4 h-4" />
            </button>
            <button onClick={onToggleRepeat} className={`transition ${repeatMode !== 'off' ? 'text-[#1db954]' : 'hover:text-white'}`}>
              <Repeat className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3. FLOATING LYRICS PREVIEW CARD (Screenshot: Wine-red / burgundy rounded card) */}
        <div 
          onClick={() => setIsLyricsExpanded(!isLyricsExpanded)}
          className={`rounded-2xl bg-[#521327]/90 backdrop-blur-md border border-white/10 p-4 transition-all duration-300 cursor-pointer shadow-2xl ${
            isLyricsExpanded ? 'max-h-96 overflow-hidden' : 'max-h-48'
          }`}
        >
          {/* Card Header: "Lyrics preview" + translation icon */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-white tracking-wide">
              Lyrics preview
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={(e) => { e.stopPropagation(); showToast('Lyrics in original language'); }}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/90 hover:text-white"
              >
                <Languages className="w-3.5 h-3.5" />
              </button>
              {isLyricsExpanded ? (
                <Minimize2 className="w-3.5 h-3.5 text-white/70" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-white/70" />
              )}
            </div>
          </div>

          {/* Synchronized lyrics lines */}
          {syncedLines.length > 0 ? (
            <div 
              ref={lyricsContainerRef}
              className={`space-y-3 ${isLyricsExpanded ? 'max-h-72 overflow-y-auto scrollbar-none pr-1' : 'max-h-28 overflow-hidden'}`}
            >
              {syncedLines.slice(0, isLyricsExpanded ? syncedLines.length : 6).map((line, idx) => {
                const isActive = idx === activeLineIndex;
                return (
                  <p 
                    key={idx}
                    onClick={(e) => {
                      if (isLyricsExpanded) {
                        e.stopPropagation();
                        setProgress(line.time);
                        window.dispatchEvent(new CustomEvent('playerSeek', { detail: line.time }));
                      }
                    }}
                    className={`transition-all duration-300 text-sm leading-relaxed font-bold ${
                      isActive 
                        ? 'text-white scale-[1.02] origin-left drop-shadow' 
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    {line.text}
                  </p>
                );
              })}
            </div>
          ) : (
            <p className="text-sm font-semibold text-white/60 italic py-2">
              {plainLyrics || 'Fetching synchronized lyrics...'}
            </p>
          )}
        </div>

      </div>

      {/* Sleep Timer Modal Sheet */}
      {isTimerModalOpen && (
        <div 
          onClick={() => setIsTimerModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#242424] rounded-t-3xl p-6 flex flex-col gap-3 border-t border-white/10 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Timer className="w-4 h-4 text-[#1db954]" />
                Sleep Timer
              </h3>
              <button 
                onClick={() => setIsTimerModalOpen(false)}
                className="text-xs text-white/60 hover:text-white font-bold"
              >
                Close
              </button>
            </div>

            <div className="space-y-1">
              {[15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setSleepTimer(mins)}
                  className={`w-full text-left py-3 px-3 rounded-lg text-sm font-semibold transition flex items-center justify-between ${
                    activeTimerMinutes === mins ? 'bg-[#1db954]/20 text-[#1db954]' : 'text-white hover:bg-white/5'
                  }`}
                >
                  <span>{mins} minutes</span>
                  {activeTimerMinutes === mins && <Check className="w-4 h-4 text-[#1db954]" />}
                </button>
              ))}
              
              {activeTimerMinutes && (
                <button
                  onClick={clearSleepTimer}
                  className="w-full text-left py-3 px-3 rounded-lg text-sm font-bold text-rose-400 hover:bg-rose-500/10 transition mt-2"
                >
                  Turn off timer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
