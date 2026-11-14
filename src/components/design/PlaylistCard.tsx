import React from 'react';
import { Play, Heart, Music } from 'lucide-react';
import { Playlist } from '../../types';

interface PlaylistCardProps {
  playlist: Playlist;
  onClick: () => void;
  className?: string;
}

export default function PlaylistCard({ playlist, onClick, className = '' }: PlaylistCardProps) {
  const coverSrc = playlist.coverUrl || playlist.tracks[0]?.coverUrl;
  const trackCount = playlist.tracks.length;

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
      <div className="relative mb-2 w-full aspect-square rounded-[4px] overflow-hidden bg-[#191919] flex items-center justify-center">
        {coverSrc ? (
          <img
            src={coverSrc}
            alt={playlist.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : playlist.isLikedSongs ? (
          <div className="w-full h-full bg-gradient-to-br from-[#2B2B2B] to-[#111111] flex items-center justify-center">
            <Heart className="w-10 h-10 text-white fill-white" />
          </div>
        ) : (
          <div className="w-full h-full bg-[#191919] flex items-center justify-center text-[#737373]">
            <Music className="w-9 h-9" />
          </div>
        )}

        <div className="absolute bottom-2 right-2 opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 w-9 h-9 rounded-full bg-white text-black shadow-xl flex items-center justify-center">
          <Play className="w-4 h-4 fill-current ml-0.5" />
        </div>
      </div>

      <h4 className="font-bold text-[13px] text-white truncate leading-tight">{playlist.name}</h4>
      <p className="text-[11px] text-[#A3A3A3] truncate mt-0.5 tabular-nums">
        {trackCount} {trackCount === 1 ? 'song' : 'songs'}
      </p>
    </div>
  );
}
