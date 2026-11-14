import React from 'react';
import { Play, Bookmark, Check } from 'lucide-react';
import { ECHO_COVERS } from '../echoCovers';

interface AlbumCardProps {
  title: string;
  artist: string;
  coverUrl?: string;
  yearOrMeta?: string;
  isSaved?: boolean;
  onPlay: () => void;
  onToggleSave?: (e: React.MouseEvent) => void;
  className?: string;
}

export default function AlbumCard({
  title,
  artist,
  coverUrl,
  yearOrMeta,
  isSaved = false,
  onPlay,
  onToggleSave,
  className = '',
}: AlbumCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPlay();
        }
      }}
      className={`cursor-pointer group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-md ${className}`}
    >
      <div className="relative mb-2 w-full aspect-square rounded-[4px] overflow-hidden bg-[#191919]">
        <img
          src={coverUrl || ECHO_COVERS.nightmix}
          alt={title}
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = ECHO_COVERS.nightmix;
          }}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
        />

        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
          {onToggleSave && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(e);
              }}
              aria-label={isSaved ? 'Remove saved album' : 'Save album'}
              className="w-8 h-8 rounded-full bg-black/80 border border-[#303030] text-white flex items-center justify-center hover:bg-[#222222] transition cursor-pointer"
            >
              {isSaved ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
            </button>
          )}
          <div className="w-9 h-9 rounded-full bg-white text-black shadow-xl flex items-center justify-center">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      <h4 className="font-bold text-[13px] text-white truncate leading-tight">{title}</h4>
      <p className="text-[11px] text-[#A3A3A3] line-clamp-2 leading-snug mt-0.5">
        {yearOrMeta ? `${artist} · ${yearOrMeta}` : artist}
      </p>
    </div>
  );
}
