import React from 'react';

interface LoadingSkeletonProps {
  variant?: 'cards' | 'rows' | 'hero' | 'artists';
  count?: number;
}

export default function LoadingSkeleton({ variant = 'cards', count = 6 }: LoadingSkeletonProps) {
  if (variant === 'hero') {
    return (
      <div className="w-full rounded-2xl bg-[#191919] border border-[#303030] p-5 sm:p-7 animate-pulse">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-xl bg-[#222222] shrink-0" />
          <div className="flex-1 w-full space-y-3">
            <div className="h-3 w-24 rounded bg-[#222222]" />
            <div className="h-7 w-3/4 rounded bg-[#222222]" />
            <div className="h-4 w-1/2 rounded bg-[#222222]" />
            <div className="flex gap-2.5 pt-2">
              <div className="h-10 w-28 rounded-full bg-[#222222]" />
              <div className="h-10 w-24 rounded-full bg-[#222222]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'rows') {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="h-[64px] rounded-xl bg-[#191919] border border-[#303030] p-2.5 flex items-center gap-3 animate-pulse"
          >
            <div className="w-11 h-11 rounded-lg bg-[#222222] shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/5 rounded bg-[#222222]" />
              <div className="h-3 w-1/4 rounded bg-[#222222]" />
            </div>
            <div className="h-3 w-10 rounded bg-[#222222]" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'artists') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-[#191919] border border-[#303030] p-4 flex flex-col items-center animate-pulse"
          >
            <div className="w-24 h-24 rounded-full bg-[#222222] mb-3" />
            <div className="h-3.5 w-24 rounded bg-[#222222] mb-1.5" />
            <div className="h-3 w-16 rounded bg-[#222222]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-[#191919] border border-[#303030] p-3 animate-pulse">
          <div className="aspect-square w-full rounded-xl bg-[#222222] mb-3" />
          <div className="h-3.5 w-3/4 rounded bg-[#222222] mb-1.5" />
          <div className="h-3 w-1/2 rounded bg-[#222222]" />
        </div>
      ))}
    </div>
  );
}
