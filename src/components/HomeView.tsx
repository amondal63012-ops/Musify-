import React, { useEffect, useState } from 'react';
import { Play, Flame, UserCheck, ChevronRight, TrendingUp, Radio } from 'lucide-react';
import { getCharts, getViralSongs, getArtists } from '../api';
import { Track, Artist, Playlist } from '../types';

interface HomeViewProps {
  onPlayContext: (query: string) => void;
  onPlayTrackDirect?: (track: Track, contextPlaylist?: Playlist, contextTrackList?: Track[]) => void;
  onSelectArtist?: (artistId: string) => void;
  onViewAllViral?: () => void;
  onViewAllArtists?: () => void;
  activeFilter?: 'all' | 'viral' | 'charts';
}

interface ChartItem {
  id: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  tracks: Track[];
}

const FEATURED_COLLECTIONS = [
  {
    id: 'featured-global',
    title: 'Global Official Hits',
    subtitle: 'Top official publisher releases & chart anthems.',
    coverUrl: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f924?w=500&h=500&fit=crop',
    query: 'Global Top Hits Official',
  },
  {
    id: 'featured-bollywood',
    title: 'Bollywood & Hindi Top 50',
    subtitle: 'Timeless Hindi melodies and chart-toppers.',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&h=500&fit=crop',
    query: 'Bollywood Hindi Superhits',
  },
  {
    id: 'featured-punjabi',
    title: 'Punjabi Hot 20',
    subtitle: 'High-energy Punjabi bangers & official hits.',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&h=500&fit=crop',
    query: 'Punjabi Top Hits Official',
  },
  {
    id: 'featured-throwback',
    title: '90s & 2000s Throwbacks',
    subtitle: 'The songs that defined a golden era of music.',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&h=500&fit=crop',
    query: '90s 2000s Classic Hits',
  },
];

export default function HomeView({
  onPlayContext,
  onPlayTrackDirect,
  onSelectArtist,
  onViewAllViral,
  onViewAllArtists,
}: HomeViewProps) {
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [viralSongs, setViralSongs] = useState<Track[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);

  useEffect(() => {
    getCharts().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setCharts(data);
      }
    });

    getViralSongs().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setViralSongs(data);
      }
    });

    getArtists().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setArtists(data);
      }
    });
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const spotlightTrack = viralSongs[0] || null;

  return (
    <div className="px-4 sm:px-6 pt-2 pb-36 relative z-10 select-none">
      {/* Hero Greeting Header matching HOME screenshot */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-white/60 tracking-wide mb-1">{getGreeting()}</p>
          <h2 className="text-[28px] sm:text-3xl font-extrabold text-white tracking-tight leading-none">
            Hello, Aura Listener
          </h2>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-[#FACC15] font-semibold bg-[#1D1F27] border border-white/[0.07] px-3 py-1.5 rounded-full whitespace-nowrap shrink-0">
          <Radio className="w-3.5 h-3.5" />
          <span>Background Audio Active</span>
        </div>
      </div>

      {/* Quick Category Switchers */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none mb-7">
        <button
          onClick={() => onPlayContext('Global Top Hits Official')}
          className="px-4 min-h-[34px] rounded-full text-xs font-bold bg-[#F43F5E] text-white whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
        >
          Featured
        </button>
        {onViewAllViral && (
          <button
            onClick={onViewAllViral}
            className="px-4 min-h-[34px] rounded-full text-xs font-semibold bg-[#1D1F27] hover:bg-[#252833] border border-white/[0.06] text-white whitespace-nowrap shrink-0 cursor-pointer transition"
          >
            Viral Hits
          </button>
        )}
        {onViewAllArtists && (
          <button
            onClick={onViewAllArtists}
            className="px-4 min-h-[34px] rounded-full text-xs font-semibold bg-[#1D1F27] hover:bg-[#252833] border border-white/[0.06] text-white whitespace-nowrap shrink-0 cursor-pointer transition"
          >
            Artists
          </button>
        )}
        <button
          onClick={() => onPlayContext('Arijit Singh Hits')}
          className="px-4 min-h-[34px] rounded-full text-xs font-semibold bg-[#1D1F27] hover:bg-[#252833] border border-white/[0.06] text-white whitespace-nowrap shrink-0 cursor-pointer transition"
        >
          India Top 50
        </button>
      </div>

      {/* SECTION 1: Throwback / Featured Playlists (Matches HOME Screen 1 top cards) */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            {charts.length > 0 ? 'Featured & Charts' : 'Throwback'}
          </h3>
          <button
            onClick={() => onPlayContext('Global Top Hits Official')}
            className="text-xs font-semibold text-white/55 hover:text-white flex items-center gap-0.5 cursor-pointer"
          >
            See all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex overflow-x-auto gap-3.5 pb-2 scrollbar-none md:grid md:grid-cols-4 lg:grid-cols-5">
          {(charts.length > 0 ? charts : FEATURED_COLLECTIONS).map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              onClick={() => {
                if ('tracks' in item && Array.isArray(item.tracks) && item.tracks.length > 0 && onPlayTrackDirect) {
                  onPlayTrackDirect(item.tracks[0], undefined, item.tracks);
                } else if ('query' in item) {
                  onPlayContext(item.query);
                } else {
                  onPlayContext(item.title);
                }
              }}
              className="w-[164px] sm:w-[185px] md:w-auto flex-shrink-0 bg-[#1D1F27] hover:bg-[#252833] active:scale-[0.98] transition-all p-3 rounded-2xl cursor-pointer group relative border border-white/[0.06] shadow-lg"
            >
              <div className="relative mb-3 w-full aspect-square">
                <img
                  src={item.coverUrl}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-xl shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
                />
                <div className="absolute bottom-2 right-2 opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 bg-[#F43F5E] rounded-full p-2.5 shadow-xl hidden sm:flex items-center justify-center">
                  <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                </div>
              </div>
              <h4 className="font-bold text-[13px] sm:text-sm text-white mb-1 truncate">{item.title}</h4>
              <p className="text-[11px] text-white/55 line-clamp-2 leading-snug">
                {item.subtitle || 'Curated official publisher releases'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: Recently Played / Artists (Matches HOME Screen 1 bottom circular-avatar dark cards) */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">Popular Artists</h3>
          </div>
          {onViewAllArtists && (
            <button
              onClick={onViewAllArtists}
              className="text-xs font-semibold text-white/55 hover:text-white flex items-center gap-0.5 cursor-pointer"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex overflow-x-auto gap-3.5 pb-2 scrollbar-none">
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
              className="w-[138px] sm:w-[154px] flex-shrink-0 bg-[#1D1F27] hover:bg-[#252833] active:scale-[0.98] transition-all p-3.5 rounded-2xl cursor-pointer flex flex-col items-center text-center group border border-white/[0.06] shadow-lg"
            >
              <div className="relative mb-3 w-24 h-24 sm:w-28 sm:h-28">
                <img
                  src={artist.avatarUrl}
                  alt={artist.name}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
                  }}
                  className="w-full h-full object-cover rounded-full shadow-xl border-2 border-white/10 group-hover:border-[#FACC15] transition-all bg-white/5"
                />
                <div className="absolute bottom-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[#F43F5E] rounded-full p-2 shadow-lg hidden sm:flex">
                  <Play className="w-3.5 h-3.5 text-white fill-current ml-0.5" />
                </div>
              </div>
              <h4 className="font-bold text-[13px] sm:text-sm text-white truncate w-full">{artist.name}</h4>
              <p className="text-[11px] text-white/50 truncate w-full mt-0.5">Artist</p>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: Spotlight Banner + Viral Hits (Matches HOME Screen 3 gradient spotlight banner + mini strip) */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#F43F5E] fill-current" />
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">Viral Hits &amp; Trending</h3>
          </div>
          {onViewAllViral && (
            <button
              onClick={onViewAllViral}
              className="text-xs font-semibold text-white/55 hover:text-white flex items-center gap-0.5 cursor-pointer"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Vibrant Multi-Tone Spotlight Card */}
        {spotlightTrack && (
          <div
            onClick={() => {
              if (onPlayTrackDirect) {
                onPlayTrackDirect(spotlightTrack, undefined, viralSongs);
              } else {
                onPlayContext(`${spotlightTrack.title} ${spotlightTrack.artist}`);
              }
            }}
            className="mb-5 rounded-2xl overflow-hidden relative bg-gradient-to-br from-[#BE123C] via-[#6B21A8] to-[#0F766E] p-4 sm:p-5 border border-white/10 shadow-2xl cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <img
                src={spotlightTrack.coverUrl}
                alt={spotlightTrack.title}
                referrerPolicy="no-referrer"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shadow-2xl border border-white/15 flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#FACC15]">
                  Spotlight · #1 Trending
                </span>
                <h4 className="text-lg sm:text-2xl font-extrabold text-white truncate mt-0.5">
                  {spotlightTrack.title}
                </h4>
                <p className="text-xs sm:text-sm text-white/80 truncate mt-0.5">
                  {spotlightTrack.artist} · Official Audio
                </p>
              </div>
              <button
                type="button"
                className="w-12 h-12 rounded-full bg-[#FACC15] text-black flex items-center justify-center shadow-xl group-hover:scale-105 transition flex-shrink-0 cursor-pointer"
                aria-label="Play top viral hit"
              >
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </button>
            </div>
          </div>
        )}

        {/* Horizontal Strip of Viral Tracks */}
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
                className="w-[148px] sm:w-[172px] md:w-auto flex-shrink-0 bg-[#1D1F27] hover:bg-[#252833] active:scale-[0.98] transition-all p-3 rounded-2xl cursor-pointer group relative border border-white/[0.06]"
              >
                <div className="relative mb-2.5 w-full aspect-square">
                  <img
                    src={song.coverUrl}
                    alt={song.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-xl shadow-[0_8px_20px_rgba(0,0,0,0.55)]"
                  />
                  <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md text-white text-[10px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 border border-white/10 tabular-nums">
                    <TrendingUp className="w-2.5 h-2.5 text-[#FACC15]" />
                    #{idx + 1}
                  </div>
                  <div className="absolute bottom-2 right-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 bg-[#F43F5E] rounded-full p-2.5 shadow-xl hidden sm:block">
                    <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                  </div>
                </div>
                <h4 className="font-bold text-xs sm:text-sm text-white mb-0.5 truncate">{song.title}</h4>
                <p className="text-[11px] text-white/55 line-clamp-1">{song.artist}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="w-[148px] h-48 bg-[#1D1F27] animate-pulse rounded-2xl flex-shrink-0" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
