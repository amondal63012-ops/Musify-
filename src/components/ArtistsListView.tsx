import React, { useEffect, useState } from 'react';
import { Search, Play } from 'lucide-react';
import { Artist } from '../types';
import { getArtists, searchArtists } from '../api';

interface ArtistsListViewProps {
  onSelectArtist: (artistId: string) => void;
}

export default function ArtistsListView({ onSelectArtist }: ArtistsListViewProps) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getArtists().then((data) => {
      setArtists(data);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      getArtists().then((data) => {
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
    <div className="px-4 sm:px-6 pt-2 pb-36 relative z-10 select-none animate-in fade-in duration-300">
      {/* Header and Search */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="hidden md:flex text-2xl sm:text-3xl font-extrabold text-white tracking-tight items-center gap-2">
            Artists
          </h2>
          <p className="text-xs text-white/55 mt-1">Search and discover verified official artists worldwide</p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <input
            type="text"
            placeholder="Search any artist (e.g. Karan Aujla, Drake...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1D1F27] hover:bg-[#252833] border border-white/[0.08] text-white rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#F43F5E]/60 placeholder:text-white/40 transition"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-10 h-10 border-4 border-[#F43F5E] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : artists.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-white/60 text-sm">No artists found for &quot;{searchQuery}&quot;. Try another name.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {artists.map((artist) => (
            <div
              key={artist.id}
              onClick={() => onSelectArtist(artist.id)}
              className="bg-[#1D1F27] hover:bg-[#252833] active:scale-[0.98] p-4 rounded-2xl flex flex-col items-center text-center cursor-pointer transition border border-white/[0.06] group shadow-lg"
            >
              <div className="relative mb-3 w-24 h-24 sm:w-28 sm:h-28">
                <img
                  src={artist.avatarUrl}
                  alt={artist.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-full shadow-xl border-2 border-white/10 group-hover:border-[#FACC15] transition bg-white/5"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
                  }}
                />
                <div className="absolute bottom-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[#F43F5E] rounded-full p-2.5 shadow-xl hidden sm:block">
                  <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                </div>
              </div>

              <h3 className="font-bold text-sm text-white truncate w-full">{artist.name}</h3>
              <span className="text-[11px] text-[#FACC15] font-medium mt-0.5 truncate w-full">
                {artist.genre || 'Artist'}
              </span>
              <p className="text-[10px] text-white/45 mt-1 truncate w-full">{artist.monthlyListeners}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
