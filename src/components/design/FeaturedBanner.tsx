import React from 'react';
import { Play, Pause, Shuffle } from 'lucide-react';
import { Track } from '../../types';
import { ECHO_COVERS } from '../echoCovers';

interface FeaturedBannerProps {
  track: Track;
  kicker?: string;
  description?: string;
  isPlaying?: boolean;
  onPlay: () => void;
  onShuffle?: () => void;
}

export default function FeaturedBanner({
  track,
  kicker = 'Featured Release',
  description,
  isPlaying = false,
  onPlay,
  onShuffle,
}: FeaturedBannerProps) {
  return (
    <div
      onClick={onPlay}
      className="relative overflow-hidden rounded-2xl bg-[#191919] border border-[#303030] p-5 sm:p-7 cursor-pointer group transition-colors hover:border-white/25"
    >
      {/* Subtle darkened artwork blur ambient layer (strictly monochrome contrast scrim) */}
      <img
        src={track.coverUrl || ECHO_COVERS.global}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-25 scale-125 pointer-events-none"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#080808]/95 via-[#111111]/85 to-[#080808]/80 pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-7">
        <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-xl overflow-hidden border border-[#303030] shadow-2xl shrink-0 bg-[#111111]">
          <img
            src={track.coverUrl || ECHO_COVERS.global}
            alt={track.title}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = ECHO_COVERS.global;
            }}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[#A3A3A3] mb-1.5">{kicker}</p>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight truncate">
            {track.title}
          </h2>
          <p className="text-sm text-[#A3A3A3] truncate mt-1">
            {track.artist}
            {track.album ? ` · ${track.album}` : ''}
          </p>
          {description && (
            <p className="text-xs text-[#737373] mt-2 line-clamp-1 max-w-xl">{description}</p>
          )}

          <div
            className="flex flex-wrap items-center gap-2.5 mt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onPlay}
              className="aura-btn-primary inline-flex items-center gap-2 px-5 min-h-[42px] rounded-full text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap shrink-0"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>Play Now</span>
                </>
              )}
            </button>

            {onShuffle && (
              <button
                type="button"
                onClick={onShuffle}
                className="aura-btn-secondary inline-flex items-center gap-2 px-4 min-h-[42px] rounded-full text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Shuffle Mix</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
