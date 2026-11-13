import React from 'react';
import { Home, Search, Library, Flame, UserCheck } from 'lucide-react';

interface MobileBottomNavProps {
  currentView: string;
  onViewChange: (view: 'home' | 'search' | 'library' | 'viral' | 'artists') => void;
  onOpenSearch?: () => void;
}

export default function MobileBottomNav({
  currentView,
  onViewChange,
  onOpenSearch
}: MobileBottomNavProps) {
  const tabs = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      onClick: () => onViewChange('home')
    },
    {
      id: 'search',
      label: 'Search',
      icon: Search,
      onClick: () => {
        onViewChange('search');
        onOpenSearch?.();
      }
    },
    {
      id: 'viral',
      label: 'Viral',
      icon: Flame,
      onClick: () => onViewChange('viral')
    },
    {
      id: 'artists',
      label: 'Artists',
      icon: UserCheck,
      onClick: () => onViewChange('artists')
    },
    {
      id: 'library',
      label: 'Library',
      icon: Library,
      onClick: () => onViewChange('library')
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-xl border-t border-white/10 min-h-[62px] pb-safe flex items-center justify-around px-2 select-none md:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentView === tab.id || (tab.id === 'artists' && currentView === 'artist');

        return (
          <button
            key={tab.id}
            onClick={tab.onClick}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
              isActive ? 'text-white' : 'text-white/50 hover:text-white'
            }`}
          >
            <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 text-[#1db954] fill-current' : ''}`} />
            <span className={`text-[10px] tracking-tight mt-1 font-medium ${isActive ? 'font-bold text-white' : ''}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
