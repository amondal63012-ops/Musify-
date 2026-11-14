import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  ListMusic,
  Mic2,
  Heart,
  Download,
  CheckCircle2,
  Loader2,
  PictureInPicture2,
  Maximize2,
} from 'lucide-react';
import { Track, RepeatMode } from '../types';
import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import MobileNowPlaying from './MobileNowPlaying';
import { canSaveTrackOffline, resolveOfflineAudioUrl } from '../lib/offlineVault';
import { isNativeAndroid, resolveApiUrl } from '../lib/apiConfig';
import { resolveTrackFallback } from '../api';
import { AuraMedia3, canUseNativeMedia3 } from '../lib/nativeAudioBridge';
import { ECHO_COVERS } from './echoCovers';

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
  queue?: Track[];
  upcomingFallback?: Track[];
  onPlayTrackFromQueue?: (track: Track) => void;
  onReorderQueue?: (fromIndex: number, toIndex: number) => void;
  onRemoveFromQueue?: (index: number) => void;
  onClearQueue?: () => void;
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
  queue = [],
  upcomingFallback = [],
  onPlayTrackFromQueue,
  onReorderQueue,
  onRemoveFromQueue,
  onClearQueue,
}: PlayerProps) {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [isPiPOpen, setIsPiPOpen] = useState(false);
  const [resolvedPlaybackUrl, setResolvedPlaybackUrl] = useState<string | null>(null);
  const [hoverProgressPct, setHoverProgressPct] = useState<number | null>(null);

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

  useEffect(() => {
    if (currentTrack && isPlaying && !isDirectAudio && currentTrack.source !== 'local') {
      attemptTrackFallback();
    }
  }, [currentTrack?.id, isPlaying, isDirectAudio]);

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

  useEffect(() => {
    if (!isPlaying || !isDirectAudio || usingNativeMedia3) return;
    const heartbeat = setInterval(() => {
      if (audioRef.current && audioRef.current.paused && audioRef.current.readyState >= 2 && !audioRef.current.ended) {
        audioRef.current.play().catch(() => {});
      }
    }, 1000);
    return () => clearInterval(heartbeat);
  }, [isPlaying, isDirectAudio, usingNativeMedia3]);

  useEffect(() => {
    const shouldLock = isPlaying && (rightSidebarView === 'lyrics' || isNowPlayingOpen);
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
  }, [isPlaying, rightSidebarView, isNowPlayingOpen]);

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

  const renderPiPContent = (pipWin: Window) => {
    const doc = pipWin.document;
    doc.body.innerHTML = '';
    doc.body.style.cssText =
      'margin:0;background:#080808;color:#fff;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:space-between;padding:14px;gap:12px;height:100vh;box-sizing:border-box;user-select:none;';

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
    artistEl.style.cssText = 'font-size:11px;color:#A3A3A3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;';

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
        ? 'width:36px;height:36px;border-radius:9999px;border:none;background:#FFFFFF;color:#000000;font-weight:800;font-size:12px;cursor:pointer;'
        : 'width:32px;height:32px;border-radius:9999px;border:1px solid #303030;background:#191919;color:#FFFFFF;font-size:11px;cursor:pointer;';
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

  const applyVolume = (vol: number) => {
    setVolume(vol);
    if (usingNativeMedia3Ref.current) {
      AuraMedia3.setVolume({ volume: vol }).catch(() => {});
    } else if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyVolume(Number(e.target.value));
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const sourceLabel = getSourceLabel(currentTrack?.source);
  const canOfflineSave = canSaveTrackOffline(currentTrack);
  const barCoverUrl = currentTrack?.coverUrl || ECHO_COVERS.global;

  return (
    <>
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

      {/* Mobile Floating Glass Mini-Player Bar with Blurred Mixed Thumbnail Colors */}
      {currentTrack && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsNowPlayingOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsNowPlayingOpen(true);
            }
          }}
          aria-label={`Open Now Playing: ${currentTrack.title} by ${currentTrack.artist}`}
          className="fixed bottom-[68px] left-3 right-3 z-40 rounded-2xl h-[64px] flex items-center justify-between px-3 md:hidden cursor-pointer active:scale-[0.99] transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] select-none overflow-hidden shadow-[0_14px_38px_rgba(0,0,0,0.88)]"
        >
          {/* Dynamic Thumbnail Color-Mixture Blurred Glass Rear Backdrop */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl bg-[#090909]">
            <img
              src={barCoverUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = ECHO_COVERS.global;
              }}
              className="absolute -left-6 -top-10 w-[75%] h-[230%] object-cover object-left-top scale-125 blur-[26px] saturate-[2.0] opacity-90 transition-opacity duration-500"
            />
            <img
              src={barCoverUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = ECHO_COVERS.global;
              }}
              className="absolute -right-6 -bottom-10 w-[75%] h-[230%] object-cover object-right-bottom rotate-180 scale-125 blur-[30px] saturate-[2.1] opacity-75 mix-blend-screen transition-opacity duration-500"
            />
            <img
              src={barCoverUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = ECHO_COVERS.global;
              }}
              className="absolute inset-0 w-full h-full object-cover object-center scale-150 blur-[36px] saturate-[1.7] opacity-60"
            />
            <div className="absolute inset-0 bg-black/36 backdrop-blur-2xl" />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.15] via-white/[0.02] to-black/38 border border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" />
          </div>

          {/* Original-Color Rounded Square Artwork + Clear Title & Artist */}
          <div className="relative z-10 flex items-center gap-3 overflow-hidden flex-1 min-w-0 pr-2">
            <img
              src={barCoverUrl}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = ECHO_COVERS.global;
              }}
              className="w-11 h-11 rounded-lg object-cover shrink-0 shadow-[0_4px_14px_rgba(0,0,0,0.55)] ring-1 ring-white/15"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h4 className="text-[13px] font-semibold text-white truncate leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
                  {currentTrack.title}
                </h4>
              </div>
              <p className="text-[11px] text-white/75 truncate mt-0.5 leading-tight">
                {currentTrack.artist}
              </p>
            </div>
          </div>

          {/* Translucent Glass Controls: Favourite · Play/Pause · Next */}
          <div className="relative z-10 flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={onToggleLike}
              className="w-10 h-10 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 active:scale-90 transition cursor-pointer"
              aria-label={isLiked ? 'Remove from Favourites' : 'Save to Favourites'}
            >
              <Heart className={`w-[18px] h-[18px] ${isLiked ? 'fill-white text-white' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onPlayPause}
              className={`w-10 h-10 flex items-center justify-center rounded-full active:scale-90 transition cursor-pointer ${
                isPlaying
                  ? 'bg-white text-black shadow-md'
                  : 'bg-white/15 text-white border border-white/25 backdrop-blur-md hover:bg-white hover:text-black'
              }`}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-[18px] h-[18px] fill-current" />
              ) : (
                <Play className="w-[18px] h-[18px] fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onNext}
              className="w-10 h-10 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 active:scale-90 transition cursor-pointer"
              aria-label="Next track"
            >
              <SkipForward className="w-[18px] h-[18px] fill-current" />
            </button>
          </div>

          {/* Thin Progress Indicator */}
          <div className="absolute z-10 bottom-0 left-3 right-3 h-[2px] bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-[width] duration-200 shadow-[0_0_8px_rgba(255,255,255,0.45)]"
              style={{ width: `${Math.min(100, (progress / (duration || 1)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Expanded Full-Screen Player (Mobile & Desktop) */}
      {isNowPlayingOpen && currentTrack && (
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
          onClose={() => setIsNowPlayingOpen(false)}
          isLiked={isLiked}
          onToggleLike={onToggleLike}
          volume={volume}
          onVolumeChange={applyVolume}
          queue={queue}
          upcomingFallback={upcomingFallback}
          onPlayTrackFromQueue={onPlayTrackFromQueue}
          onReorderQueue={onReorderQueue}
          onRemoveFromQueue={onRemoveFromQueue}
          onClearQueue={onClearQueue}
          isOfflineSaved={isOfflineSaved}
          isSavingOffline={isSavingOffline}
          onToggleSaveOffline={onToggleSaveOffline}
        />
      )}

      {/* Desktop Floating Glass Music Bar with Blurred Mixed Thumbnail Colors */}
      <div className="hidden md:flex relative h-[84px] mx-3 mb-3 rounded-2xl shadow-[0_16px_44px_rgba(0,0,0,0.85)] items-center justify-between px-4 z-50 text-white select-none">
        {/* Dynamic Thumbnail Color-Mixture Blurred Glass Rear Backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl bg-[#090909]"
        >
          {currentTrack ? (
            <>
              <img
                src={barCoverUrl}
                alt=""
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = ECHO_COVERS.global;
                }}
                className="absolute -left-10 -top-12 w-[70%] h-[240%] object-cover object-left-top scale-125 blur-[36px] saturate-[2.0] opacity-90 transition-opacity duration-700"
              />
              <img
                src={barCoverUrl}
                alt=""
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = ECHO_COVERS.global;
                }}
                className="absolute -right-10 -bottom-12 w-[70%] h-[240%] object-cover object-right-bottom rotate-180 scale-125 blur-[40px] saturate-[2.1] opacity-75 mix-blend-screen transition-opacity duration-700"
              />
              <img
                src={barCoverUrl}
                alt=""
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = ECHO_COVERS.global;
                }}
                className="absolute left-[15%] -top-10 w-[70%] h-[220%] object-cover object-center scale-150 blur-[46px] saturate-[1.7] opacity-60 transition-opacity duration-700"
              />
              <div className="absolute inset-0 bg-black/36 backdrop-blur-2xl" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.14] via-white/[0.02] to-black/38 border border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" />
            </>
          ) : (
            <div className="absolute inset-0 rounded-2xl bg-[#111111]/95 backdrop-blur-xl border border-[#2A2A2A]" />
          )}
        </div>

        {/* Left: Original-Color Artwork + Track Identity + Favourite & Offline */}
        <div className="relative z-10 w-[30%] min-w-[220px] flex items-center gap-3.5">
          {currentTrack ? (
            <>
              <button
                type="button"
                onClick={() => setIsNowPlayingOpen(true)}
                className="relative group shrink-0 cursor-pointer rounded-xl overflow-hidden shadow-[0_6px_18px_rgba(0,0,0,0.55)] ring-1 ring-white/15 transition-transform duration-150 hover:scale-[1.03]"
                title="Expand Now Playing"
                aria-label="Expand Now Playing"
              >
                <img
                  src={barCoverUrl}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = ECHO_COVERS.global;
                  }}
                  className="w-13 h-13 object-cover"
                />
                <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-150">
                  <Maximize2 className="w-4 h-4 text-white" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsNowPlayingOpen(true)}
                className="overflow-hidden flex flex-col justify-center min-w-0 text-left cursor-pointer flex-1 group"
              >
                <h4 className="text-sm font-semibold truncate text-white group-hover:underline drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
                  {currentTrack.title}
                </h4>
                <p className="text-xs text-white/75 truncate mt-0.5">
                  {currentTrack.artist} · {sourceLabel}
                </p>
              </button>

              <button
                type="button"
                onClick={onToggleLike}
                className="w-9 h-9 flex items-center justify-center rounded-full text-white/75 hover:text-white hover:bg-white/15 transition cursor-pointer shrink-0 active:scale-90"
                title={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                aria-label="Toggle favourite"
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-white text-white' : ''}`} />
              </button>

              {canOfflineSave && onToggleSaveOffline && currentTrack.source !== 'local' && (
                <button
                  type="button"
                  onClick={() => onToggleSaveOffline(currentTrack)}
                  disabled={isSavingOffline}
                  className={`w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/15 transition cursor-pointer shrink-0 active:scale-90 ${
                    isOfflineSaved ? 'text-white' : 'text-white/75 hover:text-white'
                  }`}
                  title={isOfflineSaved ? 'Saved offline (click to remove)' : 'Save for offline playback'}
                  aria-label="Toggle offline save"
                >
                  {isSavingOffline ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : isOfflineSaved ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </button>
              )}
            </>
          ) : (
            <div className="text-xs text-[#A3A3A3] font-medium">
              Select a song to start listening
            </div>
          )}
        </div>

        {/* Center: Clean Frosted Glass Transport & Thin Progress Bar */}
        <div className="relative z-10 flex-1 max-w-[640px] flex flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onToggleShuffle}
              className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/15 transition relative cursor-pointer active:scale-90 ${
                isShuffle ? 'text-white bg-white/12' : 'text-white/70 hover:text-white'
              }`}
              aria-label="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
              {isShuffle && <div className="absolute -bottom-0.5 w-1 h-1 bg-white rounded-full" />}
            </button>

            <button
              type="button"
              onClick={onPrev}
              className="w-8 h-8 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 transition cursor-pointer active:scale-90"
              aria-label="Previous track"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={onPlayPause}
              className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-transform duration-150 active:scale-90 ${
                isPlaying
                  ? 'bg-white text-black shadow-md'
                  : 'bg-white/15 text-white border border-white/25 backdrop-blur-md hover:bg-white hover:text-black'
              }`}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={onNext}
              className="w-8 h-8 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 transition cursor-pointer active:scale-90"
              aria-label="Next track"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={onToggleRepeat}
              className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/15 transition relative cursor-pointer active:scale-90 ${
                repeatMode !== 'off' ? 'text-white bg-white/12' : 'text-white/70 hover:text-white'
              }`}
              aria-label="Repeat"
            >
              <Repeat className="w-4 h-4" />
              {repeatMode === 'one' && (
                <span className="absolute text-[8px] font-bold bg-white text-black rounded-full w-3 h-3 flex items-center justify-center right-0 top-0">
                  1
                </span>
              )}
              {repeatMode !== 'off' && <div className="absolute -bottom-0.5 w-1 h-1 bg-white rounded-full" />}
            </button>
          </div>

          <div className="flex items-center gap-3 w-full max-w-md text-[11px] text-white/75 font-medium group tabular-nums">
            <span className="w-10 text-right">{formatTime(progress)}</span>
            <div
              className="relative flex-1 flex items-center h-4"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
                setHoverProgressPct(pct);
              }}
              onMouseLeave={() => setHoverProgressPct(null)}
            >
              {hoverProgressPct !== null && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-[#141414]/95 backdrop-blur-md border border-white/15 text-[10px] font-semibold text-white shadow-lg whitespace-nowrap"
                  style={{ left: `${hoverProgressPct}%` }}
                >
                  {formatTime((hoverProgressPct / 100) * (duration || 0))}
                </div>
              )}
              <div className="w-full h-[3px] group-hover:h-1 bg-white/20 rounded-full overflow-hidden transition-all duration-150">
                <div
                  className="h-full bg-white rounded-full transition-[width] duration-150"
                  style={{ width: `${Math.min(100, (progress / (duration || 1)) * 100)}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={progress}
                onChange={handleSeekChange}
                aria-label="Seek progress"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow scale-0 group-hover:scale-100 transition-transform duration-150"
                style={{ left: `${Math.min(100, (progress / (duration || 1)) * 100)}%` }}
              />
            </div>
            <span className="w-10 text-left">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Lyrics · Queue · Expand · PiP · Volume */}
        <div className="relative z-10 w-[30%] min-w-[200px] flex items-center justify-end gap-1 text-white/75">
          <button
            type="button"
            onClick={() => onToggleRightSidebar('lyrics')}
            className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/15 transition relative cursor-pointer active:scale-90 ${
              rightSidebarView === 'lyrics' ? 'text-white bg-white/15' : 'hover:text-white'
            }`}
            title="Lyrics"
            aria-label="Toggle lyrics"
          >
            <Mic2 className="w-4 h-4" />
            {rightSidebarView === 'lyrics' && <div className="absolute -bottom-0.5 w-1 h-1 bg-white rounded-full" />}
          </button>
          <button
            type="button"
            onClick={() => onToggleRightSidebar('queue')}
            className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/15 transition relative cursor-pointer active:scale-90 ${
              rightSidebarView === 'queue' ? 'text-white bg-white/15' : 'hover:text-white'
            }`}
            title="Queue"
            aria-label="Toggle queue"
          >
            <ListMusic className="w-4 h-4" />
            {rightSidebarView === 'queue' && <div className="absolute -bottom-0.5 w-1 h-1 bg-white rounded-full" />}
          </button>
          {currentTrack && (
            <button
              type="button"
              onClick={() => setIsNowPlayingOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/15 hover:text-white transition cursor-pointer active:scale-90"
              title="Expand Now Playing"
              aria-label="Expand Now Playing"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
          {supportsDocumentPiP && (
            <button
              type="button"
              onClick={handleToggleDocumentPiP}
              className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/15 transition cursor-pointer active:scale-90 ${
                isPiPOpen ? 'text-white bg-white/15' : 'hover:text-white'
              }`}
              title="Floating Mini Controller"
              aria-label="Toggle floating mini player"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => applyVolume(volume > 0 ? 0 : 1)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/15 hover:text-white transition cursor-pointer ml-1 active:scale-90"
            aria-label={volume === 0 ? 'Unmute' : 'Mute'}
          >
            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="relative w-[84px] h-4 flex items-center group">
            <div className="w-full h-[3px] group-hover:h-1 bg-white/20 rounded-full overflow-hidden transition-all duration-150">
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
              onChange={handleVolumeChange}
              aria-label="Volume"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow scale-0 group-hover:scale-100 transition-transform duration-150"
              style={{ left: `${volume * 100}%` }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
