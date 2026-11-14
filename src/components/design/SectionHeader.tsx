import React from 'react';
import { ChevronRight } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  rightSlot?: React.ReactNode;
}

export default function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  rightSlot,
}: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4 mb-3">
      <div className="min-w-0">
        <h3 className="font-display text-[19px] sm:text-xl font-extrabold text-white tracking-tight truncate">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-[#A3A3A3] mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {rightSlot}
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg text-xs font-semibold text-[#A3A3A3] hover:text-white hover:bg-[#191919] transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{actionLabel}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
