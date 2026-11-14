import React from 'react';
import { Play } from 'lucide-react';
import { Artist } from '../../types';
import { ECHO_COVERS } from '../echoCovers';

interface ArtistCardProps {
  artist: Artist;
  onClick: () => void;
  showGenre?: boolean;
  className?: string;
}

export default function ArtistCard({
  artist,
  onClick,
  showGenre = false,
  className = '',
}: ArtistCardProps) {
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
      className={`cursor-pointer flex flex-col items-center text-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-md ${className}`}
    >
      <div className="relative mb-2 w-full aspect-square">
        <img
          src={artist.avatarUrl || ECHO_COVERS.indie}
          alt={artist.name}
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = ECHO_COVERS.indie;
          }}
          className="w-full h-full object-cover rounded-full bg-[#191919] group-hover:brightness-90 transition duration-300"
        />
        <div className="absolute bottom-1.5 right-1.5 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 w-9 h-9 rounded-full bg-white text-black shadow-lg flex items-center justify-center">
          <Play className="w-4 h-4 fill-current ml-0.5" />
        </div>
      </div>

      <h4 className="font-bold text-[13px] text-white truncate w-full leading-tight">{artist.name}</h4>
      {showGenre && (
        <p className="text-[11px] text-[#A3A3A3] truncate w-full mt-0.5">
          {artist.genre || 'Artist'}
        </p>
      )}
    </div>
  );
}
