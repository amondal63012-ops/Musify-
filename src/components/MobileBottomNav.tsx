import React from 'react';
import { Home, Search, Library } from 'lucide-react';
import { AppView } from '../types';

interface MobileBottomNavProps {
  currentView: string;
  onViewChange: (view: AppView) => void;
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
      isActive:
        currentView === 'home' ||
        currentView === 'explore' ||
        currentView === 'viral' ||
        currentView === 'charts' ||
        currentView === 'artists' ||
        currentView === 'artist',
      onClick: () => onViewChange('home'),
    },
    {
      id: 'search' as const,
      label: 'Search',
      icon: Search,
      isActive: currentView === 'search',
      onClick: () => {
        onViewChange('search');
        onOpenSearch?.();
      },
    },
    {
      id: 'library' as const,
      label: 'Your Library',
      icon: Library,
      isActive:
        currentView === 'library' ||
        currentView === 'playlist' ||
        currentView === 'profile' ||
        currentView === 'settings' ||
        currentView === 'queue',
      onClick: () => onViewChange('library'),
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#080808]/95 backdrop-blur-xl border-t border-[#303030]/70 px-4 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] select-none md:hidden"
    >
      <div className="grid grid-cols-3 items-center max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={tab.onClick}
              className={`flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors duration-150 cursor-pointer active:scale-95 ${
                tab.isActive ? 'text-white' : 'text-[#737373] hover:text-[#A3A3A3]'
              }`}
              aria-label={tab.label}
              aria-current={tab.isActive ? 'page' : undefined}
            >
              <Icon
                className={`w-[22px] h-[22px] transition-transform duration-150 ${
                  tab.isActive ? 'scale-105 stroke-[2.3px]' : 'stroke-[1.75px]'
                }`}
              />
              <span
                className={`text-[10px] tracking-tight mt-1 whitespace-nowrap shrink-0 ${
                  tab.isActive ? 'font-semibold text-white' : 'font-medium text-[#737373]'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
