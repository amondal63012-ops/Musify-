import React from 'react';
import { Clock, TrendingUp, X } from 'lucide-react';
import { ECHO_COVERS } from './echoCovers';
import SectionHeader from './design/SectionHeader';

export interface BrowseCategoryItem {
  name: string;
  query: string;
  gradient: string;
  headerGradient: string;
  imageUrl: string;
}

export const BROWSE_CATEGORIES: BrowseCategoryItem[] = [
  {
    name: 'New Releases',
    query: 'New Releases Official 2025',
    gradient: 'from-[#222222] to-[#111111]',
    headerGradient: 'from-[#222222] via-[#111111] to-[#080808]',
    imageUrl: ECHO_COVERS.global,
  },
  {
    name: 'Made For You',
    query: 'Global Top Hits Official',
    gradient: 'from-[#1f1f1f] to-[#111111]',
    headerGradient: 'from-[#222222] via-[#111111] to-[#080808]',
    imageUrl: ECHO_COVERS.glasswave,
  },
  {
    name: 'Indie & Acoustic',
    query: 'Indie Acoustic Hits Official',
    gradient: 'from-[#222222] to-[#121212]',
    headerGradient: 'from-[#222222] via-[#111111] to-[#080808]',
    imageUrl: ECHO_COVERS.indie,
  },
  {
    name: 'Late Night',
    query: 'Chill Acoustic Lo-Fi Official',
    gradient: 'from-[#1e1e1e] to-[#0d0d0d]',
    headerGradient: 'from-[#222222] via-[#111111] to-[#080808]',
    imageUrl: ECHO_COVERS.nightmix,
  },
  {
    name: 'Pop Hits',
    query: 'Pop Hits Official',
    gradient: 'from-[#222222] to-[#111111]',
    headerGradient: 'from-[#222222] via-[#111111] to-[#080808]',
    imageUrl: ECHO_COVERS.glasswave,
  },
  {
    name: 'India Top',
    query: 'Bollywood Hindi Top Hits',
    gradient: 'from-[#202020] to-[#111111]',
    headerGradient: 'from-[#222222] via-[#111111] to-[#080808]',
    imageUrl: ECHO_COVERS.indie,
  },
  {
    name: 'Hip-Hop',
    query: 'Hip Hop Punjabi Official',
    gradient: 'from-[#222222] to-[#111111]',
    headerGradient: 'from-[#222222] via-[#111111] to-[#080808]',
    imageUrl: ECHO_COVERS.global,
  },
  {
    name: 'Electronic',
    query: 'Electronic Dance Official',
    gradient: 'from-[#1f1f1f] to-[#101010]',
    headerGradient: 'from-[#222222] via-[#111111] to-[#080808]',
    imageUrl: ECHO_COVERS.glasswave,
  },
  {
    name: 'K-Pop',
    query: 'K-Pop Hits Official',
    gradient: 'from-[#222222] to-[#111111]',
    headerGradient: 'from-[#222222] via-[#111111] to-[#080808]',
    imageUrl: ECHO_COVERS.global,
  },
  {
    name: 'Rock',
    query: 'Rock Classics Official',
    gradient: 'from-[#202020] to-[#111111]',
    headerGradient: 'from-[#222222] via-[#111111] to-[#080808]',
    imageUrl: ECHO_COVERS.nightmix,
  },
  {
    name: 'R&B & Soul',
    query: 'R&B Soul Hits Official',
    gradient: 'from-[#222222] to-[#111111]',
    headerGradient: 'from-[#222222] via-[#111111] to-[#080808]',
    imageUrl: ECHO_COVERS.indie,
  },
  {
    name: 'Workout',
    query: 'Workout Gym Beats Official',
    gradient: 'from-[#1e1e1e] to-[#0f0f0f]',
    headerGradient: 'from-[#222222] via-[#111111] to-[#080808]',
    imageUrl: ECHO_COVERS.nightmix,
  },
];

const TRENDING_SEARCHES = [
  'Arijit Singh Acoustic',
  'Karan Aujla',
  'Global Top 50',
  'Midnight Lo-Fi',
  'Punjabi Hits',
  'Electronic Chill',
];

interface BrowseCategoriesProps {
  onCategoryClick: (category: BrowseCategoryItem) => void;
  recentSearches?: string[];
  onQuickSearch?: (term: string) => void;
  onRemoveRecentSearch?: (term: string) => void;
  onClearRecentSearches?: () => void;
}

export default function BrowseCategories({
  onCategoryClick,
  recentSearches = [],
  onQuickSearch,
  onRemoveRecentSearch,
  onClearRecentSearches,
}: BrowseCategoriesProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-3 pb-40 space-y-8 select-none">
      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <section>
          <SectionHeader
            title="Recent Searches"
            actionLabel="Clear all"
            onAction={onClearRecentSearches}
          />
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term) => (
              <div
                key={term}
                className="inline-flex items-center gap-1.5 bg-[#191919] border border-[#303030] hover:bg-[#222222] rounded-full pl-3.5 pr-1.5 py-1.5 text-xs font-medium text-white transition"
              >
                <button
                  type="button"
                  onClick={() => onQuickSearch?.(term)}
                  className="inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-[#737373]" />
                  <span>{term}</span>
                </button>
                {onRemoveRecentSearch && (
                  <button
                    type="button"
                    onClick={() => onRemoveRecentSearch(term)}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[#737373] hover:text-white hover:bg-[#303030] transition cursor-pointer"
                    aria-label={`Remove ${term} from recent searches`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trending Searches */}
      <section>
        <SectionHeader title="Trending Searches" subtitle="Popular queries across Aura Music" />
        <div className="flex flex-wrap gap-2">
          {TRENDING_SEARCHES.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => onQuickSearch?.(term)}
              className="inline-flex items-center gap-2 bg-[#191919] border border-[#303030] hover:bg-[#222222] hover:border-white/25 rounded-full px-4 py-2 text-xs font-semibold text-[#A3A3A3] hover:text-white transition cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5 text-[#737373]" />
              <span>{term}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Popular Genres & Browse All Dark Monochrome Cards with Full-Color Artwork */}
      <section>
        <SectionHeader title="Browse All Categories" subtitle="Explore by genre, mood, and curation" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {BROWSE_CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => onCategoryClick(cat)}
              className={`bg-gradient-to-br ${cat.gradient} rounded-2xl p-4 h-[112px] sm:h-[124px] relative overflow-hidden cursor-pointer border border-[#303030] hover:border-white/30 hover:bg-[#222222] active:scale-[0.98] transition-all text-left group`}
            >
              <div className="absolute -bottom-2 -right-2 w-[74px] h-[74px] sm:w-[86px] sm:h-[86px] rotate-[14deg] rounded-xl overflow-hidden shadow-2xl border border-white/15 group-hover:rotate-[8deg] transition-transform duration-200 bg-[#111111]">
                <img
                  src={cat.imageUrl}
                  alt={cat.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="relative z-10 h-full flex flex-col justify-between">
                <span className="text-[11px] font-medium text-[#737373]">Category</span>
                <h3 className="text-white font-extrabold text-[15px] sm:text-base tracking-tight leading-tight max-w-[66%]">
                  {cat.name}
                </h3>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
