import React from 'react';
import {
  Play,
  Pause,
  Heart,
  Download,
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  Plus,
  ListPlus,
} from 'lucide-react';
import { Track } from '../../types';
import { canSaveTrackOffline } from '../../lib/offlineVault';
import { ECHO_COVERS } from '../echoCovers';

interface SongRowProps {
  track: Track;
  index?: number;
  isActive?: boolean;
  isPlaying?: boolean;
  isLiked?: boolean;
  isOfflineSaved?: boolean;
  isSavingOffline?: boolean;
  onPlay: () => void;
  onToggleLike?: () => void;
  onToggleSaveOffline?: () => void;
  onAddToQueue?: () => void;
  onAddToPlaylist?: () => void;
  onMoreOptions?: () => void;
  subtitleExtra?: string;
}

export function formatTrackDuration(ms: number): string {
  if (!ms || isNaN(ms)) return '0:00';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function SongRow({
  track,
  index,
  isActive = false,
  isPlaying = false,
  isLiked = false,
  isOfflineSaved = false,
  isSavingOffline = false,
  onPlay,
  onToggleLike,
  onToggleSaveOffline,
  onAddToQueue,
  onAddToPlaylist,
  onMoreOptions,
  subtitleExtra,
}: SongRowProps) {
  const showOfflineBtn = Boolean(onToggleSaveOffline && canSaveTrackOffline(track) && track.source !== 'local');

  return (
    <div
      onClick={onPlay}
      className={`group flex items-center justify-between gap-3 px-2 sm:px-3 py-2 rounded-md transition-colors cursor-pointer min-h-[56px] ${
        isActive
          ? 'bg-[#191919]'
          : 'bg-transparent hover:bg-[#191919]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {typeof index === 'number' && (
          <div className="w-6 text-center shrink-0 hidden md:flex items-center justify-center">
            <span className={`text-xs font-medium tabular-nums group-hover:hidden ${isActive ? 'text-white' : 'text-[#737373]'}`}>
              {index + 1}
            </span>
            <span className="hidden group-hover:flex text-white items-center justify-center">
              {isActive && isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              )}
            </span>
          </div>
        )}

        <div className="relative w-12 h-12 rounded-[2px] overflow-hidden shrink-0 bg-[#191919]">
          <img
            src={track.coverUrl || ECHO_COVERS.global}
            alt={track.title}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = ECHO_COVERS.global;
            }}
            className="w-full h-full object-cover"
          />
          <div
            className={`absolute inset-0 bg-black/55 flex items-center justify-center transition-opacity ${
              isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {isActive && isPlaying ? (
              <Pause className="w-4 h-4 text-white fill-current" />
            ) : (
              <Play className="w-4 h-4 text-white fill-current ml-0.5" />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-[14px] font-semibold truncate leading-tight ${isActive ? 'text-white' : 'text-white'}`}>
            {track.title}
          </p>
          <p className="text-[12px] text-[#A3A3A3] truncate mt-0.5 leading-tight">
            {track.artist}
            {subtitleExtra ? ` · ${subtitleExtra}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        {showOfflineBtn && onToggleSaveOffline && (
          <button
            type="button"
            onClick={onToggleSaveOffline}
            disabled={isSavingOffline}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer ${
              isOfflineSaved ? 'text-white' : 'text-[#737373] hover:text-white hover:bg-[#222222]'
            }`}
            title={isOfflineSaved ? 'Saved offline (click to remove)' : 'Save track offline'}
            aria-label={isOfflineSaved ? 'Remove offline copy' : 'Save track offline'}
          >
            {isSavingOffline ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : isOfflineSaved ? (
              <CheckCircle2 className="w-4 h-4 text-white" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
        )}

        {onToggleLike && (
          <button
            type="button"
            onClick={onToggleLike}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer ${
              isLiked ? 'text-white' : 'text-[#737373] hover:text-white hover:bg-[#222222]'
            }`}
            aria-label={isLiked ? 'Remove from Liked Songs' : 'Like song'}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-white text-white' : ''}`} />
          </button>
        )}

        {onAddToQueue && (
          <button
            type="button"
            onClick={onAddToQueue}
            className="hidden sm:flex w-9 h-9 rounded-full items-center justify-center text-[#737373] hover:text-white hover:bg-[#222222] transition cursor-pointer"
            title="Add to queue"
            aria-label="Add to queue"
          >
            <ListPlus className="w-4 h-4" />
          </button>
        )}

        {onAddToPlaylist && (
          <button
            type="button"
            onClick={onAddToPlaylist}
            className="hidden sm:flex w-9 h-9 rounded-full items-center justify-center text-[#737373] hover:text-white hover:bg-[#222222] transition cursor-pointer"
            title="Add to playlist"
            aria-label="Add to playlist"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        <span className="text-xs text-[#737373] w-11 text-right tabular-nums hidden md:inline">
          {formatTrackDuration(track.duration)}
        </span>

        {onMoreOptions && (
          <button
            type="button"
            onClick={onMoreOptions}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#A3A3A3] hover:text-white hover:bg-[#222222] transition cursor-pointer"
            aria-label="More options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
