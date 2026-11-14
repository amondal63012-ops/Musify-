import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Mic2, Languages, Loader2 } from 'lucide-react';
import { Track } from '../types';
import { tryFetchBackendJson } from '../lib/apiConfig';
import { directFetchLyrics } from '../lib/directMusicProvider';
import QueuePanel from './design/QueuePanel';

interface RightSidebarProps {
  view: 'queue' | 'lyrics';
  currentTrack: Track | null;
  isPlaying?: boolean;
  queue: Track[];
  upcomingFallback?: Track[];
  onClose: () => void;
  onPlayTrack: (track: Track) => void;
  onReorderQueue: (fromIndex: number, toIndex: number) => void;
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
}

const LANGUAGES = [
  { code: '', label: 'Original' },
  { code: 'English', label: 'English' },
  { code: 'Spanish', label: 'Spanish' },
  { code: 'French', label: 'French' },
  { code: 'German', label: 'German' },
  { code: 'Japanese', label: 'Japanese' },
];

interface LrcLine {
  time: number;
  text: string;
}

export default function RightSidebar({
  view,
  currentTrack,
  isPlaying = false,
  queue,
  upcomingFallback = [],
  onClose,
  onPlayTrack,
  onReorderQueue,
  onRemoveFromQueue,
  onClearQueue,
}: RightSidebarProps) {
  const [plainLyrics, setPlainLyrics] = useState<string>('');
  const [syncedLines, setSyncedLines] = useState<LrcLine[]>([]);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<string>('');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleProgress = (e: Event) => {
      setCurrentTime((e as CustomEvent).detail);
    };
    window.addEventListener('playerProgress', handleProgress);
    return () => window.removeEventListener('playerProgress', handleProgress);
  }, []);

  useEffect(() => {
    if (view === 'lyrics' && currentTrack) {
      fetchLyrics(currentTrack, targetLanguage);
    }
  }, [view, currentTrack, targetLanguage]);

  const parseLrc = (lrc: string): LrcLine[] => {
    const lines = lrc.split('\n');
    const parsed: LrcLine[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

    for (const line of lines) {
      const match = timeRegex.exec(line);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const milliseconds = parseInt(match[3], 10) * (match[3].length === 2 ? 10 : 1);
        const time = minutes * 60 + seconds + milliseconds / 1000;
        const text = line.replace(timeRegex, '').trim();
        if (text) {
          parsed.push({ time, text });
        }
      }
    }
    return parsed;
  };

  const fetchLyrics = async (track: Track, lang: string) => {
    setLoadingLyrics(true);
    setPlainLyrics('');
    setSyncedLines([]);
    try {
      const backendData = await tryFetchBackendJson<{ syncedLyrics?: string | null; plainLyrics?: string | null }>(
        '/api/lyrics',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: track.title,
            artist: track.artist,
            targetLanguage: lang,
          }),
        }
      );
      const data = backendData ?? (await directFetchLyrics(track.title, track.artist));

      if (data?.syncedLyrics) {
        setSyncedLines(parseLrc(data.syncedLyrics));
      } else if (data?.plainLyrics) {
        setPlainLyrics(data.plainLyrics);
      } else {
        setPlainLyrics('Lyrics unavailable for this track.');
      }
    } catch {
      setPlainLyrics('Lyrics unavailable for this track.');
    } finally {
      setLoadingLyrics(false);
    }
  };

  const activeLineIndex = useMemo(() => {
    if (syncedLines.length === 0) return -1;
    for (let i = syncedLines.length - 1; i >= 0; i--) {
      if (currentTime >= syncedLines[i].time) {
        return i;
      }
    }
    return -1;
  }, [currentTime, syncedLines]);

  useEffect(() => {
    if (activeLineIndex !== -1 && lyricsContainerRef.current) {
      const activeElement = lyricsContainerRef.current.children[activeLineIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIndex]);

  const handleLineClick = (time: number) => {
    window.dispatchEvent(new CustomEvent('playerSeek', { detail: time }));
  };

  return (
    <div className="w-[340px] bg-[#111111] border border-[#303030] rounded-2xl flex flex-col h-full flex-shrink-0 relative overflow-hidden">
      <div className="px-4 py-3.5 flex items-center justify-between shrink-0 border-b border-[#303030]">
        <h2 className="font-bold text-sm text-white">
          {view === 'queue' ? 'Playing Queue' : 'Synchronized Lyrics'}
        </h2>
        <div className="flex items-center gap-1 relative z-10">
          {view === 'lyrics' && currentTrack && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className={`text-[#A3A3A3] hover:text-white transition rounded-full hover:bg-[#222222] p-2 cursor-pointer ${
                  targetLanguage ? 'text-white bg-[#222222]' : ''
                }`}
                title="Translate Lyrics"
                aria-label="Translate Lyrics"
              >
                <Languages className="w-4 h-4" />
              </button>
              {showLanguageMenu && (
                <div className="absolute right-0 top-full mt-2 w-36 bg-[#191919] border border-[#303030] rounded-xl shadow-2xl py-1 z-50">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        setTargetLanguage(lang.code);
                        setShowLanguageMenu(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-[#222222] transition cursor-pointer ${
                        targetLanguage === lang.code ? 'text-white' : 'text-[#A3A3A3]'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-[#A3A3A3] hover:text-white hover:bg-[#222222] transition rounded-full p-2 cursor-pointer"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative z-0">
        {view === 'queue' && (
          <div className="p-4">
            <QueuePanel
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              queue={queue}
              upcomingFallback={upcomingFallback}
              onPlayTrack={onPlayTrack}
              onReorderQueue={onReorderQueue}
              onRemoveFromQueue={onRemoveFromQueue}
              onClearQueue={onClearQueue}
            />
          </div>
        )}

        {view === 'lyrics' && (
          <div className="px-5 pb-8 pt-4 h-full overflow-y-auto relative z-10 scroll-smooth">
            {currentTrack ? (
              <div className="flex flex-col pb-24">
                <div className="mb-6 flex flex-col gap-0.5 pb-4 border-b border-[#303030]">
                  <h3 className="text-white font-bold text-base truncate">{currentTrack.title}</h3>
                  <span className="text-[#A3A3A3] text-xs font-medium truncate">{currentTrack.artist}</span>
                </div>

                {loadingLyrics ? (
                  <div className="flex flex-col items-center justify-center py-20 text-[#A3A3A3]">
                    <Loader2 className="w-8 h-8 animate-spin mb-3 text-white" />
                    <p className="font-semibold text-sm">Loading {targetLanguage ? `${targetLanguage} ` : ''}lyrics...</p>
                  </div>
                ) : (
                  <div className="text-white font-bold text-xl leading-relaxed tracking-tight" ref={lyricsContainerRef}>
                    {syncedLines.length > 0 ? (
                      syncedLines.map((line, idx) => (
                        <p
                          key={idx}
                          onClick={() => handleLineClick(line.time)}
                          className={`mb-5 cursor-pointer transition-all duration-200 origin-left ${
                            idx === activeLineIndex
                              ? 'text-white scale-[1.02]'
                              : 'text-[#737373] hover:text-[#A3A3A3]'
                          }`}
                        >
                          {line.text}
                        </p>
                      ))
                    ) : (
                      <div className="whitespace-pre-wrap text-sm text-[#A3A3A3] leading-relaxed font-medium">
                        {plainLyrics}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-20">
                <Mic2 className="w-10 h-10 text-[#737373]" />
                <p className="text-xs font-medium text-[#A3A3A3]">Play any track to view lyrics.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
