import React, { useState } from 'react';
import {
  Volume2,
  Sliders,
  Moon,
  Bell,
  User,
  Lock,
  Info,
  LogOut,
  Trash2,
  Check,
  ChevronLeft,
} from 'lucide-react';
import { AppSettings, AppView, UserProfile } from '../types';
import AuraLogo from './design/AuraLogo';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  userProfile: UserProfile;
  offlineCount: number;
  recentSearchesCount: number;
  recentlyPlayedCount: number;
  onClearRecentSearches: () => void;
  onClearRecentlyPlayed: () => void;
  onResetSession: () => void;
  onNavigate: (view: AppView) => void;
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-[#303030] last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        {description && <p className="text-xs text-[#A3A3A3] mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full border transition-colors cursor-pointer shrink-0 ${
          checked ? 'bg-white border-white' : 'bg-[#222222] border-[#303030]'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-4.5 h-4.5 rounded-full transition-transform ${
            checked ? 'translate-x-5 bg-black' : 'translate-x-0 bg-[#A3A3A3]'
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsView({
  settings,
  onUpdateSettings,
  userProfile,
  offlineCount,
  recentSearchesCount,
  recentlyPlayedCount,
  onClearRecentSearches,
  onClearRecentlyPlayed,
  onResetSession,
  onNavigate,
}: SettingsViewProps) {
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const flashNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice((p) => (p === msg ? null : p)), 2500);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-44 space-y-6 select-none animate-in fade-in duration-200 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className="w-9 h-9 rounded-full bg-[#191919] border border-[#303030] hover:bg-[#222222] flex items-center justify-center text-white cursor-pointer"
            aria-label="Back to Profile"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-xs font-medium text-[#A3A3A3]">Preferences &amp; Controls</p>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Settings
            </h1>
          </div>
        </div>

        {statusNotice && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#191919] border border-[#303030] px-3.5 py-1.5 rounded-full">
            <Check className="w-3.5 h-3.5" />
            <span>{statusNotice}</span>
          </span>
        )}
      </div>

      {/* Audio Quality */}
      <section className="rounded-2xl bg-[#111111] border border-[#303030] p-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
          <Volume2 className="w-4 h-4 text-[#A3A3A3]" />
          <span>Audio Quality</span>
        </h2>
        <p className="text-xs text-[#A3A3A3] mb-4">Preferred bitrate tier for official streaming</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {(
            [
              { id: '320k', title: '320kbps Master', sub: 'Highest studio clarity' },
              { id: '160k', title: '160kbps High', sub: 'Balanced fidelity & speed' },
              { id: '96k', title: '96kbps Saver', sub: 'Optimized for cellular' },
            ] as const
          ).map((tier) => {
            const active = settings.audioQuality === tier.id;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => {
                  onUpdateSettings({ ...settings, audioQuality: tier.id });
                  flashNotice(`Quality set to ${tier.title}`);
                }}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                  active
                    ? 'bg-white text-black border-white'
                    : 'bg-[#191919] text-white border-[#303030] hover:bg-[#222222]'
                }`}
              >
                <p className="text-sm font-bold">{tier.title}</p>
                <p className={`text-xs mt-0.5 ${active ? 'text-black/70' : 'text-[#A3A3A3]'}`}>
                  {tier.sub}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Playback Settings */}
      <section className="rounded-2xl bg-[#111111] border border-[#303030] p-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2 mb-2">
          <Sliders className="w-4 h-4 text-[#A3A3A3]" />
          <span>Playback Settings</span>
        </h2>

        <ToggleRow
          label="Autoplay Similar Songs"
          description="Keep playing curated tracks when your playlist or album ends"
          checked={settings.autoplay}
          onChange={(autoplay) => onUpdateSettings({ ...settings, autoplay })}
        />
        <ToggleRow
          label="Gapless Transition & Pre-Warm"
          description="Buffer upcoming songs at 65% progress for seamless track switches"
          checked={settings.gaplessPlayback}
          onChange={(gaplessPlayback) => onUpdateSettings({ ...settings, gaplessPlayback })}
        />
      </section>

      {/* Theme Settings */}
      <section className="rounded-2xl bg-[#111111] border border-[#303030] p-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2 mb-2">
          <Moon className="w-4 h-4 text-[#A3A3A3]" />
          <span>Theme Settings</span>
        </h2>

        <ToggleRow
          label="Pure Black Background (#000000)"
          description="Switch main canvas from Obsidian (#080808) to True OLED Black (#000000)"
          checked={settings.pureBlackSurface}
          onChange={(pureBlackSurface) => {
            onUpdateSettings({ ...settings, pureBlackSurface });
            flashNotice(pureBlackSurface ? 'Pure Black active' : 'Obsidian active');
          }}
        />
        <ToggleRow
          label="Reduce Interface Motion"
          description="Minimize hover scaling and page transitions"
          checked={settings.reducedMotion}
          onChange={(reducedMotion) => onUpdateSettings({ ...settings, reducedMotion })}
        />
      </section>

      {/* Notifications */}
      <section className="rounded-2xl bg-[#111111] border border-[#303030] p-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2 mb-2">
          <Bell className="w-4 h-4 text-[#A3A3A3]" />
          <span>Notifications</span>
        </h2>

        <ToggleRow
          label="New Release Highlights"
          description="Show fresh drops from followed artists in the notification menu"
          checked={settings.releaseNotifications}
          onChange={(releaseNotifications) => onUpdateSettings({ ...settings, releaseNotifications })}
        />
        <ToggleRow
          label="Weekly Chart Updates"
          description="Include trending chart movements in top alerts"
          checked={settings.chartNotifications}
          onChange={(chartNotifications) => onUpdateSettings({ ...settings, chartNotifications })}
        />
      </section>

      {/* Account Settings */}
      <section className="rounded-2xl bg-[#111111] border border-[#303030] p-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-[#A3A3A3]" />
          <span>Account Settings</span>
        </h2>
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between py-2 border-b border-[#303030]">
            <span className="text-[#A3A3A3]">Signed-in Profile</span>
            <span className="font-semibold text-white">{userProfile.name} ({userProfile.handle})</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#303030]">
            <span className="text-[#A3A3A3]">Email</span>
            <span className="font-semibold text-white">{userProfile.email}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-[#A3A3A3]">Offline Device Vault</span>
            <button
              type="button"
              onClick={() => onNavigate('library')}
              className="font-semibold text-white underline hover:text-[#A3A3A3] cursor-pointer tabular-nums"
            >
              Manage ({offlineCount} tracks)
            </button>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="rounded-2xl bg-[#111111] border border-[#303030] p-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-[#A3A3A3]" />
          <span>Privacy</span>
        </h2>

        <ToggleRow
          label="Pause Listening History"
          description="Temporarily stop adding played songs to Recently Played"
          checked={settings.pauseHistory}
          onChange={(pauseHistory) => onUpdateSettings({ ...settings, pauseHistory })}
        />

        <div className="flex flex-wrap gap-2.5 pt-4">
          <button
            type="button"
            onClick={() => {
              onClearRecentSearches();
              flashNotice('Recent searches cleared');
            }}
            disabled={recentSearchesCount === 0}
            className="aura-btn-secondary px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Recent Searches ({recentSearchesCount})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClearRecentlyPlayed();
              flashNotice('Listening history cleared');
            }}
            disabled={recentlyPlayedCount === 0}
            className="aura-btn-secondary px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Listening History ({recentlyPlayedCount})</span>
          </button>
        </div>
      </section>

      {/* About Aura Music */}
      <section className="rounded-2xl bg-[#111111] border border-[#303030] p-5">
        <div className="flex items-center justify-between gap-4 mb-3">
          <AuraLogo size="sm" />
          <span className="text-xs font-medium text-[#737373]">Background Audio Edition</span>
        </div>
        <div className="flex items-start gap-2.5 text-xs text-[#A3A3A3] leading-relaxed">
          <Info className="w-4 h-4 text-[#737373] shrink-0 mt-0.5" />
          <p>
            Aura Music delivers official studio streaming, lock-screen Media3/MediaSession controls,
            synchronized lyrics, and local offline audio playback inside a monochrome interface
            designed to keep full focus on album artwork.
          </p>
        </div>
      </section>

      {/* Logout / Reset Session */}
      <section className="rounded-2xl bg-[#111111] border border-[#303030] p-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white">Session Control</h3>
          <p className="text-xs text-[#A3A3A3] mt-0.5">Sign out or reset local preferences on this device</p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmLogoutOpen(true)}
          className="aura-btn-secondary px-5 py-2.5 rounded-full text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </button>
      </section>

      {/* Logout Confirmation Modal */}
      {confirmLogoutOpen && (
        <div
          onClick={() => setConfirmLogoutOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm aura-sheet rounded-2xl p-6 space-y-4"
          >
            <h3 className="text-base font-bold text-white">Reset &amp; Sign Out?</h3>
            <p className="text-xs text-[#A3A3A3] leading-relaxed">
              This resets your local listening history, search history, and profile preferences on this browser while keeping your Offline Vault safe.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmLogoutOpen(false)}
                className="aura-btn-secondary px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetSession();
                  setConfirmLogoutOpen(false);
                  flashNotice('Session preferences reset');
                }}
                className="aura-btn-primary px-5 py-2 rounded-full text-xs font-bold cursor-pointer"
              >
                Confirm Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
