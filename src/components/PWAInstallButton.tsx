import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed standalone PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-full bg-[#1db954] hover:bg-[#1ed760] px-3 py-1.5 text-xs font-bold text-black shadow-lg transition active:scale-95"
        title="Install app for enhanced background playback & lock screen audio"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition"
          title="Add to Home Screen for background playback"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#1db954]" />
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
                  className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-white/80 leading-relaxed">
                <p>Enjoy uninterrupted background playback across lock screen and other apps:</p>
                <div className="space-y-2 bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#1db954] text-black font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                    <span>Tap the <strong>Share</strong> icon in the Safari toolbar at the bottom.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#1db954] text-black font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
                    <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#1db954] text-black font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">3</span>
                    <span>Launch Aura Music from your Home Screen for full background audio!</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-full bg-[#1db954] py-2.5 text-xs font-bold text-black hover:bg-[#1ed760] transition"
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
