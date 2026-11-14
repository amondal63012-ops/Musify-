import React from 'react';

export interface BrowseCategoryItem {
  name: string;
  query: string;
  gradient: string;
  headerGradient: string;
  imageUrl: string;
}

export const BROWSE_CATEGORIES: BrowseCategoryItem[] = [
  {
    name: 'Podcasts',
    query: 'Trending Stories Official',
    gradient: 'from-[#9333EA] to-[#6B21A8]',
    headerGradient: 'from-[#9333EA] via-[#581C87] to-[#131418]',
    imageUrl: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'New Releases',
    query: 'New Releases Official 2025',
    gradient: 'from-[#F43F5E] to-[#BE123C]',
    headerGradient: 'from-[#E11D48] via-[#881337] to-[#131418]',
    imageUrl: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'Made For You',
    query: 'Global Top Hits Official',
    gradient: 'from-[#F59E0B] to-[#D97706]',
    headerGradient: 'from-[#D97706] via-[#78350F] to-[#131418]',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f924?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'Pop',
    query: 'Pop Hits Official',
    gradient: 'from-[#14B8A6] to-[#0F766E]',
    headerGradient: 'from-[#0D9488] via-[#134E4A] to-[#131418]',
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'K-Pop',
    query: 'K-Pop Hits Official',
    gradient: 'from-[#2563EB] to-[#1E3A8A]',
    headerGradient: 'from-[#2563EB] via-[#1E3A8A] to-[#131418]',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'India',
    query: 'Bollywood Hindi Top Hits',
    gradient: 'from-[#A21CAF] to-[#701A75]',
    headerGradient: 'from-[#A21CAF] via-[#581C87] to-[#131418]',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'Rock',
    query: 'Rock Classics Official',
    gradient: 'from-[#EA580C] to-[#9A3412]',
    headerGradient: 'from-[#EA580C] via-[#7C2D12] to-[#131418]',
    imageUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'R&B',
    query: 'R&B Soul Hits Official',
    gradient: 'from-[#65A30D] to-[#365314]',
    headerGradient: 'from-[#65A30D] via-[#365314] to-[#131418]',
    imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'Hip-Hop',
    query: 'Hip Hop Punjabi Official',
    gradient: 'from-[#DC2626] to-[#7F1D1D]',
    headerGradient: 'from-[#DC2626] via-[#7F1D1D] to-[#131418]',
    imageUrl: 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'Electronic',
    query: 'Electronic Dance Official',
    gradient: 'from-[#0284C7] to-[#0C4A6E]',
    headerGradient: 'from-[#0284C7] via-[#0C4A6E] to-[#131418]',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'Workout',
    query: 'Workout Gym Beats Official',
    gradient: 'from-[#EC4899] to-[#831843]',
    headerGradient: 'from-[#EC4899] via-[#831843] to-[#131418]',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'Chill',
    query: 'Chill Acoustic Lo-Fi Official',
    gradient: 'from-[#4F46E5] to-[#312E81]',
    headerGradient: 'from-[#4F46E5] via-[#312E81] to-[#131418]',
    imageUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&auto=format&fit=crop&q=80',
  },
];

interface BrowseCategoriesProps {
  onCategoryClick: (category: BrowseCategoryItem) => void;
}

export default function BrowseCategories({ onCategoryClick }: BrowseCategoriesProps) {
  return (
    <div className="px-4 sm:px-6 pt-2 pb-28">
      <h2 className="text-base sm:text-lg font-bold text-white mb-4 tracking-tight">Browse all</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4">
        {BROWSE_CATEGORIES.map((cat) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => onCategoryClick(cat)}
            className={`bg-gradient-to-br ${cat.gradient} rounded-2xl p-3.5 h-[108px] sm:h-[124px] relative overflow-hidden cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all text-left shadow-lg border border-white/10 group`}
          >
            {/* Rotated artwork card on right matching Search screenshot */}
            <div className="absolute -bottom-2 -right-3 w-[74px] h-[74px] sm:w-[86px] sm:h-[86px] rotate-[18deg] rounded-xl overflow-hidden shadow-2xl border border-white/15 group-hover:rotate-[12deg] transition-transform">
              <img
                src={cat.imageUrl}
                alt={cat.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="relative z-10 h-full flex flex-col justify-end">
              <h3 className="text-white font-extrabold text-[15px] sm:text-base tracking-tight leading-tight drop-shadow-sm max-w-[68%]">
                {cat.name}
              </h3>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
