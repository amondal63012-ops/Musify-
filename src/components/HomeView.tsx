import React, { useEffect, useState } from 'react';
import { Play, Sparkles, Radio, Flame, UserCheck, ChevronRight, TrendingUp } from 'lucide-react';
import { getCharts, getViralSongs, getArtists } from '../api';
import { Track, Artist, Playlist } from '../types';

interface HomeViewProps {
  onPlayContext: (query: string) => void;
  onPlayTrackDirect?: (track: Track, contextPlaylist?: Playlist, contextTrackList?: Track[]) => void;
  onSelectArtist?: (artistId: string) => void;
  onViewAllViral?: () => void;
  onViewAllArtists?: () => void;
}

interface ChartItem {
  id: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  tracks: any[];
}

const RECENTLY_PLAYED = [
  { name: 'Ashke Karan Aujla', label: 'Ashke - Karan Aujla', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop' },
  { name: 'India Superhits Top 50', label: 'India Superhits Top 50', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop' },
  { name: 'Arijit Singh Hits', label: 'Arijit Singh Hits', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop' },
  { name: 'Punjabi Hot 20', label: 'Punjabi Hot 20', img: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop' },
  { name: 'Diljit Dosanjh Anthems', label: 'Diljit Dosanjh Anthems', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop' },
  { name: 'Global Top Hits English', label: 'Global Top Hits', img: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f924?w=300&h=300&fit=crop' }
];

export default function HomeView({ 
  onPlayContext, 
  onPlayTrackDirect, 
  onSelectArtist,
  onViewAllViral,
  onViewAllArtists
}: HomeViewProps) {
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [viralSongs, setViralSongs] = useState<Track[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);

  useEffect(() => {
    getCharts().then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setCharts(data);
      }
    });

    getViralSongs().then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setViralSongs(data);
      }
    });

    getArtists().then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setArtists(data);
      }
    });
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="p-4 sm:p-6 pb-36 relative z-10 select-none">
      
      {/* Header Greeting */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{getGreeting()}</h2>
          <p className="text-xs text-white/60 mt-0.5">Official publisher catalogs with continuous background &amp; lock-screen audio</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-[#1db954] font-semibold whitespace-nowrap shrink-0">
          <Radio className="w-3.5 h-3.5 text-[#1db954]" />
          <span>Background &amp; Lock Screen Audio Active</span>
        </div>
      </div>
      
      {/* Quick Launch Cards (2-column layout on mobile) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mb-8">
        {RECENTLY_PLAYED.map((item, idx) => (
          <div 
            key={idx} 
            onClick={() => onPlayContext(item.name)}
            className="group relative h-14 bg-white/5 hover:bg-white/10 active:bg-white/15 transition-all rounded-lg overflow-hidden flex items-center cursor-pointer border border-white/5"
          >
            <img src={item.img} alt={item.label} className="w-14 h-14 object-cover shadow-[4px_0_12px_rgba(0,0,0,0.2)] flex-shrink-0" />
            <div className="font-bold text-xs sm:text-sm text-white px-3 truncate flex-1">{item.label}</div>
            <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1db954] rounded-full p-2 shadow-lg hover:scale-105 hidden sm:block">
              <Play className="w-4 h-4 text-black fill-current ml-0.5" />
            </div>
          </div>
        ))}
      </div>

      {/* 1. VIRAL HITS SECTION */}
      <div className="mb-9">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Flame className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
                Viral Hits &amp; Trending
              </h2>
              <p className="text-[11px] text-white/50">Verified global publishers &amp; trending releases</p>
            </div>
          </div>
          {onViewAllViral && (
            <button 
              onClick={onViewAllViral}
              className="text-xs font-bold text-white/60 hover:text-white flex items-center gap-0.5 cursor-pointer"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {viralSongs.length > 0 ? (
          <div className="flex overflow-x-auto gap-3.5 pb-2 scrollbar-none md:grid md:grid-cols-4 lg:grid-cols-5">
            {viralSongs.map((song, idx) => (
              <div 
                key={`${song.id || 'viral'}-${idx}`} 
                onClick={() => {
                  if (onPlayTrackDirect) {
                    onPlayTrackDirect(song, undefined, viralSongs);
                  } else {
                    onPlayContext(`${song.title} ${song.artist}`);
                  }
                }}
                className="w-[145px] sm:w-[170px] md:w-auto flex-shrink-0 bg-[#181818] hover:bg-[#222222] active:bg-[#282828] transition-all p-3 rounded-xl cursor-pointer group relative border border-white/5"
              >
                <div className="relative mb-2.5 w-full aspect-square">
                  <img 
                    src={song.coverUrl} 
                    alt={song.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-lg shadow-[0_8px_20px_rgba(0,0,0,0.6)]" 
                  />
                  {/* Viral Rank Indicator */}
                  <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md text-white text-[10px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 border border-white/10 tabular-nums">
                    <TrendingUp className="w-2.5 h-2.5 text-rose-400" />
                    #{idx + 1}
                  </div>
                  {/* Floating Play Button */}
                  <div className="absolute bottom-2 right-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 bg-[#1db954] rounded-full p-2.5 shadow-xl hover:scale-105 hidden sm:block">
                    <Play className="w-4 h-4 text-black fill-current ml-0.5" />
                  </div>
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-white mb-0.5 truncate">{song.title}</h3>
                <p className="text-[11px] text-white/50 line-clamp-1">{song.artist}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="w-[145px] h-48 bg-white/5 animate-pulse rounded-xl flex-shrink-0" />
            ))}
          </div>
        )}
      </div>

      {/* 2. ARTISTS SECTION (Requested by user) */}
      <div className="mb-9">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1db954]/20 text-[#1db954] flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">Popular Artists</h2>
              <p className="text-[11px] text-white/50">Top streaming music icons & their popular hits</p>
            </div>
          </div>
          {onViewAllArtists && (
            <button 
              onClick={onViewAllArtists}
              className="text-xs font-bold text-white/60 hover:text-white flex items-center gap-0.5"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-none">
          {artists.map((artist, idx) => (
            <div 
              key={`${artist.id}-${idx}`}
              onClick={() => {
                if (onSelectArtist) {
                  onSelectArtist(artist.id);
                } else {
                  onPlayContext(artist.name);
                }
              }}
              className="w-[125px] sm:w-[145px] flex-shrink-0 flex flex-col items-center text-center p-2 rounded-xl hover:bg-white/5 active:bg-white/10 transition cursor-pointer group"
            >
              <div className="relative mb-2 w-24 h-24 sm:w-28 sm:h-28">
                <img 
                  src={artist.avatarUrl} 
                  alt={artist.name} 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
                  }}
                  className="w-full h-full object-cover rounded-full shadow-xl border-2 border-transparent group-hover:border-[#1db954] transition-all bg-white/5"
                />
                <div className="absolute bottom-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1db954] rounded-full p-2 shadow-lg hidden sm:block">
                  <Play className="w-3.5 h-3.5 text-black fill-current ml-0.5" />
                </div>
              </div>
              <h3 className="font-bold text-xs sm:text-sm text-white truncate w-full">{artist.name}</h3>
              <p className="text-[10px] text-white/50 truncate w-full mt-0.5">Artist</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3. OFFICIAL CHARTS & PLAYLISTS */}
      {charts.length > 0 && (
        <div className="mb-9">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">Top Charts & Playlists</h2>
              <p className="text-[11px] text-white/50">Official chart rankings with lossless audio</p>
            </div>
          </div>
          <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-none md:grid md:grid-cols-4 lg:grid-cols-5">
            {charts.map((chart, idx) => (
              <div 
                key={`${chart.id}-${idx}`} 
                onClick={() => {
                  if (chart.tracks && chart.tracks.length > 0 && onPlayTrackDirect) {
                    onPlayTrackDirect(chart.tracks[0], undefined, chart.tracks);
                  } else {
                    onPlayContext(chart.title);
                  }
                }}
                className="w-[145px] sm:w-[170px] md:w-auto flex-shrink-0 bg-[#181818] hover:bg-[#222222] active:bg-[#282828] transition-all p-3 rounded-xl cursor-pointer group relative border border-white/5"
              >
                <div className="relative mb-3 w-full aspect-square">
                  <img src={chart.coverUrl} alt={chart.title} className="w-full h-full object-cover rounded-lg shadow-[0_8px_20px_rgba(0,0,0,0.5)]" />
                  <div className="absolute bottom-2 right-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 bg-[#1db954] rounded-full p-2.5 shadow-xl hover:scale-105 hidden sm:block">
                    <Play className="w-4 h-4 text-black fill-current ml-0.5" />
                  </div>
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-white mb-0.5 truncate">{chart.title}</h3>
                <p className="text-[11px] text-white/50 line-clamp-1">{chart.subtitle || `${chart.tracks?.length || 20} songs`}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
