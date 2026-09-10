import React from 'react';

const CATEGORIES = [
  { name: 'Podcasts', color: 'bg-[#e13300]', query: 'podcasts' },
  { name: 'Made For You', color: 'bg-[#1e3264]', query: 'pop' },
  { name: 'New Releases', color: 'bg-[#e8115b]', query: 'new releases' },
  { name: 'Pop', color: 'bg-[#148a08]', query: 'pop' },
  { name: 'Hip-Hop', color: 'bg-[#bc5900]', query: 'hip hop' },
  { name: 'Rock', color: 'bg-[#e91429]', query: 'rock' },
  { name: 'Latin', color: 'bg-[#e1118c]', query: 'latin' },
  { name: 'Dance/Electronic', color: 'bg-[#d84000]', query: 'electronic' },
  { name: 'Mood', color: 'bg-[#e1118c]', query: 'mood' },
  { name: 'Indie', color: 'bg-[#e91429]', query: 'indie' },
  { name: 'Workout', color: 'bg-[#777777]', query: 'workout' },
  { name: 'Discover', color: 'bg-[#8d67ab]', query: 'discover' },
  { name: 'Country', color: 'bg-[#d84000]', query: 'country' },
  { name: 'R&B', color: 'bg-[#dc148c]', query: 'rnb' },
  { name: 'K-Pop', color: 'bg-[#148a08]', query: 'kpop' },
  { name: 'Chill', color: 'bg-[#d84000]', query: 'chill' },
  { name: 'Sleep', color: 'bg-[#1e3264]', query: 'sleep' },
  { name: 'Party', color: 'bg-[#537aa1]', query: 'party' },
  { name: 'Decades', color: 'bg-[#ba5d07]', query: '80s' },
  { name: 'Love', color: 'bg-[#e61e32]', query: 'love' }
];

interface BrowseCategoriesProps {
  onCategoryClick: (cat: string) => void;
}

export default function BrowseCategories({ onCategoryClick }: BrowseCategoriesProps) {
  return (
    <div className="p-6 pb-24">
      <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Browse all</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {CATEGORIES.map((cat, idx) => (
          <div 
            key={idx}
            onClick={() => onCategoryClick(cat.query)}
            className={`${cat.color} rounded-lg p-4 aspect-square relative overflow-hidden cursor-pointer hover:opacity-90 transition-opacity`}
          >
            <h3 className="text-white font-bold text-xl sm:text-2xl tracking-tight break-words max-w-[80%]">{cat.name}</h3>
            {/* Faux rotated image for categories */}
            <div className="absolute -bottom-2 -right-4 w-24 h-24 sm:w-28 sm:h-28 bg-black/20 rotate-[25deg] shadow-lg rounded shadow-black/50 backdrop-blur-sm flex items-center justify-center">
               <span className="text-white/30 font-bold text-4xl">♪</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
