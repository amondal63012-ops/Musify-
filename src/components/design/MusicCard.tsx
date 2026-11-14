import React from 'react';
import { Play, Pause } from 'lucide-react';
import { ECHO_COVERS } from '../echoCovers';

interface MusicCardProps {
  title: string;
  subtitle: string;
  coverUrl?: string;
  isActive?: boolean;
  isPlaying?: boolean;
  onClick: () => void;
  badgeText?: string;
  className?: string;
}

export default function MusicCard({
  title,
  subtitle,
  coverUrl,
  isActive = false,
  isPlaying = false,
  onClick,
  badgeText,
  className = '',
}: MusicCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`cursor-pointer group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-md ${className}`}
    >
      <div className="relative mb-2 w-full aspect-square rounded-[4px] overflow-hidden bg-[#191919]">
        <img
          src={coverUrl || ECHO_COVERS.global}
          alt={title}
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = ECHO_COVERS.global;
          }}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
        />
        <div
          className={`absolute bottom-2 right-2 w-9 h-9 rounded-full bg-white text-black shadow-xl flex items-center justify-center transition-all duration-200 ${
            isActive
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0'
          }`}
        >
          {isActive && isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </div>
      </div>

      <h4 className={`font-bold text-[13px] truncate leading-tight ${isActive ? 'text-white' : 'text-white'}`}>
        {title}
      </h4>
      <p className="text-[11px] text-[#A3A3A3] line-clamp-2 leading-snug mt-0.5">
        {badgeText ? `${badgeText} · ${subtitle}` : subtitle}
      </p>
    </div>
  );
}
