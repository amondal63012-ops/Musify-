import React from 'react';

interface AuraLogoProps {
  compact?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function AuraLogo({ compact = false, size = 'md' }: AuraLogoProps) {
  const boxSize =
    size === 'sm' ? 'w-7 h-7 rounded-lg' : size === 'lg' ? 'w-11 h-11 rounded-xl' : 'w-8 h-8 rounded-xl';
  const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base';

  return (
    <div className="inline-flex items-center gap-2.5 select-none whitespace-nowrap shrink-0">
      <div
        className={`${boxSize} bg-white text-black flex items-center justify-center shadow-[0_6px_18px_rgba(255,255,255,0.14)] flex-shrink-0`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="none" className={iconSize}>
          <path
            d="M4 14.5V9.5M8.5 18V6M13 19.5V4.5M17.5 16.5V7.5M21 13.5V10.5"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {!compact && (
        <span className={`font-display font-extrabold tracking-tight text-white ${textSize}`}>
          Aura Music
        </span>
      )}
    </div>
  );
}
