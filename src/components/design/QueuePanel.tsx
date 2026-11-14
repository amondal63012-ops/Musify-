import React, { useState } from 'react';
import {
  Play,
  GripVertical,
  Trash2,
  ArrowUp,
  ArrowDown,
  ListMusic,
  X,
} from 'lucide-react';
import { Track } from '../../types';
import { ECHO_COVERS } from '../echoCovers';

interface QueuePanelProps {
  currentTrack: Track | null;
  isPlaying?: boolean;
  queue: Track[];
  onPlayTrack: (track: Track) => void;
  onReorderQueue: (fromIndex: number, toIndex: number) => void;
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
  upcomingFallback?: Track[];
}

export default function QueuePanel({
  currentTrack,
  isPlaying = false,
  queue,
  onPlayTrack,
  onReorderQueue,
  onRemoveFromQueue,
  onClearQueue,
  upcomingFallback = [],
}: QueuePanelProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (idx: number) => {
    setDragIndex(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragOverIndex !== idx) {
      setDragOverIndex(idx);
    }
  };

  const handleDrop = (targetIdx: number) => {
    if (dragIndex !== null && dragIndex !== targetIdx) {
      onReorderQueue(dragIndex, targetIdx);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="flex flex-col gap-6 select-none">
      {/* Currently Playing */}
      <div>
        <h3 className="text-xs font-semibold text-[#A3A3A3] mb-2.5">Currently Playing</h3>
        {currentTrack ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#222222] border border-white/25">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-[#111111]">
              <img
                src={currentTrack.coverUrl || ECHO_COVERS.global}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = ECHO_COVERS.global;
                }}
                className="w-full h-full object-cover"
              />
              {isPlaying && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-3.5 h-3.5 flex items-end justify-between gap-[2px]">
                    <div className="w-[3px] bg-white animate-[bounce_0.9s_infinite] h-2" />
                    <div className="w-[3px] bg-white animate-[bounce_1.1s_infinite] h-3.5" />
                    <div className="w-[3px] bg-white animate-[bounce_0.75s_infinite] h-1.5" />
                  </div>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">{currentTrack.title}</p>
              <p className="text-xs text-[#A3A3A3] truncate mt-0.5">{currentTrack.artist}</p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[#191919] border border-[#303030] text-xs text-[#737373]">
            Select any track to begin listening.
          </div>
        )}
      </div>

      {/* Playing Next (Draggable Queue) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-semibold text-[#A3A3A3]">
            Playing Next ({queue.length})
          </h3>
          {queue.length > 0 && (
            <button
              type="button"
              onClick={onClearQueue}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#A3A3A3] hover:text-white px-2.5 py-1 rounded-lg hover:bg-[#222222] transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear queue</span>
            </button>
          )}
        </div>

        {queue.length > 0 ? (
          <div className="space-y-1.5">
            {queue.map((track, idx) => {
              const isDropTarget = dragOverIndex === idx && dragIndex !== idx;
              return (
                <div
                  key={`${track.id}-q-${idx}`}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                  className={`group flex items-center gap-2.5 p-2 rounded-xl border transition-colors ${
                    isDropTarget
                      ? 'bg-[#222222] border-white'
                      : 'bg-[#191919] border-[#303030] hover:bg-[#222222]'
                  }`}
                >
                  <button
                    type="button"
                    className="p-1 text-[#737373] hover:text-white cursor-grab active:cursor-grabbing shrink-0"
                    title="Drag to reorder"
                    aria-label="Drag to reorder"
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>

                  <div
                    onClick={() => onPlayTrack(track)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#111111]">
                      <img
                        src={track.coverUrl || ECHO_COVERS.global}
                        alt={track.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = ECHO_COVERS.global;
                        }}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-3.5 h-3.5 text-white fill-current ml-0.5" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-white truncate">{track.title}</p>
                      <p className="text-[11px] text-[#A3A3A3] truncate">{track.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onReorderQueue(idx, idx - 1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#737373] hover:text-white hover:bg-[#303030]/60 disabled:opacity-25 cursor-pointer"
                      aria-label="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === queue.length - 1}
                      onClick={() => onReorderQueue(idx, idx + 1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#737373] hover:text-white hover:bg-[#303030]/60 disabled:opacity-25 cursor-pointer"
                      aria-label="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveFromQueue(idx)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#737373] hover:text-white hover:bg-[#303030]/60 cursor-pointer"
                      title="Remove from queue"
                      aria-label="Remove from queue"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-5 rounded-xl bg-[#191919] border border-[#303030] text-center flex flex-col items-center gap-2">
            <ListMusic className="w-7 h-7 text-[#737373]" />
            <p className="text-xs font-semibold text-white">Your custom queue is empty</p>
            <p className="text-[11px] text-[#737373]">Add songs from any list to queue them next.</p>
          </div>
        )}
      </div>

      {/* Auto-Up Next from active context */}
      {upcomingFallback.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[#A3A3A3] mb-2.5">
            Next From Current Mix ({upcomingFallback.length})
          </h3>
          <div className="space-y-1.5">
            {upcomingFallback.slice(0, 8).map((track, idx) => (
              <div
                key={`${track.id}-ctx-${idx}`}
                onClick={() => onPlayTrack(track)}
                className="flex items-center gap-3 p-2 rounded-xl bg-[#111111] border border-[#303030]/70 hover:bg-[#191919] cursor-pointer transition group"
              >
                <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#191919]">
                  <img
                    src={track.coverUrl || ECHO_COVERS.global}
                    alt={track.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Play className="w-3.5 h-3.5 text-white fill-current ml-0.5" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">{track.title}</p>
                  <p className="text-[11px] text-[#A3A3A3] truncate">{track.artist}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
