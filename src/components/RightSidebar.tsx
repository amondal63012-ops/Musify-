import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Play, MoreHorizontal, Mic2, Languages, Loader2 } from 'lucide-react';
import { Track } from '../types';

interface RightSidebarProps {
  view: 'queue' | 'lyrics';
  currentTrack: Track | null;
  queue: Track[];
  onClose: () => void;
  onPlayTrack: (track: Track) => void;
}

const LANGUAGES = [
  { code: '', label: 'Original' },
  { code: 'English', label: 'English' },
  { code: 'Spanish', label: 'Spanish' },
  { code: 'French', label: 'French' },
  { code: 'German', label: 'German' },
  { code: 'Japanese', label: 'Japanese' },
];

const LYRICS_GRADIENTS = [
  'from-[#8B0000] to-[#2B0000]', // Deep Red
  'from-[#006400] to-[#002200]', // Dark Green
  'from-[#00008B] to-[#00002B]', // Deep Blue
  'from-[#8B008B] to-[#2B002B]', // Magenta
  'from-[#4B0082] to-[#120024]', // Indigo
  'from-[#8B4500] to-[#2B1500]', // Burnt Orange
  'from-[#00688B] to-[#00202B]', // Deep Cyan
  'from-[#68228B] to-[#1C002B]', // Purple
];

interface LrcLine {
  time: number;
  text: string;
}

export default function RightSidebar({ view, currentTrack, queue, onClose, onPlayTrack }: RightSidebarProps) {
  const [plainLyrics, setPlainLyrics] = useState<string>('');
  const [syncedLines, setSyncedLines] = useState<LrcLine[]>([]);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<string>('');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  
  const [currentTime, setCurrentTime] = useState(0);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  const activeGradient = useMemo(() => {
    if (!currentTrack) return LYRICS_GRADIENTS[0];
    const hash = currentTrack.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return LYRICS_GRADIENTS[hash % LYRICS_GRADIENTS.length];
  }, [currentTrack]);

  // Listen to player progress
  useEffect(() => {
    const handleProgress = (e: Event) => {
      setCurrentTime((e as CustomEvent).detail);
    };
    window.addEventListener('playerProgress', handleProgress);
    return () => window.removeEventListener('playerProgress', handleProgress);
  }, []);

  // Fetch lyrics
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
      const res = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: track.title,
          artist: track.artist,
          targetLanguage: lang,
        })
      });
      const data = await res.json();
      
      if (data.syncedLyrics) {
        setSyncedLines(parseLrc(data.syncedLyrics));
      } else if (data.plainLyrics) {
        setPlainLyrics(data.plainLyrics);
      } else {
        setPlainLyrics("Lyrics unavailable");
      }
    } catch (error) {
      setPlainLyrics("Lyrics unavailable");
    } finally {
      setLoadingLyrics(false);
    }
  };

  // Find active line index
  const activeLineIndex = useMemo(() => {
    if (syncedLines.length === 0) return -1;
    // Find the last line whose time is less than or equal to current time
    for (let i = syncedLines.length - 1; i >= 0; i--) {
      if (currentTime >= syncedLines[i].time) {
        return i;
      }
    }
    return -1;
  }, [currentTime, syncedLines]);

  // Auto scroll
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
    <div className="w-[350px] bg-[#121212] border-l border-[#282828] flex flex-col h-full flex-shrink-0 relative">
      <div className={`px-4 py-4 flex items-center justify-between shrink-0 transition-colors duration-1000 ${view === 'lyrics' && currentTrack ? 'border-none' : 'border-b border-[#282828]'}`}
           style={view === 'lyrics' && currentTrack ? { background: 'transparent' } : {}}>
        <h2 className={`font-bold text-base ${view === 'lyrics' && currentTrack ? 'text-white' : 'text-white'}`}>
          {view === 'queue' ? 'Queue' : 'Lyrics'}
        </h2>
        <div className="flex items-center gap-2 relative z-10">
          {view === 'lyrics' && currentTrack && (
            <div className="relative">
              <button 
                onClick={() => setShowLanguageMenu(!showLanguageMenu)} 
                className={`text-white/70 hover:text-white transition rounded-full hover:bg-white/10 p-2 flex items-center gap-1 ${targetLanguage ? 'text-white bg-white/20' : ''}`}
                title="Translate Lyrics"
              >
                <Languages className="w-5 h-5" />
              </button>
              {showLanguageMenu && (
                <div className="absolute right-0 top-full mt-2 w-32 bg-[#282828] rounded-md shadow-xl py-1 z-50">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setTargetLanguage(lang.code);
                        setShowLanguageMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition ${targetLanguage === lang.code ? 'text-[#1db954]' : 'text-white'}`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={onClose} className={`${view === 'lyrics' && currentTrack ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-[#b3b3b3] hover:text-white hover:bg-[#2a2a2a]'} transition rounded-full p-2`}>
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {view === 'lyrics' && currentTrack && (
         <div className={`absolute inset-0 bg-gradient-to-b ${activeGradient} opacity-80 pointer-events-none transition-colors duration-1000`} />
      )}

      <div className="flex-1 overflow-y-auto relative z-0">
        {view === 'queue' && (
          <div className="p-4">
            <h3 className="text-white font-bold text-sm mb-4">Now playing</h3>
            {currentTrack ? (
              <div className="flex items-center gap-3 p-2 rounded-md bg-[#2a2a2a] group cursor-pointer mb-6">
                <div className="relative w-12 h-12 flex-shrink-0">
                  <img src={currentTrack.coverUrl} className="w-full h-full rounded shadow object-cover" alt={currentTrack.title} />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-3 h-3 flex items-end justify-between gap-[1px]">
                      <div className="w-[3px] bg-[#1db954] animate-[bounce_1s_infinite] h-2"></div>
                      <div className="w-[3px] bg-[#1db954] animate-[bounce_1.2s_infinite] h-3"></div>
                      <div className="w-[3px] bg-[#1db954] animate-[bounce_0.8s_infinite] h-1.5"></div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden flex flex-col justify-center">
                  <div className="text-sm font-semibold truncate text-[#1db954]">{currentTrack.title}</div>
                  <div className="text-xs text-[#b3b3b3] truncate">{currentTrack.artist}</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#b3b3b3] mb-6">No track playing.</p>
            )}

            <h3 className="text-white font-bold text-sm mb-4">Next up</h3>
            {queue.length > 0 ? (
              <div className="flex flex-col gap-1">
                {queue.map((track, idx) => (
                  <div key={`${track.id}-${idx}`} onClick={() => onPlayTrack(track)} className="flex items-center gap-3 p-2 rounded-md hover:bg-[#1a1a1a] group cursor-pointer transition">
                     <div className="relative w-12 h-12 flex-shrink-0">
                      <img src={track.coverUrl} className="w-full h-full rounded shadow object-cover" alt={track.title} />
                      <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center">
                        <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden flex flex-col justify-center">
                      <div className="text-sm font-semibold truncate text-white">{track.title}</div>
                      <div className="text-xs text-[#b3b3b3] truncate group-hover:text-white transition">{track.artist}</div>
                    </div>
                    <button className="text-[#b3b3b3] hover:text-white opacity-0 group-hover:opacity-100 transition">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#b3b3b3]">No tracks in queue. Add some!</p>
            )}
          </div>
        )}

        {view === 'lyrics' && (
          <div className="px-6 pb-6 pt-2 h-full overflow-y-auto relative z-10 scroll-smooth">
            {currentTrack ? (
               <div className="flex flex-col pb-32">
                 <div className="mb-8 flex flex-col gap-1">
                   <h3 className="text-white font-bold text-lg">{currentTrack.title}</h3>
                   <span className="text-white/70 text-sm font-semibold">{currentTrack.artist}</span>
                 </div>
                 
                 {loadingLyrics ? (
                   <div className="flex flex-col items-center justify-center py-20 text-white/50">
                     <Loader2 className="w-10 h-10 animate-spin mb-4" />
                     <p className="font-semibold text-lg">Generating {targetLanguage ? `${targetLanguage} ` : ''}lyrics...</p>
                   </div>
                 ) : (
                   <div className="text-white font-extrabold text-[28px] leading-[1.3] font-sans tracking-tight" ref={lyricsContainerRef}>
                     {syncedLines.length > 0 ? (
                       syncedLines.map((line, idx) => (
                         <p 
                           key={idx}
                           onClick={() => handleLineClick(line.time)}
                           className={`mb-6 cursor-pointer transition-all duration-300 transform origin-left ${idx === activeLineIndex ? 'text-white blur-none opacity-100 scale-105' : 'text-white/40 hover:text-white/70 blur-[0.5px] scale-100'}`}
                         >
                           {line.text}
                         </p>
                       ))
                     ) : (
                       <div className="whitespace-pre-wrap">{plainLyrics}</div>
                     )}
                   </div>
                 )}
                 
                 {!loadingLyrics && (syncedLines.length > 0 || plainLyrics) && (
                   <p className="text-xs font-bold mt-12 text-white/40 border border-white/20 rounded-full px-4 py-2 inline-block self-start">
                     {syncedLines.length > 0 ? 'Synced Lyrics' : 'Lyrics'}
                   </p>
                 )}
               </div>
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                 <Mic2 className="w-12 h-12 text-white/20" />
                 <p className="text-sm font-normal text-white/50">Play a song to see lyrics.</p>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
