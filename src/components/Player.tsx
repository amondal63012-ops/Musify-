import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Repeat,
  Shuffle,
  MonitorSpeaker,
  ListMusic,
  Mic2,
  Heart,
  Download,
  CheckCircle2,
  Loader2,
  PictureInPicture2,
} from 'lucide-react';
import { Track, RepeatMode } from '../types';
import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import MobileNowPlaying from './MobileNowPlaying';
import { canSaveTrackOffline, resolveOfflineAudioUrl } from '../lib/offlineVault';
import { isNativeAndroid, resolveApiUrl } from '../lib/apiConfig';
import { resolveTrackFallback } from '../api';
import { AuraMedia3, canUseNativeMedia3 } from '../lib/nativeAudioBridge';

interface PlayerProps {
  currentTrack: Track | null;
  nextTrack?: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onExternalPlayingChange?: (playing: boolean) => void;
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
  onReplaceTrack?: (track: Track, failedTrackId?: string) => void;
  isOfflineSaved?: boolean;
  isSavingOffline?: boolean;
  onToggleSaveOffline?: (track: Track) => void;
}

interface DocumentPiPWindowApi {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
  window?: Window | null;
}

export default function Player({
  currentTrack,
  nextTrack = null,
  isPlaying,
  onPlayPause,
  onExternalPlayingChange,
  onNext,
  onPrev,
  isShuffle,
  onToggleShuffle,
  repeatMode,
  onToggleRepeat,
  rightSidebarView,
  onToggleRightSidebar,
  isLiked = false,
  onToggleLike = () => {},
  onReplaceTrack,
  isOfflineSaved = false,
  isSavingOffline = false,
  onToggleSaveOffline,
}: PlayerProps) {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMobileNowPlayingOpen, setIsMobileNowPlayingOpen] = useState(false);
  const [isPiPOpen, setIsPiPOpen] = useState(false);
  const [resolvedPlaybackUrl, setResolvedPlaybackUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryCountRef = useRef(0);
  const fallbackAttemptedRef = useRef<Set<string>>(new Set());
  const prewarmedTrackIdsRef = useRef<Set<string>>(new Set());
  const loadedStreamUrlRef = useRef<string | null>(null);
  const nativeLoadedUrlRef = useRef<string | null>(null);
  const progressRef = useRef(0);
  const durationRef = useRef(0);
  const volumeRef = useRef(1);
  const repeatModeRef = useRef(repeatMode);
  const isPlayingRef = useRef(isPlaying);
  const pipWindowRef = useRef<Window | null>(null);
  const callbacksRef = useRef({ onPlayPause, onNext, onPrev, onExternalPlayingChange });

  const activeStreamUrl = resolveApiUrl(resolvedPlaybackUrl || currentTrack?.streamUrl || '');
  const usingNativeMedia3 = canUseNativeMedia3(activeStreamUrl);
  const usingNativeMedia3Ref = useRef(usingNativeMedia3);
  usingNativeMedia3Ref.current = usingNativeMedia3;

  callbacksRef.current = { onPlayPause, onNext, onPrev, onExternalPlayingChange };
  progressRef.current = progress;
  durationRef.current = duration;
  volumeRef.current = volume;
  repeatModeRef.current = repeatMode;
  isPlayingRef.current = isPlaying;

  const isDirectAudio = Boolean(activeStreamUrl);
  const supportsDocumentPiP =
    typeof window !== 'undefined' && 'documentPictureInPicture' in window && !isNativeAndroid();

  const getSourceLabel = (source?: Track['source']) => {
    switch (source) {
      case 'soundcloud':
        return 'SoundCloud';
      case 'gaana':
        return 'Gaana HD';
      case 'audius':
        return 'Audius 320k';
      case 'jamendo':
        return 'Jamendo Official';
      case 'archive':
        return 'Archive Official';
      case 'local':
        return 'Local Vault';
      default:
        return '320k Audio';
    }
  };

  // Resolve IndexedDB Blob URL first (for offline-saved & imported local files), then fall back to remote streamUrl
  useEffect(() => {
    let cancelled = false;
    if (!currentTrack) {
      setResolvedPlaybackUrl(null);
      return;
    }

    const resolveUrl = async () => {
      const offlineUrl = await resolveOfflineAudioUrl(currentTrack.id);
      if (cancelled) return;
      if (offlineUrl) {
        setResolvedPlaybackUrl(offlineUrl);
      } else {
        setResolvedPlaybackUrl(currentTrack.streamUrl || null);
      }
    };

    resolveUrl();
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.streamUrl, isOfflineSaved]);

  const attemptTrackFallback = async () => {
    if (!currentTrack || currentTrack.source === 'local' || !onReplaceTrack) {
      if (isPlaying) onNext();
      return;
    }
    const trackKey = currentTrack.id;
    if (fallbackAttemptedRef.current.has(trackKey)) {
      if (isPlaying) onNext();
      return;
    }
    fallbackAttemptedRef.current.add(trackKey);
    try {
      const replacement = await resolveTrackFallback(currentTrack.title, currentTrack.artist || '');
      if (replacement && replacement.streamUrl) {
        onReplaceTrack(
          {
            ...replacement,
            streamUrl: resolveApiUrl(replacement.streamUrl),
            previewUrl: replacement.previewUrl ? resolveApiUrl(replacement.previewUrl) : undefined,
            title: currentTrack.title,
            artist: currentTrack.artist,
            coverUrl: currentTrack.coverUrl || replacement.coverUrl,
          },
          trackKey
        );
        return;
      }
    } catch (e) {
      console.warn('Direct stream fallback lookup failed:', e);
    }
    if (isPlayingRef.current) {
      callbacksRef.current.onNext();
    }
  };

  const attemptTrackFallbackRef = useRef(attemptTrackFallback);
  attemptTrackFallbackRef.current = attemptTrackFallback;

  useEffect(() => {
    retryCountRef.current = 0;
    setProgress(0);
    setDuration(currentTrack?.duration ? currentTrack.duration / 1000 : 0);
  }, [currentTrack?.id]);

  // Immediate fallback if a non-local track somehow lacks a stream URL
  useEffect(() => {
    if (currentTrack && isPlaying && !isDirectAudio && currentTrack.source !== 'local') {
      attemptTrackFallback();
    }
  }, [currentTrack?.id, isPlaying, isDirectAudio]);

  // Pre-warm next track URL cleanly once current track reaches >= 65%
  useEffect(() => {
    if (!nextTrack?.id || !nextTrack.streamUrl || duration <= 0) return;
    if (progress / duration < 0.65) return;
    if (prewarmedTrackIdsRef.current.has(nextTrack.id)) return;
    const warmUrl = resolveApiUrl(nextTrack.streamUrl);
    if (warmUrl.startsWith('blob:') || warmUrl.includes('.m3u8') || warmUrl.includes('proto=hls')) {
      return;
    }
    prewarmedTrackIdsRef.current.add(nextTrack.id);
    if (nextTrack.streamUrl.startsWith('/api/')) {
      fetch(warmUrl, { headers: { Range: 'bytes=0-65535' } }).catch(() => {});
    } else {
      fetch(warmUrl, { mode: 'no-cors' }).catch(() => {});
    }
  }, [progress, duration, nextTrack?.id, nextTrack?.streamUrl]);

  // Watchdog: if HTML5 direct stream playback stays stuck at 0:00, recover via direct-stream fallback
  useEffect(() => {
    if (!currentTrack || !isPlaying || !isDirectAudio || usingNativeMedia3 || currentTrack.source === 'local') return;
    const timer = setTimeout(() => {
      const audio = audioRef.current;
      if (audio && audio.currentTime === 0 && (audio.readyState < 2 || audio.paused)) {
        attemptTrackFallback();
      }
    }, 7500);
    return () => clearTimeout(timer);
  }, [currentTrack?.id, isPlaying, isDirectAudio, usingNativeMedia3]);

  // Maintain uninterrupted native web background audio across tab switches, screen lock & network reconnects
  useEffect(() => {
    if (usingNativeMedia3) return;

    const handleBackgroundState = () => {
      if (isPlaying && isDirectAudio && audioRef.current && audioRef.current.paused && audioRef.current.readyState >= 2 && !audioRef.current.ended) {
        audioRef.current.play().catch(() => {});
      }
    };

    const handleOnlineRecovery = () => {
      const audio = audioRef.current;
      if (isPlaying && isDirectAudio && audio && (audio.paused || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE)) {
        const resumeAt = audio.currentTime || progressRef.current || 0;
        audio.load();
        if (resumeAt > 0) audio.currentTime = resumeAt;
        audio.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleBackgroundState);
    window.addEventListener('focus', handleBackgroundState);
    window.addEventListener('blur', handleBackgroundState);
    window.addEventListener('online', handleOnlineRecovery);
    return () => {
      document.removeEventListener('visibilitychange', handleBackgroundState);
      window.removeEventListener('focus', handleBackgroundState);
      window.removeEventListener('blur', handleBackgroundState);
      window.removeEventListener('online', handleOnlineRecovery);
    };
  }, [isPlaying, isDirectAudio, usingNativeMedia3]);

  // Periodic heartbeat ensuring background HTML5 audio never silently drops on web/PWA
  useEffect(() => {
    if (!isPlaying || !isDirectAudio || usingNativeMedia3) return;
    const heartbeat = setInterval(() => {
      if (audioRef.current && audioRef.current.paused && audioRef.current.readyState >= 2 && !audioRef.current.ended) {
        audioRef.current.play().catch(() => {});
      }
    }, 1000);
    return () => clearInterval(heartbeat);
  }, [isPlaying, isDirectAudio, usingNativeMedia3]);

  // Keep screen awake ONLY when actively displaying live synced lyrics or expanded mobile now-playing
  useEffect(() => {
    const shouldLock = isPlaying && (rightSidebarView === 'lyrics' || isMobileNowPlayingOpen);
    if (!shouldLock || !('wakeLock' in navigator)) return;

    let wakeLockSentinel: { release: () => Promise<void> } | null = null;
    let released = false;

    const requestLock = async () => {
      try {
        const wl = (navigator as unknown as { wakeLock: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        const sentinel = await wl.request('screen');
        if (released) {
          await sentinel.release().catch(() => {});
        } else {
          wakeLockSentinel = sentinel;
        }
      } catch {
        // Ignore unsupported iframe or low-battery wakeLock rejections cleanly
      }
    };

    requestLock();
    return () => {
      released = true;
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, [isPlaying, rightSidebarView, isMobileNowPlayingOpen]);

  // Background Media Session Integration for Web / PWA Lock Screen & Notification controls
  useEffect(() => {
    if (usingNativeMedia3) return;
    if ('mediaSession' in navigator && currentTrack) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album || 'Single',
          artwork: [
            { src: currentTrack.coverUrl || '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: currentTrack.coverUrl || '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          ],
        });

        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

        navigator.mediaSession.setActionHandler('play', () => {
          if (audioRef.current && audioRef.current.paused) {
            audioRef.current.play().catch(() => {});
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
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
          }
          if (isPlaying) {
            onPlayPause();
          }
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => onPrev());
        navigator.mediaSession.setActionHandler('nexttrack', () => onNext());

        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime != null && audioRef.current) {
            audioRef.current.currentTime = details.seekTime;
            setProgress(details.seekTime);
            window.dispatchEvent(new CustomEvent('playerProgress', { detail: details.seekTime }));
          }
        });

        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const skip = details.seekOffset || 10;
          const cur = audioRef.current ? audioRef.current.currentTime : progressRef.current;
          const newTime = Math.max(cur - skip, 0);
          if (audioRef.current) audioRef.current.currentTime = newTime;
          setProgress(newTime);
        });

        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const skip = details.seekOffset || 10;
          const cur = audioRef.current ? audioRef.current.currentTime : progressRef.current;
          const maxDur = durationRef.current || 9999;
          const newTime = Math.min(cur + skip, maxDur);
          if (audioRef.current) audioRef.current.currentTime = newTime;
          setProgress(newTime);
        });
      } catch (e) {
        console.error('MediaSession setup error:', e);
      }
    }
  }, [currentTrack?.id, onPlayPause, onNext, onPrev, isPlaying, usingNativeMedia3]);

  // Update MediaSession position state when progress changes
  useEffect(() => {
    if (usingNativeMedia3) return;
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(duration, 1),
          playbackRate: 1,
          position: Math.min(Math.max(progress, 0), duration),
        });
      } catch {
        // Ignore edge-case duration rounding errors
      }
    }
  }, [progress, duration, usingNativeMedia3]);

  // Subscribe to native Android Media3 foreground service events
  useEffect(() => {
    if (!isNativeAndroid()) return;
    let disposed = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    const bindListeners = async () => {
      try {
        const l1 = await AuraMedia3.addListener('playbackProgress', (ev) => {
          if (!usingNativeMedia3Ref.current) return;
          if (typeof ev.positionSec === 'number' && isFinite(ev.positionSec)) {
            setProgress(ev.positionSec);
            window.dispatchEvent(new CustomEvent('playerProgress', { detail: ev.positionSec }));
          }
          if (typeof ev.durationSec === 'number' && isFinite(ev.durationSec) && ev.durationSec > 0) {
            setDuration(ev.durationSec);
          }
        });
        const l2 = await AuraMedia3.addListener('playbackState', (ev) => {
          if (!usingNativeMedia3Ref.current) return;
          if (typeof ev.durationSec === 'number' && isFinite(ev.durationSec) && ev.durationSec > 0) {
            setDuration(ev.durationSec);
          }
          if (typeof ev.positionSec === 'number' && isFinite(ev.positionSec)) {
            setProgress(ev.positionSec);
          }
          if (!ev.isBuffering && ev.isPlaying !== isPlayingRef.current) {
            callbacksRef.current.onExternalPlayingChange?.(ev.isPlaying);
          }
        });
        const l3 = await AuraMedia3.addListener('playbackEnded', () => {
          if (!usingNativeMedia3Ref.current) return;
          if (repeatModeRef.current === 'one') {
            AuraMedia3.seekTo({ positionSec: 0 })
              .then(() => AuraMedia3.resume())
              .catch(() => {});
          } else {
            callbacksRef.current.onNext();
          }
        });
        const l4 = await AuraMedia3.addListener('playbackNext', () => {
          callbacksRef.current.onNext();
        });
        const l5 = await AuraMedia3.addListener('playbackPrev', () => {
          callbacksRef.current.onPrev();
        });
        const l6 = await AuraMedia3.addListener('playbackError', () => {
          if (!usingNativeMedia3Ref.current) return;
          attemptTrackFallbackRef.current();
        });
        const created = [l1, l2, l3, l4, l5, l6];
        if (disposed) {
          created.forEach((h) => h.remove().catch(() => {}));
        } else {
          handles.push(...created);
        }
      } catch (err) {
        console.warn('AuraMedia3 listener setup failed:', err);
      }
    };

    bindListeners();
    return () => {
      disposed = true;
      handles.forEach((h) => h.remove().catch(() => {}));
    };
  }, []);

  // Native Android Media3 OR Web HTML5 Audio & HLS streaming lifecycle
  useEffect(() => {
    const audio = audioRef.current;

    if (usingNativeMedia3 && activeStreamUrl && currentTrack) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      loadedStreamUrlRef.current = null;
      if (audio && !audio.paused) {
        audio.pause();
      }

      const isHls = activeStreamUrl.includes('.m3u8') || activeStreamUrl.includes('proto=hls');
      if (nativeLoadedUrlRef.current !== activeStreamUrl) {
        nativeLoadedUrlRef.current = activeStreamUrl;
        setProgress(0);
        AuraMedia3.playTrack({
          url: activeStreamUrl,
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album || 'Single',
          coverUrl: currentTrack.coverUrl || '',
          isHls,
        })
          .then(() => AuraMedia3.setVolume({ volume: volumeRef.current }))
          .then(() => {
            if (!isPlayingRef.current) {
              return AuraMedia3.pause();
            }
          })
          .catch((err) => {
            console.warn('Native Media3 playTrack failed:', err);
          });
      } else {
        if (isPlaying) {
          AuraMedia3.resume().catch(() => {});
        } else {
          AuraMedia3.pause().catch(() => {});
        }
      }
      return;
    }

    if (nativeLoadedUrlRef.current !== null) {
      nativeLoadedUrlRef.current = null;
      if (isNativeAndroid()) {
        AuraMedia3.stop().catch(() => {});
      }
    }

    if (!audio) return;

    if (isDirectAudio && activeStreamUrl) {
      audio.loop = false;
      const isHls = activeStreamUrl.includes('.m3u8') || activeStreamUrl.includes('proto=hls');

      if (isHls && Hls.isSupported() && !audio.canPlayType('application/vnd.apple.mpegurl')) {
        if (!hlsRef.current || (hlsRef.current as unknown as { url: string }).url !== activeStreamUrl) {
          if (hlsRef.current) {
            hlsRef.current.destroy();
          }
          const hls = new Hls({
            enableWorker: false,
            lowLatencyMode: false,
            maxBufferLength: 180,
            maxMaxBufferLength: 360,
            backBufferLength: 30,
          });
          hls.loadSource(activeStreamUrl);
          hls.attachMedia(audio);
          (hls as unknown as { url: string }).url = activeStreamUrl;
          loadedStreamUrlRef.current = activeStreamUrl;
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            audio.volume = volume;
            if (isPlaying) {
              audio.play().catch((e) => console.warn('HLS play error:', e));
            }
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retryCountRef.current < 2) {
                retryCountRef.current += 1;
                hls.startLoad();
              } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retryCountRef.current < 2) {
                retryCountRef.current += 1;
                hls.recoverMediaError();
              } else {
                hls.destroy();
                hlsRef.current = null;
                attemptTrackFallback();
              }
            }
          });
          hlsRef.current = hls;
        }
      } else {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        if (loadedStreamUrlRef.current !== activeStreamUrl) {
          loadedStreamUrlRef.current = activeStreamUrl;
          audio.src = activeStreamUrl;
          audio.volume = volume;
          audio.load();
          setProgress(0);
        }
      }

      if (isPlaying) {
        if (audio.paused) {
          audio.play().catch((err) => {
            console.warn('Audio play request prevented:', err);
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
      loadedStreamUrlRef.current = null;
      audio.pause();
    }
  }, [currentTrack?.id, activeStreamUrl, isPlaying, isDirectAudio, usingNativeMedia3]);

  // Listen to seeking from lyrics or external events
  useEffect(() => {
    const handleSeek = (e: Event) => {
      const time = (e as CustomEvent).detail;
      if (typeof time === 'number') {
        if (usingNativeMedia3Ref.current) {
          AuraMedia3.seekTo({ positionSec: time }).catch(() => {});
        } else if (audioRef.current) {
          audioRef.current.currentTime = time;
        }
        setProgress(time);
      }
    };
    window.addEventListener('playerSeek', handleSeek);
    return () => window.removeEventListener('playerSeek', handleSeek);
  }, []);

  // Desktop Always-on-Top Mini Controller via Document Picture-in-Picture API
  const renderPiPContent = (pipWin: Window) => {
    const doc = pipWin.document;
    doc.body.innerHTML = '';
    doc.body.style.cssText =
      'margin:0;background:#121212;color:#fff;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:space-between;padding:14px;gap:12px;height:100vh;box-sizing:border-box;user-select:none;';

    const left = doc.createElement('div');
    left.style.cssText = 'display:flex;align-items:center;gap:10px;min-width:0;flex:1;';

    const img = doc.createElement('img');
    img.src = currentTrack?.coverUrl || '/pwa-192x192.png';
    img.style.cssText = 'width:48px;height:48px;border-radius:8px;object-fit:cover;flex-shrink:0;';

    const meta = doc.createElement('div');
    meta.style.cssText = 'min-width:0;overflow:hidden;';

    const titleEl = doc.createElement('div');
    titleEl.textContent = currentTrack?.title || 'Aura Music';
    titleEl.style.cssText = 'font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

    const artistEl = doc.createElement('div');
    artistEl.textContent = `${currentTrack?.artist || 'Select a track'} · ${getSourceLabel(currentTrack?.source)}`;
    artistEl.style.cssText = 'font-size:11px;color:#b3b3b3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;';

    meta.appendChild(titleEl);
    meta.appendChild(artistEl);
    left.appendChild(img);
    left.appendChild(meta);

    const controls = doc.createElement('div');
    controls.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';

    const mkBtn = (label: string, primary: boolean, onClick: () => void) => {
      const btn = doc.createElement('button');
      btn.textContent = label;
      btn.style.cssText = primary
        ? 'width:36px;height:36px;border-radius:9999px;border:none;background:#1db954;color:#000;font-weight:800;font-size:13px;cursor:pointer;'
        : 'width:30px;height:30px;border-radius:9999px;border:1px solid rgba(255,255,255,0.15);background:#242424;color:#fff;font-size:11px;cursor:pointer;';
      btn.addEventListener('click', onClick);
      return btn;
    };

    controls.appendChild(mkBtn('Prev', false, () => callbacksRef.current.onPrev()));
    controls.appendChild(mkBtn(isPlaying ? 'Pause' : 'Play', true, () => callbacksRef.current.onPlayPause()));
    controls.appendChild(mkBtn('Next', false, () => callbacksRef.current.onNext()));

    doc.body.appendChild(left);
    doc.body.appendChild(controls);
  };

  useEffect(() => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      renderPiPContent(pipWindowRef.current);
    }
  }, [currentTrack?.id, isPlaying]);

  const handleToggleDocumentPiP = async () => {
    if (!supportsDocumentPiP) return;
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
      setIsPiPOpen(false);
      return;
    }
    try {
      const api = (window as unknown as { documentPictureInPicture: DocumentPiPWindowApi }).documentPictureInPicture;
      const pipWin = await api.requestWindow({ width: 380, height: 112 });
      pipWindowRef.current = pipWin;
      setIsPiPOpen(true);
      renderPiPContent(pipWin);
      pipWin.addEventListener('pagehide', () => {
        pipWindowRef.current = null;
        setIsPiPOpen(false);
      });
    } catch {
      // Gracefully ignore when iframe sandbox restricts Document PiP
      setIsPiPOpen(false);
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (usingNativeMedia3Ref.current) {
      AuraMedia3.seekTo({ positionSec: time }).catch(() => {});
    } else if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setProgress(time);
    window.dispatchEvent(new CustomEvent('playerProgress', { detail: time }));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    if (usingNativeMedia3Ref.current) {
      AuraMedia3.setVolume({ volume: vol }).catch(() => {});
    } else if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const sourceLabel = getSourceLabel(currentTrack?.source);
  const canOfflineSave = canSaveTrackOffline(currentTrack);

  return (
    <>
      {/* Native HTML5 Audio: Strictly Direct Background MP3/AAC/HLS/Blob Playback */}
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        onCanPlay={() => {
          if (isPlaying && isDirectAudio && !usingNativeMedia3 && audioRef.current && audioRef.current.paused) {
            audioRef.current.play().catch(() => {});
          }
        }}
        onTimeUpdate={() => {
          if (audioRef.current && isDirectAudio && !usingNativeMedia3) {
            const t = audioRef.current.currentTime;
            const d = audioRef.current.duration;
            if (!isNaN(t)) setProgress(t);
            if (!isNaN(d) && isFinite(d) && d > 0) setDuration(d);
            window.dispatchEvent(new CustomEvent('playerProgress', { detail: t }));
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && isDirectAudio && !usingNativeMedia3) {
            const d = audioRef.current.duration;
            if (!isNaN(d) && isFinite(d) && d > 0) setDuration(d);
          }
        }}
        onPlay={() => {
          if (!usingNativeMedia3 && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
        }}
        onPause={() => {
          if (isPlaying && isDirectAudio && !usingNativeMedia3 && document.hidden && audioRef.current && !audioRef.current.ended) {
            setTimeout(() => {
              audioRef.current?.play().catch(() => {});
            }, 50);
          }
        }}
        onStalled={() => {
          if (isPlaying && isDirectAudio && !usingNativeMedia3 && audioRef.current && !audioRef.current.ended) {
            audioRef.current.play().catch(() => {});
          }
        }}
        onEnded={() => {
          if (isDirectAudio && !usingNativeMedia3) {
            const curr = audioRef.current?.currentTime || 0;
            const dur = audioRef.current?.duration || duration || 0;
            if (dur > 0 && curr < dur - 3) {
              if (audioRef.current) {
                audioRef.current.play().catch(() => {});
              }
            } else if (repeatMode === 'one' && audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {});
            } else {
              onNext();
            }
          }
        }}
        onError={() => {
          if (isDirectAudio && !usingNativeMedia3 && audioRef.current && currentTrack?.source !== 'local') {
            const currentSrc = loadedStreamUrlRef.current || audioRef.current.src;
            const savedTime = audioRef.current.currentTime || 0;

            let nextSrc = currentSrc;
            if (currentSrc.includes('_320.')) {
              nextSrc = currentSrc.replace('_320.', '_160.');
            } else if (currentSrc.includes('_160.')) {
              nextSrc = currentSrc.replace('_160.', '_96.');
            }

            const maxRetries = nextSrc !== currentSrc ? 3 : 1;
            if (retryCountRef.current < maxRetries) {
              retryCountRef.current += 1;
              setTimeout(() => {
                if (audioRef.current) {
                  if (nextSrc !== currentSrc) {
                    loadedStreamUrlRef.current = nextSrc;
                    audioRef.current.src = nextSrc;
                  }
                  audioRef.current.load();
                  if (savedTime > 0) {
                    audioRef.current.currentTime = savedTime;
                  }
                  audioRef.current.play().catch(() => {});
                }
              }, 500);
              return;
            }

            const dur = audioRef.current.duration || duration || 0;
            if (dur > 0 && savedTime >= dur - 5) {
              onNext();
            } else {
              attemptTrackFallback();
            }
          }
        }}
      />

      {/* Floating Mobile Mini-Player (md:hidden) */}
      {currentTrack && (
        <div
          onClick={() => setIsMobileNowPlayingOpen(true)}
          className="fixed bottom-[68px] left-2.5 right-2.5 z-40 bg-[#1D1F27]/95 backdrop-blur-xl hover:bg-[#252833] rounded-2xl h-[60px] flex items-center justify-between px-3 shadow-[0_12px_32px_rgba(0,0,0,0.75)] md:hidden cursor-pointer border border-white/[0.08] active:scale-[0.99] transition-transform select-none"
        >
          {/* Left: Thumbnail & Song Info */}
          <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 pr-2">
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-xl object-cover shadow flex-shrink-0"
            />
            <div className="truncate flex-1 min-w-0">
              <h4 className="text-xs font-bold text-white truncate">{currentTrack.title}</h4>
              <p className="text-[11px] text-white/60 truncate mt-0.5">{currentTrack.artist}</p>
            </div>
          </div>

          {/* Right: Accessible 44x44px Mobile Actions */}
          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onToggleLike}
              className="w-11 h-11 flex items-center justify-center rounded-full text-white/75 active:scale-90 transition"
              aria-label="Like song"
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#F43F5E] text-[#F43F5E]' : 'hover:text-white'}`} />
            </button>
            <button
              onClick={onPlayPause}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-[#F43F5E] text-white active:scale-90 transition shadow-md shadow-rose-500/25"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>
          </div>

          {/* Bottom Scrub Progress Line */}
          <div className="absolute bottom-0 left-2 right-2 h-[2.5px] bg-white/10 rounded-b-2xl overflow-hidden">
            <div
              className="h-full bg-[#FACC15] rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (progress / (duration || 1)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Full-Screen Mobile Now Playing View */}
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
      <div className="hidden md:flex h-[90px] bg-[#0D0E12] border-t border-white/[0.07] items-center justify-between px-4 z-50 text-white select-none">
        {/* Track Info */}
        <div className="w-[30%] min-w-[200px] flex items-center gap-3.5">
          {currentTrack ? (
            <>
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-xl shadow-lg object-cover flex-shrink-0"
              />
              <div className="overflow-hidden flex flex-col justify-center min-w-0">
                <h4 className="text-sm font-bold truncate hover:underline cursor-pointer text-white">{currentTrack.title}</h4>
                <p className="text-[11px] text-white/60 truncate">
                  {currentTrack.artist} · <span className="text-[#FACC15] font-semibold">{sourceLabel}</span>
                </p>
              </div>
              <button
                onClick={onToggleLike}
                className="text-white/60 hover:text-white ml-1 transition cursor-pointer flex-shrink-0"
                title={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                aria-label="Toggle like"
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#F43F5E] text-[#F43F5E]' : ''}`} />
              </button>
              {canOfflineSave && onToggleSaveOffline && currentTrack.source !== 'local' && (
                <button
                  onClick={() => onToggleSaveOffline(currentTrack)}
                  disabled={isSavingOffline}
                  className={`transition cursor-pointer flex-shrink-0 ${
                    isOfflineSaved ? 'text-[#FACC15]' : 'text-white/60 hover:text-white'
                  }`}
                  title={isOfflineSaved ? 'Saved offline in device vault (click to remove)' : 'Save offline for zero-internet playback'}
                  aria-label="Toggle offline save"
                >
                  {isSavingOffline ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#FACC15]" />
                  ) : isOfflineSaved ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </button>
              )}
            </>
          ) : (
            <div className="text-xs text-white/45 font-medium">Select an official song to begin background playback</div>
          )}
        </div>

        {/* Controls */}
        <div className="flex-1 max-w-[722px] flex flex-col items-center gap-2">
          <div className="flex items-center gap-6">
            <button
              onClick={onToggleShuffle}
              className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition relative cursor-pointer ${isShuffle ? 'text-[#FACC15]' : 'text-white/60 hover:text-white'}`}
              aria-label="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
              {isShuffle && <div className="absolute -bottom-1 w-1 h-1 bg-[#FACC15] rounded-full"></div>}
            </button>
            <button onClick={onPrev} className="text-white/70 hover:text-white transition cursor-pointer" aria-label="Previous track">
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button
              onClick={onPlayPause}
              className="w-9 h-9 rounded-full bg-[#F43F5E] hover:bg-[#FB7185] text-white flex items-center justify-center hover:scale-105 transition transform cursor-pointer shadow-lg shadow-rose-500/25"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <button onClick={onNext} className="text-white/70 hover:text-white transition cursor-pointer" aria-label="Next track">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
            <button
              onClick={onToggleRepeat}
              className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition relative cursor-pointer ${repeatMode !== 'off' ? 'text-[#FACC15]' : 'text-white/60 hover:text-white'}`}
              aria-label="Repeat"
            >
              <Repeat className="w-4 h-4" />
              {repeatMode === 'one' && <span className="absolute text-[8px] font-bold bg-[#181A22] rounded-full w-3 h-3 flex items-center justify-center right-[5px] top-[14px]">1</span>}
              {repeatMode !== 'off' && <div className="absolute -bottom-1 w-1 h-1 bg-[#FACC15] rounded-full"></div>}
            </button>
          </div>
          <div className="flex items-center gap-2 w-full max-w-md text-[11px] text-white/55 font-medium group tabular-nums">
            <span className="w-10 text-right">{formatTime(progress)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={progress}
              onChange={handleSeekChange}
              aria-label="Seek progress"
              className="flex-1 h-1 bg-white/15 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#FACC15] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow hover:[&::-webkit-slider-thumb]:scale-110 [&::-webkit-slider-thumb]:opacity-0 group-hover:[&::-webkit-slider-thumb]:opacity-100 transition-all"
              style={{
                background: `linear-gradient(to right, ${currentTrack ? '#FACC15' : '#4b5563'} ${(progress / (duration || 1)) * 100}%, rgba(255,255,255,0.16) ${(progress / (duration || 1)) * 100}%)`,
              }}
            />
            <span className="w-10 text-left">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Extras / PiP / Volume */}
        <div className="w-[30%] min-w-[200px] flex items-center justify-end gap-1 text-white/60">
          <button
            onClick={() => onToggleRightSidebar('lyrics')}
            className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition relative cursor-pointer ${rightSidebarView === 'lyrics' ? 'text-[#FACC15]' : 'hover:text-white'}`}
            title="Synchronized Lyrics"
            aria-label="Toggle lyrics"
          >
            <Mic2 className="w-4 h-4" />
            {rightSidebarView === 'lyrics' && <div className="absolute -bottom-1 w-1 h-1 bg-[#FACC15] rounded-full"></div>}
          </button>
          <button
            onClick={() => onToggleRightSidebar('queue')}
            className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition relative cursor-pointer ${rightSidebarView === 'queue' ? 'text-[#FACC15]' : 'hover:text-white'}`}
            title="Play Queue"
            aria-label="Toggle queue"
          >
            <ListMusic className="w-4 h-4" />
            {rightSidebarView === 'queue' && <div className="absolute -bottom-1 w-1 h-1 bg-[#FACC15] rounded-full"></div>}
          </button>
          {supportsDocumentPiP && (
            <button
              onClick={handleToggleDocumentPiP}
              className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition cursor-pointer ${isPiPOpen ? 'text-[#FACC15]' : 'hover:text-white'}`}
              title="Open Floating Mini Controller"
              aria-label="Toggle floating mini player"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>
          )}
          <div className="w-8 h-8 flex items-center justify-center" title="Direct Background Audio Active">
            <MonitorSpeaker className="w-4 h-4 text-[#FACC15]" />
          </div>
          <Volume2 className="w-5 h-5 hover:text-white cursor-pointer transition ml-1 flex-shrink-0" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            aria-label="Volume"
            className="w-[88px] h-1 bg-white/15 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-110 [&::-webkit-slider-thumb]:opacity-0 hover:[&::-webkit-slider-thumb]:opacity-100 transition-all group"
            style={{
              background: `linear-gradient(to right, #fff ${volume * 100}%, rgba(255,255,255,0.16) ${volume * 100}%)`,
            }}
          />
        </div>
      </div>
    </>
  );
}
