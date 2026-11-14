import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    if (variant === 'sidebar') {
      return (
        <div className="flex items-center gap-2 rounded-xl bg-[#191919] border border-[#303030] px-3 py-2 text-xs font-medium text-[#A3A3A3]">
          <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
          <span className="truncate">Standalone App Active</span>
        </div>
      );
    }
    return null;
  }

  if (isInstallable) {
    if (variant === 'sidebar') {
      return (
        <button
          type="button"
          onClick={install}
          className="w-full aura-btn-primary flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          title="Install standalone app for uninterrupted background playback"
        >
          <Download className="w-4 h-4 flex-shrink-0" />
          <span>Install Background App</span>
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={install}
        className="aura-btn-primary flex items-center gap-1.5 rounded-full px-3.5 min-h-[36px] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
        title="Install app for uninterrupted background & lock-screen playback"
      >
        <Download className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === 'sidebar'
              ? 'w-full aura-btn-secondary flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer'
              : 'aura-btn-secondary flex items-center gap-1.5 rounded-full px-3.5 min-h-[36px] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer'
          }
          title="Add to Home Screen for continuous background audio"
        >
          <Smartphone className="w-3.5 h-3.5 text-white flex-shrink-0" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#111111] border border-[#303030] p-6 shadow-2xl text-white">
              <div className="flex items-center justify-between pb-3 border-b border-[#303030]">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-white" />
                  <span>Install Aura Music on iOS</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-[#A3A3A3] hover:text-white hover:bg-[#222222]"
                  aria-label="Close guide"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-[#A3A3A3] leading-relaxed">
                <p>Keep music playing across lock screen, Home Screen, and other apps:</p>
                <div className="space-y-2 bg-[#191919] p-3 rounded-xl border border-[#303030]">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-white text-black font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                    <span>Tap the <strong className="text-white">Share</strong> button in the Safari toolbar.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-white text-black font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
                    <span>Select <strong className="text-white">Add to Home Screen</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-white text-black font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">3</span>
                    <span>Open <strong className="text-white">Aura Music</strong> from your Home Screen for lock-screen controls.</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-full aura-btn-primary py-2.5 text-xs font-bold cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
