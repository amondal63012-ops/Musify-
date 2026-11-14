import React, { useEffect, useState } from 'react';
import { Artist } from '../types';
import { getArtists, searchArtists } from '../api';
import SearchBar from './design/SearchBar';
import ArtistCard from './design/ArtistCard';
import LoadingSkeleton from './design/LoadingSkeleton';

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
    <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-44 relative z-10 select-none animate-in fade-in duration-200">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#A3A3A3] mb-1">Official Performers</p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Artists
          </h1>
        </div>

        <div className="w-full md:w-80">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Filter artists..."
            size="md"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton variant="artists" count={10} />
      ) : artists.length === 0 ? (
        <div className="py-20 text-center rounded-2xl bg-[#191919] border border-[#303030]">
          <p className="text-white font-semibold text-sm">No artists matched &quot;{searchQuery}&quot;</p>
          <p className="text-xs text-[#737373] mt-1">Try another artist name or clear your filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {artists.map((artist) => (
            <ArtistCard
              key={artist.id}
              artist={artist}
              showGenre
              onClick={() => onSelectArtist(artist.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
