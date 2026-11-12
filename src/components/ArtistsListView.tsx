import React, { useEffect, useState } from 'react';
import { Search, UserCheck, Sparkles, Play, Flame } from 'lucide-react';
import { Artist } from '../types';
import { getArtists, searchArtists } from '../api';

interface ArtistsListViewProps {
  onSelectArtist: (artistId: string) => void;
}

export default function ArtistsListView({ onSelectArtist }: ArtistsListViewProps) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Initial load of featured verified artists
  useEffect(() => {
    getArtists().then(data => {
      setArtists(data);
      setIsLoading(false);
    });
  }, []);

  // Live search for unlimited artists
  useEffect(() => {
    if (!searchQuery.trim()) {
      getArtists().then(data => {
        setArtists(data);
        setIsLoading(false);
      });
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      const results = await searchArtists(searchQuery);
      setArtists(results);
      setIsLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="p-4 sm:p-6 pb-36 relative z-10 select-none animate-in fade-in duration-300">
      
      {/* Header and Search for Unlimited Artists */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Artists
          </h1>
          <p className="text-xs text-white/50 mt-1">
            Search and discover unlimited artists from around the world
          </p>
        </div>

        {/* Search Bar for Unlimited Artists */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <input
            type="text"
            placeholder="Search any artist (e.g. Karan Aujla, Drake...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#202020] hover:bg-[#262626] focus:bg-[#262626] border border-white/10 text-white rounded-full py-2.5 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-white/40 placeholder:text-white/40 transition"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-10 h-10 border-4 border-[#1db954] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : artists.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-white/60 text-sm">No artists found for "{searchQuery}". Try another name.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {artists.map((artist) => (
            <div 
              key={artist.id}
              onClick={() => onSelectArtist(artist.id)}
              className="bg-[#181818] hover:bg-[#222222] active:bg-[#282828] p-4 rounded-2xl flex flex-col items-center text-center cursor-pointer transition border border-white/5 group shadow-lg"
            >
              <div className="relative mb-3 w-28 h-28 sm:w-32 sm:h-32">
                <img 
                  src={artist.avatarUrl} 
                  alt={artist.name} 
                  className="w-full h-full object-cover rounded-full shadow-xl border-2 border-transparent group-hover:border-[#1db954] transition bg-white/5"
                  onError={(e) => {
                    // Fallback to high-res saavn cdn artist placeholder if single image fails
                    (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80`;
                  }}
                />
                <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1db954] rounded-full p-2.5 shadow-xl hidden sm:block">
                  <Play className="w-4 h-4 text-black fill-current ml-0.5" />
                </div>
              </div>

              <h3 className="font-bold text-sm sm:text-base text-white truncate w-full flex items-center justify-center gap-1">
                {artist.name}
              </h3>
              <span className="text-[11px] text-[#1db954] font-medium mt-0.5 truncate w-full">
                {artist.genre || 'Artist'}
              </span>
              <p className="text-[10px] text-white/40 mt-1 truncate w-full">
                {artist.monthlyListeners}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
