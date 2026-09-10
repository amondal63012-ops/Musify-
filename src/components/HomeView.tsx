import React from 'react';
import { Play } from 'lucide-react';

interface HomeViewProps {
  onPlayContext: (query: string) => void;
}

const RECENTLY_PLAYED = [
  { name: 'Liked Songs', img: 'https://misc.scdn.co/liked-songs/liked-songs-300.png' },
  { name: 'Top Hits 2026', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop' },
  { name: 'Chill Vibes', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop' },
  { name: 'Discover Weekly', img: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f924?w=300&h=300&fit=crop' },
  { name: 'Release Radar', img: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop' },
  { name: 'Daily Mix 1', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop' }
];

const MIXES = [
  { title: 'Daily Mix 1', desc: 'Drake, The Weeknd, J. Cole and more', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop' },
  { title: 'Pop Rising', desc: 'Who\'s now and next in pop.', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop' },
  { title: 'RapCaviar', desc: 'New music from Drake, Future, Travis Scott.', img: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f924?w=300&h=300&fit=crop' },
  { title: 'All Out 2010s', desc: 'The biggest songs of the 2010s.', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop' },
  { title: 'Mega Hit Mix', desc: 'A mega mix of 75 favorites from the last few years!', img: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop' }
];

const NEW_RELEASES = [
  { title: 'New Music Friday', desc: 'The very best in new music.', img: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&h=300&fit=crop' },
  { title: 'Global Top 50', desc: 'Your daily update of the most played tracks.', img: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&h=300&fit=crop' },
  { title: 'Viral 50', desc: 'Your daily update of the most viral tracks.', img: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&h=300&fit=crop' },
  { title: 'Today\'s Top Hits', desc: 'Ariana Grande is on top of the Hottest 50!', img: 'https://images.unsplash.com/photo-1504509546545-e000b4a62425?w=300&h=300&fit=crop' },
  { title: 'Are & Be', desc: 'The hottest R&B right now.', img: 'https://images.unsplash.com/photo-1516280440502-a2fc997782b7?w=300&h=300&fit=crop' }
];

export default function HomeView({ onPlayContext }: HomeViewProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="p-6 pb-24 relative z-10">
      <h2 className="text-3xl font-bold text-white mb-6 tracking-tight">{getGreeting()}</h2>
      
      {/* 6-grid recent */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-10">
        {RECENTLY_PLAYED.map((item, idx) => (
          <div 
            key={idx} 
            onClick={() => onPlayContext(item.name)}
            className="group relative h-16 bg-white/5 hover:bg-white/20 transition-colors rounded overflow-hidden flex items-center cursor-pointer"
          >
            <img src={item.img} alt={item.name} className="w-16 h-16 object-cover shadow-[4px_0_12px_rgba(0,0,0,0.2)]" />
            <div className="font-bold text-white px-4 truncate flex-1">{item.name}</div>
            <div className="absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1db954] rounded-full p-3 shadow-lg shadow-black/40 hover:scale-105">
              <Play className="w-5 h-5 text-black fill-current ml-1" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white hover:underline cursor-pointer tracking-tight">Made For You</h2>
        <span className="text-sm font-bold text-gray-400 hover:underline cursor-pointer">Show all</span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-10">
        {MIXES.map((mix, idx) => (
          <div 
            key={idx} 
            onClick={() => onPlayContext(mix.title)}
            className="bg-[#181818] hover:bg-[#282828] transition-colors p-4 rounded-xl cursor-pointer group relative"
          >
            <div className="relative mb-4 w-full aspect-square">
              <img src={mix.img} alt={mix.title} className="w-full h-full object-cover rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.5)]" />
              <div className="absolute bottom-2 right-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 bg-[#1db954] rounded-full p-3 shadow-xl hover:scale-105 hover:bg-[#1ed760]">
                <Play className="w-5 h-5 text-black fill-current ml-1" />
              </div>
            </div>
            <h3 className="font-bold text-white mb-1 truncate">{mix.title}</h3>
            <p className="text-sm text-gray-400 line-clamp-2">{mix.desc}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white hover:underline cursor-pointer tracking-tight">Your top mixes</h2>
        <span className="text-sm font-bold text-gray-400 hover:underline cursor-pointer">Show all</span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-10">
        {NEW_RELEASES.map((mix, idx) => (
          <div 
            key={idx} 
            onClick={() => onPlayContext(mix.title)}
            className="bg-[#181818] hover:bg-[#282828] transition-colors p-4 rounded-xl cursor-pointer group relative"
          >
            <div className="relative mb-4 w-full aspect-square">
              <img src={mix.img} alt={mix.title} className="w-full h-full object-cover rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.5)]" />
              <div className="absolute bottom-2 right-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 bg-[#1db954] rounded-full p-3 shadow-xl hover:scale-105 hover:bg-[#1ed760]">
                <Play className="w-5 h-5 text-black fill-current ml-1" />
              </div>
            </div>
            <h3 className="font-bold text-white mb-1 truncate">{mix.title}</h3>
            <p className="text-sm text-gray-400 line-clamp-2">{mix.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
