import React from 'react';
import { Home, Search, Library } from 'lucide-react';

interface MobileBottomNavProps {
  currentView: string;
  onViewChange: (view: 'home' | 'search' | 'library' | 'viral' | 'artists') => void;
  onOpenSearch?: () => void;
}

export default function MobileBottomNav({
  currentView,
  onViewChange,
  onOpenSearch,
}: MobileBottomNavProps) {
  const tabs = [
    {
      id: 'home' as const,
      label: 'Home',
      icon: Home,
      isActive: currentView === 'home' || currentView === 'viral' || currentView === 'charts',
      onClick: () => onViewChange('home'),
    },
    {
      id: 'search' as const,
      label: 'Search',
      icon: Search,
      isActive: currentView === 'search' || currentView === 'artists' || currentView === 'artist',
      onClick: () => {
        onViewChange('search');
        onOpenSearch?.();
      },
    },
    {
      id: 'library' as const,
      label: 'Library',
      icon: Library,
      isActive: currentView === 'library' || currentView === 'playlist',
      onClick: () => onViewChange('library'),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#13141A]/95 backdrop-blur-xl border-t border-white/[0.08] min-h-[64px] pb-safe flex items-center justify-around px-6 select-none md:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={tab.onClick}
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] py-1.5 transition-colors cursor-pointer ${
              tab.isActive ? 'text-[#FACC15]' : 'text-white/50 hover:text-white/85'
            }`}
            aria-label={tab.label}
          >
            <Icon
              className={`w-[22px] h-[22px] transition-transform ${
                tab.isActive ? 'scale-105 stroke-[2.25px]' : 'stroke-[1.75px]'
              }`}
            />
            <span
              className={`text-[11px] tracking-tight mt-1 ${
                tab.isActive ? 'font-bold text-[#FACC15]' : 'font-medium text-white/55'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
