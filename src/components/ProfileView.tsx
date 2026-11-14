import React, { useState } from 'react';
import {
  Settings,
  Heart,
  Disc3,
  UserCheck,
  HardDriveDownload,
  ListMusic,
  Edit3,
  Check,
  Clock,
  Sliders,
  Shield,
} from 'lucide-react';
import { Artist, Playlist, SavedAlbum, Track, UserProfile, AppSettings, AppView } from '../types';
import SectionHeader from './design/SectionHeader';
import SongRow from './design/SongRow';
import ArtistCard from './design/ArtistCard';

interface ProfileViewProps {
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  appSettings: AppSettings;
  playlists: Playlist[];
  savedAlbums: SavedAlbum[];
  followedArtists: Artist[];
  offlineTracks: Track[];
  recentlyPlayed: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, contextPlaylist?: Playlist, contextTrackList?: Track[]) => void;
  onSelectArtist: (artistId: string) => void;
  onNavigate: (view: AppView) => void;
}

export default function ProfileView({
  userProfile,
  onUpdateProfile,
  appSettings,
  playlists,
  savedAlbums,
  followedArtists,
  offlineTracks,
  recentlyPlayed,
  currentTrack,
  isPlaying,
  onPlayTrack,
  onSelectArtist,
  onNavigate,
}: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(userProfile.name);
  const [draftHandle, setDraftHandle] = useState(userProfile.handle);
  const [draftBio, setDraftBio] = useState(userProfile.bio);
  const [draftAvatarStyle, setDraftAvatarStyle] = useState<UserProfile['avatarStyle']>(
    userProfile.avatarStyle
  );

  const likedCount = playlists.find((p) => p.isLikedSongs)?.tracks.length || 0;
  const initials = userProfile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'AM';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...userProfile,
      name: draftName.trim() || userProfile.name,
      handle: draftHandle.trim() || userProfile.handle,
      bio: draftBio.trim(),
      avatarStyle: draftAvatarStyle,
    });
    setIsEditing(false);
  };

  const renderAvatar = (style: UserProfile['avatarStyle'], sizeClass = 'w-20 h-20 sm:w-24 sm:h-24') => (
    <div
      className={`${sizeClass} rounded-full bg-[#191919] border border-[#303030] flex items-center justify-center text-white font-display font-extrabold text-2xl sm:text-3xl shrink-0 shadow-xl`}
    >
      {style === 'vinyl' ? (
        <Disc3 className="w-10 h-10 text-white" />
      ) : style === 'wave' ? (
        <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10">
          <path
            d="M4 14.5V9.5M8.5 18V6M13 19.5V4.5M17.5 16.5V7.5M21 13.5V10.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );

  const activityStats = [
    { label: 'Liked Songs', value: likedCount, icon: Heart, onClick: () => onNavigate('library') },
    { label: 'Playlists', value: playlists.length, icon: ListMusic, onClick: () => onNavigate('library') },
    { label: 'Followed Artists', value: followedArtists.length, icon: UserCheck, onClick: () => onNavigate('library') },
    { label: 'Saved Albums', value: savedAlbums.length, icon: Disc3, onClick: () => onNavigate('library') },
    { label: 'Offline Vault', value: offlineTracks.length, icon: HardDriveDownload, onClick: () => onNavigate('library') },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-44 space-y-9 select-none animate-in fade-in duration-200 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#A3A3A3] mb-1">Account &amp; Activity</p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Profile
          </h1>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="aura-btn-secondary inline-flex items-center gap-2 px-4 min-h-[40px] rounded-full text-xs font-semibold cursor-pointer"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>

      {/* Identity Card */}
      <div className="rounded-2xl bg-[#111111] border border-[#303030] p-5 sm:p-7">
        {!isEditing ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-5 min-w-0">
              {renderAvatar(userProfile.avatarStyle)}
              <div className="min-w-0">
                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white truncate">
                  {userProfile.name}
                </h2>
                <p className="text-xs text-[#A3A3A3] truncate mt-0.5">
                  {userProfile.handle} · {userProfile.email}
                </p>
                {userProfile.bio && (
                  <p className="text-xs sm:text-sm text-[#A3A3A3] mt-2 line-clamp-2 max-w-lg">
                    {userProfile.bio}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setDraftName(userProfile.name);
                setDraftHandle(userProfile.handle);
                setDraftBio(userProfile.bio);
                setDraftAvatarStyle(userProfile.avatarStyle);
                setIsEditing(true);
              }}
              className="aura-btn-secondary inline-flex items-center justify-center gap-2 px-4 min-h-[40px] rounded-full text-xs font-semibold shrink-0 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-[#303030]">
              <span className="text-xs font-semibold text-[#A3A3A3]">Avatar style:</span>
              {(['initials', 'vinyl', 'wave'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setDraftAvatarStyle(style)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize cursor-pointer transition ${
                    draftAvatarStyle === style
                      ? 'bg-white text-black'
                      : 'bg-[#191919] border border-[#303030] text-[#A3A3A3] hover:text-white'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="w-full bg-[#191919] border border-[#303030] focus:border-white/50 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">Username</label>
                <input
                  type="text"
                  value={draftHandle}
                  onChange={(e) => setDraftHandle(e.target.value)}
                  className="w-full bg-[#191919] border border-[#303030] focus:border-white/50 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">Listening Bio</label>
              <input
                type="text"
                value={draftBio}
                onChange={(e) => setDraftBio(e.target.value)}
                placeholder="Describe your sound..."
                className="w-full bg-[#191919] border border-[#303030] focus:border-white/50 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="aura-btn-secondary px-4 min-h-[38px] rounded-full text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="aura-btn-primary inline-flex items-center gap-1.5 px-5 min-h-[38px] rounded-full text-xs font-bold cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Personal Music Activity */}
      <section>
        <SectionHeader title="Personal Music Activity" subtitle="Across playlists, offline storage & followed artists" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {activityStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <button
                key={stat.label}
                type="button"
                onClick={stat.onClick}
                className="aura-card rounded-2xl p-4 text-left flex flex-col justify-between gap-3 cursor-pointer"
              >
                <Icon className="w-5 h-5 text-[#A3A3A3]" />
                <div>
                  <p className="font-display text-2xl font-extrabold text-white tabular-nums">
                    {stat.value}
                  </p>
                  <p className="text-xs text-[#A3A3A3] mt-0.5 truncate">{stat.label}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Listening Preferences & Account Management */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-[#111111] border border-[#303030] p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#A3A3A3]" />
                <span>Listening Preferences</span>
              </h3>
              <p className="text-xs text-[#A3A3A3] mt-1">Current audio &amp; playback configuration</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-[#303030]">
              <span className="text-[#A3A3A3]">Streaming Quality</span>
              <span className="font-bold text-white uppercase">{appSettings.audioQuality}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#303030]">
              <span className="text-[#A3A3A3]">Autoplay Mix</span>
              <span className="font-bold text-white">{appSettings.autoplay ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-[#A3A3A3]">Surface Contrast</span>
              <span className="font-bold text-white">
                {appSettings.pureBlackSurface ? 'Pure Black' : 'Obsidian'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="aura-btn-secondary w-full py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Adjust Preferences
          </button>
        </div>

        <div className="rounded-2xl bg-[#111111] border border-[#303030] p-5 flex flex-col justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#A3A3A3]" />
              <span>Account Management</span>
            </h3>
            <p className="text-xs text-[#A3A3A3] mt-1">Profile, offline storage &amp; session security</p>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-[#303030]">
              <span className="text-[#A3A3A3]">Account Email</span>
              <span className="font-semibold text-white truncate max-w-[180px]">{userProfile.email}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#303030]">
              <span className="text-[#A3A3A3]">Listening History</span>
              <span className="font-semibold text-white">
                {appSettings.pauseHistory ? 'Paused' : 'Recording'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-[#A3A3A3]">Offline Audio Vault</span>
              <span className="font-semibold text-white tabular-nums">{offlineTracks.length} saved</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="aura-btn-primary w-full py-2.5 rounded-xl text-xs font-bold cursor-pointer"
          >
            Manage Account &amp; Privacy
          </button>
        </div>
      </section>

      {/* Followed Artists */}
      {followedArtists.length > 0 && (
        <section>
          <SectionHeader title="Followed Artists" />
          <div className="flex overflow-x-auto gap-3.5 pb-2 scrollbar-none">
            {followedArtists.map((artist) => (
              <div key={artist.id} className="w-[144px] shrink-0">
                <ArtistCard artist={artist} onClick={() => onSelectArtist(artist.id)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Listening History */}
      {recentlyPlayed.length > 0 && (
        <section>
          <SectionHeader
            title="Recent Activity"
            subtitle="Recently streamed official songs"
            rightSlot={<Clock className="w-4 h-4 text-[#737373]" />}
          />
          <div className="space-y-2">
            {recentlyPlayed.slice(0, 8).map((track, idx) => (
              <SongRow
                key={`${track.id}-prof-${idx}`}
                track={track}
                isActive={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                onPlay={() => onPlayTrack(track, undefined, recentlyPlayed)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
