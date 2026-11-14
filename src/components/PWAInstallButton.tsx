import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed standalone PWA
  if (isInstalled) {
    if (variant === 'sidebar') {
      return (
        <div className="flex items-center gap-2 rounded-xl bg-[#FACC15]/10 border border-[#FACC15]/25 px-3 py-2 text-xs font-medium text-[#FACC15]">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Standalone App Active</span>
        </div>
      );
    }
    return null;
  }

  // Chromium / Android / Desktop installable prompt
  if (isInstallable) {
    if (variant === 'sidebar') {
      return (
        <button
          onClick={install}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#F43F5E] hover:bg-[#FB7185] px-3 py-2.5 text-xs font-bold text-white shadow transition active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
          title="Install standalone app for uninterrupted background playback"
        >
          <Download className="w-4 h-4 flex-shrink-0" />
          <span>Install Background App</span>
        </button>
      );
    }
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-full bg-[#F43F5E] hover:bg-[#FB7185] px-3.5 min-h-[36px] text-xs font-bold text-white shadow-lg transition active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
        title="Install app for uninterrupted background & lock-screen playback"
      >
        <Download className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari Add to Home Screen guide
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === 'sidebar'
              ? 'w-full flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 px-3 py-2.5 text-xs font-semibold text-white transition whitespace-nowrap shrink-0 cursor-pointer'
              : 'flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 px-3.5 min-h-[36px] text-xs font-semibold text-white shadow-sm transition whitespace-nowrap shrink-0 cursor-pointer'
          }
          title="Add to Home Screen for continuous background audio"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#1db954] flex-shrink-0" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#1e1e1e] border border-white/10 p-6 shadow-2xl text-white">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-[#1db954]" />
                  Install Aura Music on iOS
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10"
                  aria-label="Close guide"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-white/80 leading-relaxed">
                <p>Keep music playing across lock screen, Home Screen, and other apps:</p>
                <div className="space-y-2 bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#1db954] text-black font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                    <span>Tap the <strong>Share</strong> button in the Safari toolbar.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#1db954] text-black font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
                    <span>Select <strong>Add to Home Screen</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#1db954] text-black font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">3</span>
                    <span>Open <strong>Aura Music</strong> from your Home Screen for full lock-screen background controls.</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-full bg-[#1db954] py-2.5 text-xs font-bold text-black hover:bg-[#1ed760] transition cursor-pointer"
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
