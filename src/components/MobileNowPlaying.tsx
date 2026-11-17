import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Heart,
  MoreHorizontal,
  Share2,
  ListMusic,
  Timer,
  Volume1,
  Volume2,
  VolumeX,
  Check,
  Mic2,
  Download,
  CheckCircle2,
  Loader2,
  MessageSquareQuote,
  Radio,
  AudioLines,
  ChevronLeft,
  X,
} from 'lucide-react';
import { Track, RepeatMode } from '../types';
import { tryFetchBackendJson } from '../lib/apiConfig';
import { directFetchLyrics } from '../lib/directMusicProvider';
import { canSaveTrackOffline } from '../lib/offlineVault';
import { getCanvasMedia, CanvasMedia } from '../api';
import QueuePanel from './design/QueuePanel';
import { ECHO_COVERS } from './echoCovers';
import { getCrispCoverUrl } from '../lib/coverUrl';
import WavingProgressBar from './WavingProgressBar';

interface MobileNowPlayingProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress?: number;
  duration?: number;
  onSeekTime?: (time: number) => void;
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
  volume?: number;
  onVolumeChange?: (vol: number) => void;
  queue?: Track[];
  upcomingFallback?: Track[];
  onPlayTrackFromQueue?: (track: Track) => void;
  onReorderQueue?: (fromIndex: number, toIndex: number) => void;
  onRemoveFromQueue?: (index: number) => void;
  onClearQueue?: () => void;
  isOfflineSaved?: boolean;
  isSavingOffline?: boolean;
  onToggleSaveOffline?: (track: Track) => void;
}

interface LrcLine {
  time: number;
  text: string;
}

type NowPlayingMode = 'player' | 'lyrics' | 'queue';

export default function MobileNowPlaying({
  currentTrack,
  isPlaying,
  progress: propProgress,
  duration: propDuration,
  onSeekTime,
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
  volume = 1,
  onVolumeChange,
  queue = [],
  upcomingFallback = [],
  onPlayTrackFromQueue = () => {},
  onReorderQueue = () => {},
  onRemoveFromQueue = () => {},
  onClearQueue = () => {},
  isOfflineSaved = false,
  isSavingOffline = false,
  onToggleSaveOffline,
}: MobileNowPlayingProps) {
  const [progress, setProgress] = useState<number>(
    () =>
      propProgress ??
      (typeof window !== 'undefined'
        ? (window as unknown as { __auraPlayerProgress?: number }).__auraPlayerProgress ?? 0
        : 0)
  );
  const [duration, setDuration] = useState<number>(
    () =>
      propDuration && propDuration > 0
        ? propDuration
        : currentTrack?.duration
          ? currentTrack.duration / 1000
          : 0
  );
  const [scrubPreviewTime, setScrubPreviewTime] = useState<number | null>(null);
  const [syncedLines, setSyncedLines] = useState<LrcLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState('');
  const [activeTab, setActiveTab] = useState<NowPlayingMode>('player');
  const [vocalFocus, setVocalFocus] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isOutputSheetOpen, setIsOutputSheetOpen] = useState(false);
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
  const [activeTimerMinutes, setActiveTimerMinutes] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [canvasMedia, setCanvasMedia] = useState<CanvasMedia | null>(null);
  const [isVideoCanvasReady, setIsVideoCanvasReady] = useState(false);
  const timerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);
  const topLightRef = useRef<HTMLDivElement>(null);
  const topRayRef = useRef<HTMLDivElement>(null);
  const canvasVideoRef = useRef<HTMLVideoElement>(null);
  const canvasIframeRef = useRef<HTMLIFrameElement>(null);
  const iframeFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const lastSyncRef = useRef<{ songSec: number; wallMs: number }>({
    songSec: propProgress ?? 0,
    wallMs: typeof performance !== 'undefined' ? performance.now() : 0,
  });
  isPlayingRef.current = isPlaying;

  const trackBpm = useMemo(() => {
    if (!currentTrack) return 114;
    const seedStr = `${currentTrack.id}-${currentTrack.title}`;
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    return 96 + (hash % 36);
  }, [currentTrack?.id, currentTrack?.title]);

  useEffect(() => {
    if (typeof propProgress === 'number' && isFinite(propProgress)) {
      setProgress(propProgress);
      lastSyncRef.current = { songSec: propProgress, wallMs: performance.now() };
    }
  }, [propProgress]);

  useEffect(() => {
    if (typeof propDuration === 'number' && isFinite(propDuration) && propDuration > 0) {
      setDuration(propDuration);
    }
  }, [propDuration]);

  useEffect(() => {
    const handleProgress = (e: Event) => {
      const time = (e as CustomEvent).detail;
      if (typeof time === 'number' && isFinite(time)) {
        setProgress(time);
        lastSyncRef.current = { songSec: time, wallMs: performance.now() };
      }
    };
    window.addEventListener('playerProgress', handleProgress);
    return () => window.removeEventListener('playerProgress', handleProgress);
  }, []);

  useEffect(() => {
    lastSyncRef.current = { songSec: progress, wallMs: performance.now() };
  }, [isPlaying, currentTrack?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let rafId = 0;
    let smoothedEnergy = isPlaying ? 0.35 : 0;
    let lastNow = performance.now();

    const applyLightStyles = (energy: number) => {
      if (topLightRef.current) {
        topLightRef.current.style.opacity = (0.16 + energy * 0.58).toFixed(3);
        const sx = (0.94 + energy * 0.14).toFixed(3);
        const sy = (0.9 + energy * 0.22).toFixed(3);
        topLightRef.current.style.transform = `translate3d(-50%, 0, 0) scale(${sx}, ${sy})`;
      }
      if (topRayRef.current) {
        topRayRef.current.style.opacity = (0.14 + energy * 0.5).toFixed(3);
      }
    };

    if (reducedMotion) {
      applyLightStyles(0.22);
      return;
    }

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
      lastNow = now;

      let targetEnergy = 0;
      if (isPlayingRef.current) {
        const wallDelta = Math.min(0.4, Math.max(0, (now - lastSyncRef.current.wallMs) / 1000));
        const liveSongSec = lastSyncRef.current.songSec + wallDelta;
        const beatPos = (liveSongSec * (trackBpm / 60)) % 1;
        const kick = Math.exp(-beatPos * 5.0);
        const offBeat = 0.26 * Math.exp(-(((beatPos + 0.5) % 1) * 7.8));
        targetEnergy = Math.min(1, kick + offBeat);
      }

      const blendRate = targetEnergy > smoothedEnergy ? 24 : 9;
      smoothedEnergy += (targetEnergy - smoothedEnergy) * Math.min(1, dt * blendRate);
      applyLightStyles(smoothedEnergy);

      if (isPlayingRef.current || smoothedEnergy > 0.015) {
        rafId = requestAnimationFrame(tick);
      } else {
        applyLightStyles(0);
        rafId = 0;
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isPlaying, trackBpm, currentTrack?.id]);

  useEffect(() => {
    if (propDuration && propDuration > 0) {
      setDuration(propDuration);
    } else if (currentTrack?.duration) {
      setDuration(currentTrack.duration / 1000);
    }
  }, [currentTrack, propDuration]);

  // Fetch exact-song muted background video canvas on track change
  useEffect(() => {
    if (iframeFadeTimerRef.current) {
      clearTimeout(iframeFadeTimerRef.current);
      iframeFadeTimerRef.current = null;
    }
    setCanvasMedia(null);
    setIsVideoCanvasReady(false);

    if (!currentTrack || currentTrack.source === 'local') return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let cancelled = false;
    getCanvasMedia(currentTrack.title, currentTrack.artist)
      .then((media) => {
        if (!cancelled && media && (media.videoUrl || media.videoId)) {
          setCanvasMedia(media);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (iframeFadeTimerRef.current) {
        clearTimeout(iframeFadeTimerRef.current);
        iframeFadeTimerRef.current = null;
      }
    };
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist, currentTrack?.source]);

  // Sync muted background video canvas play/pause with audio state
  useEffect(() => {
    const vid = canvasVideoRef.current;
    if (vid) {
      vid.muted = true;
      if (isPlaying) {
        const playPromise = vid.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      } else {
        vid.pause();
      }
    }

    const iframe = canvasIframeRef.current;
    if (iframe?.contentWindow && canvasMedia?.videoId) {
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event: 'command',
            func: isPlaying ? 'playVideo' : 'pauseVideo',
            args: [],
          }),
          '*'
        );
      } catch {
        // Ignore cross-origin postMessage readiness timing
      }
    }
  }, [isPlaying, canvasMedia?.videoUrl, canvasMedia?.videoId]);

  useEffect(() => {
    if (!currentTrack) return;
    let isCancelled = false;

    const fetchLyrics = async () => {
      try {
        const backendData = await tryFetchBackendJson<{ syncedLyrics?: string | null; plainLyrics?: string | null }>(
          '/api/lyrics',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: currentTrack.title, artist: currentTrack.artist }),
          }
        );
        const data = backendData ?? (await directFetchLyrics(currentTrack.title, currentTrack.artist));
        if (isCancelled) return;

        if (data?.syncedLyrics) {
          const lines = data.syncedLyrics.split('\n');
          const parsed: LrcLine[] = [];
          const timeRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
          lines.forEach((line: string) => {
            const matches = [...line.matchAll(timeRegex)];
            if (matches.length > 0) {
              const text = line.replace(timeRegex, '').trim();
              if (!text) return;
              for (const match of matches) {
                const minutes = parseInt(match[1], 10);
                const seconds = parseInt(match[2], 10);
                const msRaw = match[3] || '0';
                const ms = parseInt(msRaw.padEnd(3, '0').slice(0, 3), 10);
                const time = minutes * 60 + seconds + ms / 1000;
                parsed.push({ time, text });
              }
            }
          });
          parsed.sort((a, b) => a.time - b.time);
          setSyncedLines(parsed);
          setPlainLyrics('');
        } else if (data?.plainLyrics) {
          setPlainLyrics(data.plainLyrics);
          setSyncedLines([]);
        } else {
          setPlainLyrics('Lyrics unavailable for this track.');
          setSyncedLines([]);
        }
      } catch {
        if (!isCancelled) {
          setPlainLyrics('Lyrics unavailable for this track.');
          setSyncedLines([]);
        }
      }
    };

    fetchLyrics();
    return () => {
      isCancelled = true;
    };
  }, [currentTrack]);

  const effectiveProgress = scrubPreviewTime ?? progress;

  const activeLineIndex = useMemo(() => {
    if (syncedLines.length === 0) return -1;
    for (let i = syncedLines.length - 1; i >= 0; i--) {
      if (effectiveProgress >= syncedLines[i].time - 0.25) {
        return i;
      }
    }
    return 0;
  }, [effectiveProgress, syncedLines]);

  useEffect(() => {
    if (activeTab === 'lyrics' && activeLineIndex !== -1 && lyricsContainerRef.current) {
      const activeElem = lyricsContainerRef.current.children[activeLineIndex] as HTMLElement;
      if (activeElem) {
        activeElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIndex, activeTab]);

  const commitSeekTime = (time: number) => {
    if (!isFinite(time)) return;
    setProgress(time);
    setScrubPreviewTime(null);
    lastSyncRef.current = { songSec: time, wallMs: performance.now() };
    if (onSeekTime) {
      onSeekTime(time);
    } else {
      window.dispatchEvent(new CustomEvent('playerSeek', { detail: time }));
      window.dispatchEvent(new CustomEvent('playerProgress', { detail: time }));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    commitSeekTime(Number(e.target.value));
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time) || time < 0) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const remainingTime = Math.max(0, (duration || 0) - effectiveProgress);

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
      } catch {
        // User cancelled share dialog
      }
    } else {
      navigator.clipboard?.writeText(window.location.href);
      showToast('Track link copied to clipboard');
    }
  };

  const setSleepTimer = (minutes: number) => {
    if (timerTimeoutRef.current) clearTimeout(timerTimeoutRef.current);
    setActiveTimerMinutes(minutes);
    setIsTimerModalOpen(false);
    setIsMoreMenuOpen(false);
    showToast(`Sleep timer set for ${minutes} min`);

    timerTimeoutRef.current = setTimeout(() => {
      onPlayPause();
      setActiveTimerMinutes(null);
      showToast('Sleep timer expired. Playback paused.');
    }, minutes * 60 * 1000);
  };

  const clearSleepTimer = () => {
    if (timerTimeoutRef.current) clearTimeout(timerTimeoutRef.current);
    setActiveTimerMinutes(null);
    setIsTimerModalOpen(false);
    showToast('Sleep timer turned off');
  };

  useEffect(() => {
    const handleBack = (e: Event) => {
      e.preventDefault();
      if (isTimerModalOpen) {
        setIsTimerModalOpen(false);
      } else if (isMoreMenuOpen) {
        setIsMoreMenuOpen(false);
      } else if (isOutputSheetOpen) {
        setIsOutputSheetOpen(false);
      } else if (activeTab !== 'player') {
        setActiveTab('player');
      } else {
        onClose();
      }
    };
    window.addEventListener('auraAndroidBack', handleBack);
    return () => window.removeEventListener('auraAndroidBack', handleBack);
  }, [isTimerModalOpen, isMoreMenuOpen, isOutputSheetOpen, activeTab, onClose]);

  if (!currentTrack) return null;

  const canOffline = Boolean(onToggleSaveOffline && canSaveTrackOffline(currentTrack) && currentTrack.source !== 'local');

  const qualityLabel = isOfflineSaved
    ? 'Offline Vault'
    : currentTrack.source === 'local'
      ? 'Local Lossless'
      : '320k Lossless';

  const crispCover = getCrispCoverUrl(currentTrack.coverUrl, ECHO_COVERS.global);
  const backdropCover = crispCover;
  const hasActiveVideoCanvas = Boolean(canvasMedia && (canvasMedia.videoUrl || canvasMedia.videoId) && isVideoCanvasReady);
  const isLyricsView = activeTab === 'lyrics';
  const isQueueView = activeTab === 'queue';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#090909] flex flex-col justify-between overflow-hidden select-none pt-safe pb-safe animate-in fade-in slide-in-from-bottom duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
      onTouchStart={(e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('[data-no-swipe="true"]') || target?.tagName === 'INPUT') {
          touchStartYRef.current = null;
          return;
        }
        touchStartYRef.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartYRef.current === null) return;
        const deltaY = (e.changedTouches[0]?.clientY ?? 0) - touchStartYRef.current;
        if (deltaY > 120 && activeTab === 'player') {
          onClose();
        }
        touchStartYRef.current = null;
      }}
    >
      {/* Dynamic Thumbnail Color-Mixture Blurred Glass Full-Screen Backdrop (Matches Music Bar) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none bg-[#090909]">
        <img
          src={backdropCover}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = ECHO_COVERS.global;
          }}
          className="absolute -left-[20%] -top-[18%] w-[95%] h-[85%] object-cover object-left-top scale-125 blur-[72px] saturate-[1.95] opacity-85 transition-opacity duration-700"
        />
        <img
          src={backdropCover}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = ECHO_COVERS.global;
          }}
          className="absolute -right-[20%] -bottom-[18%] w-[95%] h-[85%] object-cover object-right-bottom rotate-180 scale-125 blur-[80px] saturate-[2.05] opacity-75 mix-blend-screen transition-opacity duration-700"
        />
        <img
          src={backdropCover}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = ECHO_COVERS.global;
          }}
          className="absolute inset-0 w-full h-full object-cover object-center scale-150 blur-[92px] saturate-[1.65] opacity-55 transition-opacity duration-700"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-black/35 backdrop-blur-3xl"
        />

        {/* Exact-Song Muted Looping Background Video Canvas */}
        <div
          aria-hidden="true"
          className={`absolute inset-0 overflow-hidden pointer-events-none transition-all duration-500 ease-out ${
            isLyricsView
              ? 'blur-3xl scale-110 opacity-75'
              : isQueueView
                ? 'blur-2xl scale-105 opacity-45'
                : 'blur-0 scale-100 opacity-100'
          }`}
        >
          {canvasMedia?.videoUrl ? (
            <video
              ref={canvasVideoRef}
              key={`mv-${currentTrack.id}-${canvasMedia.videoUrl}`}
              src={canvasMedia.videoUrl}
              autoPlay={isPlaying}
              loop
              muted
              playsInline
              preload="auto"
              aria-hidden="true"
              onCanPlay={() => setIsVideoCanvasReady(true)}
              onPlaying={() => setIsVideoCanvasReady(true)}
              onError={() => {
                setIsVideoCanvasReady(false);
                setCanvasMedia(null);
              }}
              className={`w-full h-full object-cover object-center scale-[1.06] pointer-events-none transition-opacity duration-700 ${
                isVideoCanvasReady ? 'opacity-90' : 'opacity-0'
              }`}
            />
          ) : canvasMedia?.videoId ? (
            <iframe
              ref={canvasIframeRef}
              key={`yt-${currentTrack.id}-${canvasMedia.videoId}`}
              src={`https://www.youtube-nocookie.com/embed/${canvasMedia.videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${canvasMedia.videoId}&playsinline=1&disablekb=1&fs=0&modestbranding=1&rel=0&iv_load_policy=3&enablejsapi=1`}
              title=""
              aria-hidden="true"
              tabIndex={-1}
              allow="autoplay; encrypted-media"
              onLoad={() => {
                if (iframeFadeTimerRef.current) clearTimeout(iframeFadeTimerRef.current);
                iframeFadeTimerRef.current = setTimeout(() => {
                  setIsVideoCanvasReady(true);
                  if (!isPlayingRef.current && canvasIframeRef.current?.contentWindow) {
                    try {
                      canvasIframeRef.current.contentWindow.postMessage(
                        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
                        '*'
                      );
                    } catch {
                      // Ignore
                    }
                  }
                }, 900);
              }}
              onError={() => {
                setIsVideoCanvasReady(false);
                setCanvasMedia(null);
              }}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[195vh] min-w-[115%] h-[125%] min-h-[115vw] border-0 pointer-events-none scale-[1.16] transition-opacity duration-700 ${
                isVideoCanvasReady ? 'opacity-85' : 'opacity-0'
              }`}
            />
          ) : null}
        </div>

        {/* Full-Blur Frosted Veil when Lyrics (or Queue) is active */}
        <div
          aria-hidden="true"
          className={`absolute inset-0 bg-black/55 backdrop-blur-[56px] saturate-150 transition-opacity duration-500 ${
            isLyricsView ? 'opacity-100' : isQueueView ? 'opacity-85' : 'opacity-0'
          }`}
        />

        {/* Downward Black Blur Mist + Bottom-Up Dark Gradient Vignette (Streaming Canvas Look) */}
        <div
          aria-hidden="true"
          className={`absolute inset-x-0 bottom-0 h-[52vh] backdrop-blur-xl transition-opacity duration-500 ${
            hasActiveVideoCanvas && !isLyricsView ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 34%, black 70%, black 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 34%, black 70%, black 100%)',
          }}
        />
        <div
          aria-hidden="true"
          className={`absolute inset-0 transition-all duration-500 ${
            hasActiveVideoCanvas && !isLyricsView
              ? 'bg-gradient-to-b from-black/45 via-black/15 via-40% to-[#050505]/95'
              : 'bg-gradient-to-b from-white/[0.06] via-black/26 to-black/72'
          }`}
        />
        {hasActiveVideoCanvas && !isLyricsView && (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-[44vh] bg-gradient-to-t from-black via-black/85 to-transparent"
          />
        )}

        {/* Beat-Synced Top White Light Gradient Spotlight */}
        <div
          ref={topLightRef}
          aria-hidden="true"
          className="absolute -top-20 left-1/2 w-[135vw] max-w-[780px] h-[52vh] rounded-full blur-2xl mix-blend-screen will-change-[opacity,transform]"
          style={{
            opacity: 0.16,
            transform: 'translate3d(-50%, 0, 0) scale(0.94, 0.9)',
            background:
              'radial-gradient(ellipse 68% 58% at 50% 10%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.28) 38%, rgba(255,255,255,0.08) 65%, rgba(255,255,255,0) 100%)',
          }}
        />
        <div
          ref={topRayRef}
          aria-hidden="true"
          className="absolute top-0 inset-x-0 h-[36vh] mix-blend-screen will-change-[opacity]"
          style={{
            opacity: 0.14,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.12) 32%, rgba(255,255,255,0) 100%)',
          }}
        >
          <div className="mx-auto w-[72%] h-[2px] bg-gradient-to-r from-transparent via-white/90 to-transparent blur-[1px]" />
        </div>
      </div>

      {/* Subtle Glass Toast */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-black/70 backdrop-blur-xl border border-white/15 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-2xl">
          {toastMessage}
        </div>
      )}

      {/* Top Centered Grabber Pill (Tap to Close) */}
      <div className="relative z-20 flex items-center justify-center pt-3 pb-1 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 flex items-center justify-center cursor-pointer group"
          aria-label="Collapse Now Playing"
        >
          <span className="w-10 h-1 rounded-full bg-white/35 group-hover:bg-white/65 transition-colors" />
        </button>
      </div>

      {/* SCREENSHOT 1 STAGE: Full-Bleed Video Canvas with Lower Compact Thumbnail OR Centered Artwork Fallback */}
      {activeTab === 'player' && (
        <div
          className={`relative z-10 flex-1 flex flex-col px-7 sm:px-10 max-w-lg w-full mx-auto min-h-0 transition-all duration-500 ${
            hasActiveVideoCanvas ? 'justify-end pb-2' : 'justify-evenly'
          }`}
        >
          {!hasActiveVideoCanvas && (
            <div className="flex items-center justify-center py-2">
              <div
                className={`w-[76vw] max-w-[330px] sm:w-[320px] aspect-square rounded-2xl overflow-hidden shadow-[0_28px_72px_rgba(0,0,0,0.75)] ring-1 ring-white/15 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] bg-black/30 ${
                  isPlaying ? 'scale-100' : 'scale-[0.92]'
                }`}
              >
                <img
                  src={crispCover}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = ECHO_COVERS.global;
                  }}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Left-Aligned Thumbnail (during active video canvas) + Title + Artist paired with Like/Favourite & More (...) Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              {hasActiveVideoCanvas && (
                <div
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shadow-[0_14px_34px_rgba(0,0,0,0.7)] ring-1 ring-white/20 shrink-0 bg-black/40 transition-transform duration-300 ${
                    isPlaying ? 'scale-100' : 'scale-95'
                  }`}
                >
                  <img
                    src={crispCover}
                    alt={currentTrack.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = ECHO_COVERS.global;
                    }}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg sm:text-xl font-bold text-white tracking-tight truncate leading-snug drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]">
                  {currentTrack.title}
                </h2>
                <p className="text-[15px] font-medium text-white/80 truncate mt-0.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
                  {currentTrack.artist}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onToggleLike}
                className={`w-10 h-10 rounded-full border backdrop-blur-md flex items-center justify-center transition active:scale-90 cursor-pointer ${
                  isLiked
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/[0.12] border-white/[0.18] hover:bg-white/[0.22] text-white'
                }`}
                aria-label={isLiked ? 'Remove from Favourites' : 'Add to Favourites'}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(true)}
                className="w-10 h-10 rounded-full bg-white/[0.12] border border-white/[0.18] backdrop-blur-md hover:bg-white/[0.22] flex items-center justify-center text-white transition active:scale-90 cursor-pointer"
                aria-label="More playback options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCREENSHOT 2 STAGE: Compact Track Header + Blurred Synchronized Live Lyrics */}
      {activeTab === 'lyrics' && (
        <div className="relative z-10 flex-1 flex flex-col min-h-0 max-w-lg w-full mx-auto px-6 sm:px-8">
          {/* Compact Top Header (Thumbnail + Title + Artist + More Button) */}
          <div className="flex items-center justify-between gap-3 py-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('player')}
              className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group"
              aria-label="Return to Artwork view"
            >
              <img
                src={crispCover}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = ECHO_COVERS.global;
                }}
                className="w-12 h-12 rounded-lg object-cover shadow-lg shrink-0 group-hover:scale-95 transition-transform"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{currentTrack.title}</p>
                <p className="text-xs font-medium text-[#A3A3A3] truncate mt-0.5">{currentTrack.artist}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsMoreMenuOpen(true)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0 transition active:scale-90 cursor-pointer"
              aria-label="More playback options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Scrolling Blurred Lyrics Field + Floating Bottom-Right Vocal Button */}
          <div className="relative flex-1 min-h-0 mt-1">
            <div
              ref={lyricsContainerRef}
              data-no-swipe="true"
              className="h-full overflow-y-auto scrollbar-none py-10 space-y-5 px-2 pr-3"
              style={{
                maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 85%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 85%, transparent 100%)',
              }}
            >
              {syncedLines.length > 0 ? (
                syncedLines.map((line, idx) => {
                  const isActive = idx === activeLineIndex;
                  const distance = Math.abs(idx - activeLineIndex);
                  return (
                    <p
                      key={`${line.time}-${idx}`}
                      onClick={() => commitSeekTime(line.time)}
                      className={`font-display text-[25px] sm:text-[28px] font-extrabold leading-[1.24] tracking-tight cursor-pointer origin-left transition-all duration-300 ${
                        isActive
                          ? `scale-[1.03] opacity-100 blur-0 aura-lyric-glow ${
                              isPlaying ? 'aura-lyric-glow-playing' : ''
                            }`
                          : vocalFocus
                            ? distance <= 1
                              ? 'text-white/20 blur-[1.2px] hover:text-white/60 hover:blur-0'
                              : 'text-white/10 blur-[1.6px] hover:text-white/50 hover:blur-0'
                            : 'text-white/35 blur-[0.7px] hover:text-white/75 hover:blur-0'
                      }`}
                    >
                      {line.text}
                    </p>
                  );
                })
              ) : (
                <div className="py-12">
                  <p className="text-lg font-bold text-[#A3A3A3] whitespace-pre-wrap leading-relaxed">
                    {plainLyrics || 'Fetching synchronized lyrics...'}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom-Right Floating Vocal Focus Toggle Button (Screenshot 2) */}
            <button
              type="button"
              onClick={() => setVocalFocus((prev) => !prev)}
              className={`absolute bottom-3 right-0 w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center transition cursor-pointer ${
                vocalFocus
                  ? 'bg-white text-black border-white shadow-lg'
                  : 'bg-white/15 text-white border-white/20 hover:bg-white/25'
              }`}
              title={vocalFocus ? 'Disable Vocal Focus' : 'Enable Vocal Focus'}
              aria-label="Toggle vocal focus"
            >
              <Mic2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* QUEUE STAGE */}
      {activeTab === 'queue' && (
        <div className="relative z-10 flex-1 flex flex-col min-h-0 max-w-lg w-full mx-auto px-5 sm:px-7">
          <div className="flex items-center justify-between py-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('player')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A3A3A3] hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Now Playing</span>
            </button>
            <span className="text-xs font-bold text-white">Up Next</span>
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen(true)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              aria-label="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-none py-2">
            <QueuePanel
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              queue={queue}
              upcomingFallback={upcomingFallback}
              onPlayTrack={onPlayTrackFromQueue}
              onReorderQueue={onReorderQueue}
              onRemoveFromQueue={onRemoveFromQueue}
              onClearQueue={onClearQueue}
            />
          </div>
        </div>
      )}

      {/* SHARED BOTTOM CONTROLS DOCK (Consistent Frosted Glass across Artwork, Lyrics, Queue) */}
      <div className="relative z-20 px-7 sm:px-10 pb-6 pt-3 flex flex-col gap-5 max-w-lg w-full mx-auto shrink-0">
        {/* Waving Media Playback Progress Scrubber + Centered Lossless Label + Elapsed / Duration Timestamps */}
        <div className="flex flex-col gap-2" data-no-swipe="true">
          <WavingProgressBar
            progress={progress}
            duration={duration}
            isPlaying={isPlaying}
            onSeekTime={commitSeekTime}
            onSeekChange={handleSeek}
            onScrubPreview={setScrubPreviewTime}
            showHoverTooltip
            formatTime={formatTime}
            ariaLabel="Seek playback position"
          />

          <div className="grid grid-cols-3 items-center text-[11px] font-medium text-white/75 tabular-nums">
            <span className="text-left">{formatTime(effectiveProgress)}</span>
            <span className="inline-flex items-center justify-center gap-1 text-[10px] font-semibold text-white/85 bg-white/[0.12] border border-white/[0.16] backdrop-blur-md px-2 py-0.5 rounded-[4px] mx-auto whitespace-nowrap">
              <AudioLines className="w-3 h-3" />
              <span>{qualityLabel}</span>
            </span>
            <span className="text-right">-{formatTime(remainingTime)}</span>
          </div>
        </div>

        {/* Frosted Glass Transport Row: Shuffle · Previous · Play/Pause · Next · Repeat */}
        <div className="flex items-center justify-between px-1 py-1">
          <button
            type="button"
            onClick={onToggleShuffle}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition active:scale-90 cursor-pointer relative ${
              isShuffle
                ? 'text-white bg-white/[0.16] border border-white/[0.24] backdrop-blur-md'
                : 'text-white/70 hover:text-white hover:bg-white/[0.1]'
            }`}
            aria-label="Toggle shuffle"
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onPrev}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white active:scale-90 hover:bg-white/[0.12] transition cursor-pointer"
            aria-label="Previous track"
          >
            <SkipBack className="w-7 h-7 fill-current" />
          </button>

          <button
            type="button"
            onClick={onPlayPause}
            className="w-16 h-16 rounded-full bg-white text-black hover:bg-white/90 flex items-center justify-center active:scale-95 transition shadow-[0_10px_28px_rgba(0,0,0,0.45)] cursor-pointer"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white active:scale-90 hover:bg-white/[0.12] transition cursor-pointer"
            aria-label="Next track"
          >
            <SkipForward className="w-7 h-7 fill-current" />
          </button>

          <button
            type="button"
            onClick={onToggleRepeat}
            className={`relative w-11 h-11 rounded-full flex items-center justify-center transition active:scale-90 cursor-pointer ${
              repeatMode !== 'off'
                ? 'text-white bg-white/[0.16] border border-white/[0.24] backdrop-blur-md'
                : 'text-white/70 hover:text-white hover:bg-white/[0.1]'
            }`}
            aria-label="Toggle repeat mode"
          >
            <Repeat className="w-5 h-5" />
            {repeatMode === 'one' && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-white text-black text-[9px] font-extrabold flex items-center justify-center">
                1
              </span>
            )}
          </button>
        </div>

        {/* Speaker-to-Speaker Volume Slider */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onVolumeChange?.(volume > 0 ? 0 : 1)}
            className="text-white/75 hover:text-white transition cursor-pointer shrink-0"
            aria-label={volume === 0 ? 'Unmute' : 'Mute'}
          >
            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume1 className="w-4 h-4" />}
          </button>

          <div className="relative flex-1 flex items-center h-4">
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full"
                style={{ width: `${volume * 100}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => onVolumeChange?.(Number(e.target.value))}
              aria-label="Volume"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow"
              style={{ left: `${volume * 100}%` }}
            />
          </div>

          <button
            type="button"
            onClick={() => onVolumeChange?.(1)}
            className="text-white/75 hover:text-white transition cursor-pointer shrink-0"
            aria-label="Max volume"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom 3-Icon Utility Dock: Lyrics Quote · Audio Output / Vault · Up Next Queue */}
        <div className="grid grid-cols-3 items-center justify-items-center pt-1">
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'lyrics' ? 'player' : 'lyrics')}
            className={`w-11 h-9 rounded-lg flex items-center justify-center transition cursor-pointer ${
              activeTab === 'lyrics'
                ? 'bg-white/20 text-white backdrop-blur-md'
                : 'text-white/70 hover:text-white'
            }`}
            title="Lyrics"
            aria-label="Toggle live lyrics"
          >
            <MessageSquareQuote className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setIsOutputSheetOpen(true)}
            className={`relative w-11 h-9 rounded-lg flex items-center justify-center transition cursor-pointer ${
              isOfflineSaved
                ? 'text-white'
                : 'text-white/70 hover:text-white'
            }`}
            title="Audio Output & Offline Vault"
            aria-label="Audio output and offline options"
          >
            {isSavingOffline ? (
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            ) : (
              <Radio className="w-5 h-5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'queue' ? 'player' : 'queue')}
            className={`w-11 h-9 rounded-lg flex items-center justify-center transition cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-white/20 text-white backdrop-blur-md'
                : 'text-white/70 hover:text-white'
            }`}
            title="Playing Queue"
            aria-label="Toggle playing queue"
          >
            <ListMusic className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* MORE (...) MONOCHROME MENU SHEET — Holds Shuffle, Repeat, Offline, Sleep Timer, Share */}
      {isMoreMenuOpen && (
        <div
          onClick={() => setIsMoreMenuOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md aura-sheet rounded-t-3xl sm:rounded-2xl p-6 pb-8 flex flex-col gap-2"
          >
            <div className="flex items-center gap-3 pb-4 border-b border-[#2A2A2A]">
              <img
                src={crispCover}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-md object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{currentTrack.title}</p>
                <p className="text-xs text-[#A3A3A3] truncate">{currentTrack.artist}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-[#1B1B1B] border border-[#2A2A2A] flex items-center justify-center text-[#A3A3A3] hover:text-white cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onToggleShuffle();
                showToast(!isShuffle ? 'Shuffle turned on' : 'Shuffle turned off');
              }}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-[#1B1B1B] border border-[#2A2A2A] hover:bg-[#222222] text-sm font-semibold text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-3">
                <Shuffle className="w-4 h-4" />
                <span>Shuffle</span>
              </span>
              <span className="text-xs text-[#A3A3A3]">{isShuffle ? 'On' : 'Off'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleRepeat}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-[#1B1B1B] border border-[#2A2A2A] hover:bg-[#222222] text-sm font-semibold text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-3">
                <Repeat className="w-4 h-4" />
                <span>Repeat Mode</span>
              </span>
              <span className="text-xs text-[#A3A3A3] capitalize">
                {repeatMode === 'one' ? 'Repeat One' : repeatMode === 'all' ? 'Repeat All' : 'Off'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onToggleLike();
              }}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-[#1B1B1B] border border-[#2A2A2A] hover:bg-[#222222] text-sm font-semibold text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-3">
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-white text-white' : ''}`} />
                <span>{isLiked ? 'Remove from Favourites' : 'Add to Favourites'}</span>
              </span>
            </button>

            {canOffline && onToggleSaveOffline && (
              <button
                type="button"
                onClick={() => onToggleSaveOffline(currentTrack)}
                disabled={isSavingOffline}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-[#1B1B1B] border border-[#2A2A2A] hover:bg-[#222222] text-sm font-semibold text-white transition cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  {isOfflineSaved ? <CheckCircle2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                  <span>{isOfflineSaved ? 'Remove Offline Copy' : 'Save for Offline Playback'}</span>
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsMoreMenuOpen(false);
                setIsTimerModalOpen(true);
              }}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-[#1B1B1B] border border-[#2A2A2A] hover:bg-[#222222] text-sm font-semibold text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-3">
                <Timer className="w-4 h-4" />
                <span>Sleep Timer</span>
              </span>
              <span className="text-xs text-[#A3A3A3]">
                {activeTimerMinutes ? `${activeTimerMinutes} min` : 'Off'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleShare();
                setIsMoreMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[#1B1B1B] border border-[#2A2A2A] hover:bg-[#222222] text-sm font-semibold text-white transition cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Track</span>
            </button>
          </div>
        </div>
      )}

      {/* AUDIO OUTPUT & OFFLINE SHEET */}
      {isOutputSheetOpen && (
        <div
          onClick={() => setIsOutputSheetOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md aura-sheet rounded-t-3xl sm:rounded-2xl p-6 pb-8 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#2A2A2A]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4" />
                <span>Audio Output &amp; Vault</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsOutputSheetOpen(false)}
                className="text-xs text-[#A3A3A3] hover:text-white font-bold cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#1B1B1B] border border-[#2A2A2A] space-y-1">
              <p className="text-xs font-bold text-white">Continuous Background Engine</p>
              <p className="text-xs text-[#A3A3A3]">
                Quality: {qualityLabel} · Active on Lock Screen &amp; Background Tabs
              </p>
            </div>

            {canOffline && onToggleSaveOffline && (
              <button
                type="button"
                onClick={() => {
                  onToggleSaveOffline(currentTrack);
                  setIsOutputSheetOpen(false);
                }}
                disabled={isSavingOffline}
                className="w-full py-3.5 px-4 rounded-xl bg-white text-black text-sm font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-[#E5E5E5] transition"
              >
                <Download className="w-4 h-4" />
                <span>{isOfflineSaved ? 'Remove from Offline Vault' : 'Download for Zero-Internet Playback'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* SLEEP TIMER SHEET */}
      {isTimerModalOpen && (
        <div
          onClick={() => setIsTimerModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md aura-sheet rounded-t-3xl p-6 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#2A2A2A]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Timer className="w-4 h-4" />
                <span>Sleep Timer</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsTimerModalOpen(false)}
                className="text-xs text-[#A3A3A3] hover:text-white font-bold cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-1.5">
              {[15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setSleepTimer(mins)}
                  className={`w-full text-left py-3 px-4 rounded-xl text-sm font-semibold transition flex items-center justify-between cursor-pointer ${
                    activeTimerMinutes === mins
                      ? 'bg-white text-black'
                      : 'bg-[#1B1B1B] border border-[#2A2A2A] text-white hover:bg-[#222222]'
                  }`}
                >
                  <span>{mins} minutes</span>
                  {activeTimerMinutes === mins && <Check className="w-4 h-4" />}
                </button>
              ))}

              {activeTimerMinutes && (
                <button
                  type="button"
                  onClick={clearSleepTimer}
                  className="w-full text-left py-3 px-4 rounded-xl text-sm font-bold text-[#A3A3A3] hover:text-white hover:bg-[#1B1B1B] transition mt-2 cursor-pointer"
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
